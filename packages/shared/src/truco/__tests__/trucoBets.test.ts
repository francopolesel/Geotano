import { describe, expect, it } from 'vitest';
import { applyAction, createMatch } from '../engine.js';
import { mulberry32 } from '../rng.js';
import type { CardId, PlayerSlot, TrucoAction, TrucoState } from '../types.js';

const DEPS = () => ({ rng: mulberry32(17) });
const other = (p: PlayerSlot): PlayerSlot => (p === 'A' ? 'B' : 'A');

function makeState(opts?: {
  mano?: PlayerSlot;
  targetPoints?: 15 | 30;
  scores?: Record<PlayerSlot, number>;
}): TrucoState {
  const base = createMatch(
    { mano: opts?.mano ?? 'A', targetPoints: opts?.targetPoints ?? 30 },
    mulberry32(5),
  );
  return opts?.scores ? { ...base, scores: { ...opts.scores } } : base;
}

function act(state: TrucoState, action: TrucoAction) {
  return applyAction(state, action, DEPS());
}

/**
 * Runs a chain of calls WITHOUT answering in between: raises ride on the
 * still-pending bet (the responder holds the raise right). Every call is
 * sung by whoever is entitled at that moment.
 */
function runTrucoChain(state: TrucoState, calls: ('sing_truco' | 'sing_retruco' | 'sing_vale_cuatro')[]) {
  let current = state;
  let pendingSinger: PlayerSlot = 'A';
  for (const call of calls) {
    const bet = call === 'sing_truco' ? null : current.truco;
    if (bet) {
      // Raises are responder-gated, not turn-gated.
      var singer = bet.responder;
    } else {
      var singer = current.playerToAct as PlayerSlot;
    }
    const sung = act(current, { type: call, actor: singer });
    if (!sung.ok) throw new Error(`${call} failed: ${sung.errorCode}`);
    current = sung.state;
    pendingSinger = current.truco!.singer;
  }
  return { final: current, lastSinger: pendingSinger };
}

// ---------------------------------------------------------------------------
// Task 2.6 — Truco chain, raise rights, deadlines
// ---------------------------------------------------------------------------

describe('Refusals end the hand with exact payouts', () => {
  it('refusing truco awards exactly 1 to the truco singer and ends the hand', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const refused = act(sung.state, { type: 'no_quiero', actor: 'B' });
    if (!refused.ok) throw new Error(refused.errorCode);
    expect(refused.state.scores.A).toBe(1);
    expect(refused.state.scores.B).toBe(0);
    // Hand ended → next hand auto-dealt.
    expect(refused.state.handNumber).toBe(2);
    expect(refused.state.hands.A).toHaveLength(3);
  });

  it('refuse retruco: A no-quiero on B’s retruco → hand ends, B scores exactly 2', () => {
    const state = makeState({ mano: 'A' });
    const { final } = runTrucoChain(state, ['sing_truco']);
    // B (the accepter of truco) now holds the raise right.
    const retruco = act(final, { type: 'sing_retruco', actor: 'B' });
    if (!retruco.ok) throw new Error(retruco.errorCode);
    expect(retruco.state.truco).toMatchObject({ level: 3, singer: 'B', responder: 'A' });
    const refused = act(retruco.state, { type: 'no_quiero', actor: 'A' });
    if (!refused.ok) throw new Error(refused.errorCode);
    expect(refused.state.scores.B).toBe(2);
    expect(refused.state.scores.A).toBe(0);
    expect(refused.state.handNumber).toBe(2);
  });

  it('refusing vale cuatro awards exactly 3 to its singer and ends the hand', () => {
    const state = makeState({ mano: 'A' });
    const { final } = runTrucoChain(state, ['sing_truco', 'sing_retruco']);
    // A accepted retruco → A holds the vale-cuatro right.
    const vale = act(final, { type: 'sing_vale_cuatro', actor: 'A' });
    if (!vale.ok) throw new Error(vale.errorCode);
    const refused = act(vale.state, { type: 'no_quiero', actor: 'B' });
    if (!refused.ok) throw new Error(refused.errorCode);
    expect(refused.state.scores.A).toBe(3);
    expect(refused.state.handNumber).toBe(2);
  });
});

describe('Raise rights and terminal level', () => {
  it('only accepter may raise: retruco attempt by the original singer is rejected', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const accepted = act(sung.state, { type: 'quiero', actor: 'B' });
    if (!accepted.ok) throw new Error(accepted.errorCode);
    const attempt = act(accepted.state, { type: 'sing_retruco', actor: 'A' });
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_NO_PENDING_BET');
  });

  it('a non-responder cannot answer the pending bet', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const selfAnswer = act(sung.state, { type: 'quiero', actor: 'A' });
    if (selfAnswer.ok) throw new Error('must reject');
    expect(selfAnswer.errorCode).toBe('E_NOT_RESPONDER');
  });

      it('vale cuatro is terminal: plays for exactly 4 and nothing further is legal', () => {
    const state = makeState({ mano: 'A' });
    const { final } = runTrucoChain(state, ['sing_truco', 'sing_retruco']);
    // Pending retruco {singer:B, responder:A} → A raises vale cuatro.
    const vale = act(final, { type: 'sing_vale_cuatro', actor: final.truco!.responder });
    if (!vale.ok) throw new Error(vale.errorCode);
    const accepted = act(vale.state, { type: 'quiero', actor: vale.state.truco!.responder });
    if (!accepted.ok) throw new Error(accepted.errorCode);
    expect(accepted.state.trucoLevel).toBe(4);
    for (const call of ['sing_truco', 'sing_retruco', 'sing_vale_cuatro'] as const) {
      const further = act(accepted.state, { type: call, actor: accepted.state.playerToAct });
      if (further.ok) throw new Error('must reject');
      expect(further.errorCode).toBe('E_NO_PENDING_BET');
    }
  });

  it('raising over vale cuatro or re-raising retruco is an illegal raise order', () => {
    const state = makeState({ mano: 'A' });
    const { final } = runTrucoChain(state, ['sing_truco']);
    const vale = act(final, { type: 'sing_vale_cuatro', actor: 'B' });
    if (vale.ok) {
      // vale over truco (skipping retruco) must be illegal…
      throw new Error('vale cuatro over plain truco must be rejected');
    }
    const retrucoTwice = act(final, { type: 'sing_retruco', actor: 'B' });
    if (!retrucoTwice.ok) throw new Error(retrucoTwice.errorCode);
    const again = act(retrucoTwice.state, { type: 'sing_retruco', actor: 'A' });
    if (again.ok) throw new Error('must reject');
    expect(again.errorCode).toBe('E_ILLEGAL_RAISE_ORDER');
  });

  it('singing truco is turn-gated', () => {
    const state = makeState({ mano: 'A' }); // A to act
    const attempt = act(state, { type: 'sing_truco', actor: 'B' });
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_OUT_OF_TURN');
  });
});

describe('Deadlines and explicit answers', () => {
  it('after the hand ended, truco attempts are rejected (E_TRUCO_WINDOW_CLOSED)', () => {
    const state = makeState();
    const ended: TrucoState = { ...structuredClone(state), phase: 'hand_end', handWinner: 'A' };
    const attempt = act(ended, { type: 'sing_truco', actor: 'A' });
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_TRUCO_WINDOW_CLOSED');
    expect(attempt.state).toBe(ended);
  });

  it('must answer before acting: playing a card while a bet awaits ME is rejected', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    // Bet awaits B; B tries to play instead of answering — never implicit accept.
    const responder = sung.state.truco!.responder;
    const card = sung.state.hands[responder][0]!;
    const attempt = act(sung.state, { type: 'play_card', actor: responder, card });
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_AWAITING_OWN_BET');
  });

  it('playing a card while MY OWN bet awaits the opponent is also rejected', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const card = sung.state.hands.A[0]!;
    const attempt = act(sung.state, { type: 'play_card', actor: 'A', card });
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_AWAITING_OWN_BET');
    expect(attempt.state).toBe(sung.state);
  });

  it('after quiero, play resumes at the singer’s turn', () => {
    const state = makeState({ mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const accepted = act(sung.state, { type: 'quiero', actor: 'B' });
    if (!accepted.ok) throw new Error(accepted.errorCode);
    expect(accepted.state.phase).toBe('playing');
    expect(accepted.state.playerToAct).toBe('A');
    expect(accepted.state.truco).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Task 2.7 — Scoring and match end
// ---------------------------------------------------------------------------

describe('Scoring and match end', () => {
  it('envido ends the match before any truco/bazas points count (target 15 @14 +2)', () => {
    const state = makeState({
      targetPoints: 15,
      scores: { A: 14, B: 0 },
    });
    const opened = act(state, { type: 'sing_envido', actor: 'A' });
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = act(opened.state, { type: 'quiero', actor: 'B' });
    if (!settled.ok) throw new Error(settled.errorCode);
    // Comparison winner depends on dealt hands; force determinism by checking
    // via showdown event who won, then assert the end conditions.
    const showdown = settled.state.history.find((e) => e.type === 'envido_showdown');
    if (!showdown || showdown.type !== 'envido_showdown') throw new Error('showdown missing');
    const winner = showdown.winner;
    expect(settled.state.scores[winner]).toBeGreaterThanOrEqual(15);
    expect(settled.state.phase).toBe('match_end');
    expect(settled.state.winner).toBe(winner);
    const awards = settled.events.filter((e) => e.type === 'points_awarded');
    expect(awards).toHaveLength(1); // envido award only — nothing else scored
  });

  it('win threshold inclusive: exactly 30 ends the match', () => {
    const state = makeState({ scores: { A: 29, B: 29 } });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    const refused = act(sung.state, { type: 'no_quiero', actor: 'B' });
    if (!refused.ok) throw new Error(refused.errorCode);
    expect(refused.state.scores.A).toBe(30);
    expect(refused.state.phase).toBe('match_end');
    expect(refused.state.winner).toBe('A');
  });

  it('win threshold inclusive: overshooting to 31 also ends the match', () => {
    const state = makeState({ scores: { A: 29, B: 29 }, mano: 'A' });
    const sung = act(state, { type: 'sing_truco', actor: 'A' });
    if (!sung.ok) throw new Error(sung.errorCode);
    // B raises retruco over the still-pending truco; A refuses THAT → B +2.
    const retruco = act(sung.state, { type: 'sing_retruco', actor: 'B' });
    if (!retruco.ok) throw new Error(retruco.errorCode);
    const refused = act(retruco.state, { type: 'no_quiero', actor: 'A' });
    if (!refused.ok) throw new Error(refused.errorCode);
    expect(refused.state.scores.B).toBe(31);
    expect(refused.state.phase).toBe('match_end');
    expect(refused.state.winner).toBe('B');
  });

  it('configurable 15-point game ends when a player reaches 15', () => {
    expect(createMatch({ targetPoints: 15 }, mulberry32(1)).targetPoints).toBe(15);
    const state = makeState({ targetPoints: 15, scores: { A: 13, B: 0 } });
    const opened = act(state, { type: 'sing_envido', actor: 'A' });
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = act(opened.state, { type: 'quiero', actor: 'B' });
    if (!settled.ok) throw new Error(settled.errorCode);
    const showdown = settled.state.history.find((e) => e.type === 'envido_showdown');
    if (!showdown || showdown.type !== 'envido_showdown') throw new Error('showdown missing');
    expect(settled.state.phase).toBe('match_end');
    expect(settled.state.winner).toBe(showdown.winner);
    expect(settled.state.scores[showdown.winner]).toBeGreaterThanOrEqual(15);
  });

  it('DEFAULT TARGET is 30 pinned at engine level', () => {
    const bare = createMatch({}, mulberry32(3));
    expect(bare.targetPoints).toBe(30);
  });

  it('scores never decrease across seeded random matches (property sweep)', () => {
    const CANDIDATE_TYPES = [
      'play_card',
      'play_card',
      'play_card', // weight legal plays higher so hands actually progress
      'sing_envido',
      'sing_real_envido',
      'sing_falta_envido',
      'sing_truco',
      'sing_retruco',
      'sing_vale_cuatro',
      'quiero',
      'no_quiero',
    ] as const;

    for (let seed = 1; seed <= 25; seed++) {
      const rng = mulberry32(seed * 1013);
      let state = createMatch({ mano: seed % 2 === 0 ? 'A' : 'B' }, mulberry32(seed));
      let plies = 0;
      while (state.phase !== 'match_end' && plies < 400) {
        plies++;
        const before = { ...state.scores };
        const candidates: TrucoAction[] = [];
        // During betting phases the expected answerer is NOT playerToAct,
        // so a blind client probes both slots.
        const actors: PlayerSlot[] =
          state.phase === 'playing' || state.phase === 'waiting_for_players'
            ? [state.playerToAct]
            : ['A', 'B'];
        for (const actor of actors) {
          for (const card of state.hands[actor]) {
            candidates.push({ type: 'play_card', actor, card });
          }
          for (const type of CANDIDATE_TYPES) {
            if (type !== 'play_card') candidates.push({ type, actor } as TrucoAction);
          }
        }
        // Shuffle candidate order with the seeded rng, take first success.
        const order = [...candidates].sort(() => rng() - 0.5);
        let advanced = false;
        for (const action of order) {
          const result = applyAction(state, action, { rng });
          if (result.ok) {
            const after = result.state.scores;
            expect(after.A).toBeGreaterThanOrEqual(before.A);
            expect(after.B).toBeGreaterThanOrEqual(before.B);
            state = result.state;
            advanced = true;
            break;
          }
        }
        if (!advanced) break; // stuck (should not happen)
      }
      expect(['playing', 'match_end']).toContain(state.phase);
      if (state.phase === 'match_end') {
        const w = state.winner as PlayerSlot;
        expect(state.scores[w]).toBeGreaterThanOrEqual(state.targetPoints);
      }
    }
  });

  it('an untouched hand won by bazas pays exactly 1', () => {
    // Reuses engine-level cascade: quick two-baza win via patched hands.
    const base = createMatch({ mano: 'A' }, mulberry32(9));
    const state: TrucoState = {
      ...base,
      hands: { A: ['1espada' as CardId, '1basto' as CardId, '3oro' as CardId], B: ['4oro' as CardId, '4copa' as CardId, '4basto' as CardId] },
    };
    const b1 = act(state, { type: 'play_card', actor: 'A', card: '1espada' });
    if (!b1.ok) throw new Error(b1.errorCode);
    const b1b = act(b1.state, { type: 'play_card', actor: 'B', card: '4oro' });
    if (!b1b.ok) throw new Error(b1b.errorCode);
    const b2 = act(b1b.state, { type: 'play_card', actor: 'A', card: '1basto' });
    if (!b2.ok) throw new Error(b2.errorCode);
    const b2b = act(b2.state, { type: 'play_card', actor: 'B', card: '4copa' });
    if (!b2b.ok) throw new Error(b2b.errorCode);
    expect(b2b.state.scores.A).toBe(1);
  });
});
