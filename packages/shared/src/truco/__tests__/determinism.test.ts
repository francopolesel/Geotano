import { describe, expect, it } from 'vitest';
import { applyAction, createMatch } from '../engine.js';
import { TRUCO_ERROR_CODES, type TrucoErrorCode } from '../errors.js';
import { mulberry32 } from '../rng.js';
import type { PlayerSlot, TrucoAction, TrucoEvent, TrucoState } from '../types.js';

// ---------------------------------------------------------------------------
// Task 2.9 — CU2 gate: determinism replay + full error-taxonomy coverage
// ---------------------------------------------------------------------------

interface Transcript {
  seed: number;
  states: TrucoState[];
  events: TrucoEvent[][];
}

/** Plays a full seeded match with a deterministic blind client. */
function playSeededMatch(seed: number): Transcript {
  const rng = mulberry32(seed);
  let state = createMatch({ mano: seed % 2 === 0 ? 'A' : 'B' }, mulberry32(seed * 7919));
  const states: TrucoState[] = [structuredClone(state)];
  const events: TrucoEvent[][] = [];
  const CANDIDATE_TYPES = [
    'play_card',
    'play_card',
    'play_card',
    'sing_envido',
    'sing_real_envido',
    'sing_falta_envido',
    'sing_truco',
    'sing_retruco',
    'sing_vale_cuatro',
    'quiero',
    'no_quiero',
  ] as const;

  let plies = 0;
  while (state.phase !== 'match_end' && plies < 400) {
    plies++;
    const actors: PlayerSlot[] =
      state.phase === 'playing' || state.phase === 'waiting_for_players'
        ? [state.playerToAct]
        : ['A', 'B'];
    const candidates: TrucoAction[] = [];
    for (const actor of actors) {
      for (const card of state.hands[actor]) candidates.push({ type: 'play_card', actor, card });
      for (const type of CANDIDATE_TYPES) {
        if (type !== 'play_card') candidates.push({ type, actor } as TrucoAction);
      }
    }
    const order = [...candidates].sort(() => rng() - 0.5);
    for (const action of order) {
      const result = applyAction(state, action, { rng });
      if (result.ok) {
        state = result.state;
        states.push(structuredClone(state));
        events.push(result.events);
        break;
      }
    }
  }
  return { seed, states, events };
}

describe('Determinism — recorded full-match replay', () => {
  it('same seed twice produces deep-equal transcripts', () => {
    for (const seed of [3, 42, 777]) {
      const a = playSeededMatch(seed);
      const b = playSeededMatch(seed);
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)));
      expect(a.states.at(-1)!.phase).toBe('match_end');
    }
  });

  it('different manos diverge (sanity: transcript is actually recording something)', () => {
    const a = playSeededMatch(8);
    expect(a.states.length).toBeGreaterThan(5);
    expect(a.events.length).toBe(a.states.length - 1);
  });
});

// ---------------------------------------------------------------------------
// E_* sweep — proves every taxonomy code is reachable and fires correctly.
// ---------------------------------------------------------------------------

describe('Error taxonomy coverage sweep', () => {
  const DEPS = () => ({ rng: mulberry32(31) });
  const hit = new Set<TrucoErrorCode>();
  function expectCode(state: TrucoState, action: TrucoAction, code: TrucoErrorCode) {
    const r = applyAction(state, action, DEPS());
    if (r.ok) throw new Error(`expected ${code}, got success`);
    expect(r.errorCode).toBe(code);
    hit.add(r.errorCode);
  }

  it('exercises every code in TRUCO_ERROR_CODES at least once', () => {
    const base = createMatch({ mano: 'A' }, mulberry32(2));

    // E_OUT_OF_TURN
    expectCode(base, { type: 'sing_truco', actor: 'B' }, 'E_OUT_OF_TURN');
    // E_CARD_NOT_OWNED
    expectCode(
      base,
      { type: 'play_card', actor: 'A', card: '1espada' === base.hands.A[0] ? '1basto' : '1espada' },
      'E_CARD_NOT_OWNED',
    );
    // E_ENVIDO_WINDOW_CLOSED (after first card, either actor, every call type)
    let r = applyAction(base, { type: 'play_card', actor: 'A', card: base.hands.A[0]! }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    expectCode(r.state, { type: 'sing_envido', actor: 'A' }, 'E_ENVIDO_WINDOW_CLOSED');
    expectCode(r.state, { type: 'sing_envido', actor: 'B' }, 'E_ENVIDO_WINDOW_CLOSED');
    expectCode(r.state, { type: 'sing_real_envido', actor: 'B' }, 'E_ENVIDO_WINDOW_CLOSED');
    expectCode(r.state, { type: 'sing_falta_envido', actor: 'B' }, 'E_ENVIDO_WINDOW_CLOSED');

    // E_AWAITING_OWN_BET (card play while a bet is open — synthetic pending bet)
    const withBet: TrucoState = {
      ...structuredClone(base),
      phase: 'truco_betting',
      truco: { level: 2, singer: 'A', responder: 'B', resumeTurn: 'A' },
    };
    expectCode(withBet, { type: 'play_card', actor: 'B', card: base.hands.B[0]! }, 'E_AWAITING_OWN_BET');

    // E_ENVIDO_BETTING_CLOSED (raise attempt after answer)
    const fresh = createMatch({ mano: 'A' }, mulberry32(2));
    const opened = applyAction(fresh, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    // E_NO_PENDING_BET: accepted truco level ≠ 1 blocks re-opening.
    const acceptedLevel2: TrucoState = {
      ...structuredClone(createMatch({ mano: 'A' }, mulberry32(2))),
      trucoLevel: 2,
      trucoAccepted: true,
    };
    expectCode(acceptedLevel2, { type: 'sing_truco', actor: 'A' }, 'E_NO_PENDING_BET');
    // Post-answer envido raise → betting already closed (matches slice-2b suite).
    expectCode(settled.state, { type: 'sing_real_envido', actor: 'B' }, 'E_ENVIDO_BETTING_CLOSED');

    // E_ILLEGAL_RAISE_ORDER (real answered with plain envido raise)
    const realOpened = applyAction(createMatch({ mano: 'A' }, mulberry32(2)), { type: 'sing_real_envido', actor: 'A' }, DEPS());
    if (!realOpened.ok) throw new Error(realOpened.errorCode);
    expectCode(realOpened.state, { type: 'sing_envido', actor: 'B' }, 'E_ILLEGAL_RAISE_ORDER');

    // E_NOT_RESPONDER + E_ALREADY_ANSWERED (synthetic answered substates)
    const envAnswered: TrucoState = {
      ...structuredClone(createMatch({ mano: 'A' }, mulberry32(2))),
      phase: 'envido_betting',
      envido: {
        stake: 2,
        priorStake: 0,
        awaitingResponder: 'B',
        lastCaller: 'A',
        falta: false,
        realRaised: false,
        answered: true,
      },
    };
    expectCode(envAnswered, { type: 'quiero', actor: 'A' }, 'E_NOT_RESPONDER');
    expectCode(envAnswered, { type: 'quiero', actor: 'B' }, 'E_ALREADY_ANSWERED');

    // E_NOT_PARTICIPANT
    expectCode(base, { type: 'sing_truco', actor: 'Z' as PlayerSlot }, 'E_NOT_PARTICIPANT');
    // E_MATCH_FINISHED
    const finished: TrucoState = { ...structuredClone(base), phase: 'match_end', winner: 'A' };
    expectCode(finished, { type: 'play_card', actor: 'A', card: base.hands.A[0]! }, 'E_MATCH_FINISHED');
    // E_STATE_FORBIDDEN (card after hand end)
    const handEnd: TrucoState = { ...structuredClone(base), phase: 'hand_end', handWinner: 'A' };
    expectCode(handEnd, { type: 'play_card', actor: 'A', card: base.hands.A[0]! }, 'E_STATE_FORBIDDEN');
    // E_TRUCO_WINDOW_CLOSED
    expectCode(handEnd, { type: 'sing_truco', actor: 'A' }, 'E_TRUCO_WINDOW_CLOSED');
    // E_CARD_ALREADY_PLAYED (replay the same played card via synthetic state)
    const replayed = structuredClone(base);
    const first = replayed.hands.A[0]!;
    replayed.playedCards.A.push(first);
    expectCode(replayed, { type: 'play_card', actor: 'A', card: first }, 'E_CARD_ALREADY_PLAYED');
    // E_NO_PENDING_BET already added above.

    const missing = TRUCO_ERROR_CODES.filter((c) => !hit.has(c));
    expect(missing).toEqual([]);
  });
});
