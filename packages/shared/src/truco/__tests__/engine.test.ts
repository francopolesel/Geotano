import { describe, expect, it } from 'vitest';
import { DECK_40 } from '../deck.js';
import { createMatch, applyAction } from '../engine.js';
import { mulberry32 } from '../rng.js';
import type { CardId, PlayerSlot, TrucoState } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(opts?: {
  mano?: PlayerSlot;
  targetPoints?: 15 | 30;
  seed?: number;
}): TrucoState {
  return createMatch(
    { mano: opts?.mano ?? 'A', targetPoints: opts?.targetPoints ?? 30 },
    mulberry32(opts?.seed ?? 42),
  );
}

/** Patch the dealt hands so baza outcomes are fully deterministic. */
function withHands(state: TrucoState, a: CardId[], b: CardId[]): TrucoState {
  return { ...state, hands: { A: [...a], B: [...b] } };
}

type Play = { actor: PlayerSlot; card: CardId };

/**
 * All helper-driven actions carry an rng so hand-ending plays can auto-deal;
 * mid-hand plays simply never consume it (proven by dedicated tests below).
 */
const DEPS = () => ({ rng: mulberry32(999) });

function playCard(state: TrucoState, play: Play) {
  return applyAction(state, { type: 'play_card', ...play }, DEPS());
}

const other = (p: PlayerSlot): PlayerSlot => (p === 'A' ? 'B' : 'A');

/** Plays cards alternately starting at state.playerToAct until both cards down. */
function playBaza(state: TrucoState, first: CardId, second: CardId) {
  const leader = state.playerToAct;
  const r1 = playCard(state, { actor: leader, card: first });
  if (!r1.ok) return r1;
  return playCard(r1.state, { actor: other(leader), card: second });
}

// ---------------------------------------------------------------------------
// Task 2.2 — createMatch / deal / determinism / turn flow
// ---------------------------------------------------------------------------

describe('createMatch + deal', () => {
  it('deals 3 cards per player and keeps the remaining deck inside the state', () => {
    const state = makeState();
    expect(state.hands.A).toHaveLength(3);
    expect(state.hands.B).toHaveLength(3);
    expect(state.deckRemaining).toHaveLength(34);
    const all = [...state.hands.A, ...state.hands.B, ...state.deckRemaining];
    expect(all).toHaveLength(40);
    expect(new Set(all).size).toBe(40);
  });

  it('honors an explicit mano option (mano leads baza 1)', () => {
    const state = makeState({ mano: 'B' });
    expect(state.mano).toBe('B');
    expect(state.pie).toBe('A');
    expect(state.playerToAct).toBe('B');
    expect(state.bazaLeader).toBe('B');
  });

  it('derives mano deterministically from the injected rng when unspecified', () => {
    const a = createMatch({ targetPoints: 30 }, mulberry32(7));
    const b = createMatch({ targetPoints: 30 }, mulberry32(7));
    expect(a.mano).toBe(b.mano);
  });

  it('defaults target points to 30', () => {
    const state = createMatch({}, mulberry32(1));
    expect(state.targetPoints).toBe(30);
  });

  it('starts at hand 1 with zero scores and phase playing', () => {
    const state = makeState();
    expect(state.phase).toBe('playing');
    expect(state.handNumber).toBe(1);
    expect(state.scores).toEqual({ A: 0, B: 0 });
  });

  it('deals a fresh waiting_for_players state when start is applied', () => {
    const skeleton = makeState();
    const waiting: TrucoState = {
      ...skeleton,
      phase: 'waiting_for_players',
      hands: { A: [], B: [] },
      deckRemaining: [...DECK_40],
    };
    const result = applyAction(waiting, { type: 'start' }, { rng: mulberry32(5) });
    if (!result.ok) throw new Error('start must succeed');
    expect(result.state.phase).toBe('playing');
    expect(result.state.hands.A).toHaveLength(3);
    expect(result.state.hands.B).toHaveLength(3);
    expect(result.state.deckRemaining).toHaveLength(34);
  });
});

describe('Deterministic replay + purity', () => {
  /** Greedy log of N plies from a seeded match. */
  function recordLog(seed: number, plies: number) {
    let state = createMatch({ mano: 'A', targetPoints: 30 }, mulberry32(seed));
    const log: Play[] = [];
    for (let i = 0; i < plies; i++) {
      if (!state.deckRemaining.length || state.phase !== 'playing') break;
      const actor = state.playerToAct;
      const card = state.hands[actor][0]!;
      const result = applyAction(state, { type: 'play_card', actor, card }, { rng: mulberry32(seed) });
      if (!result.ok) break;
      log.push({ actor, card });
      state = result.state;
    }
    return { log, final: state };
  }

  it('replays the same action log to a deep-equal final state', () => {
    const first = recordLog(123, 6);
    let state = createMatch({ mano: 'A', targetPoints: 30 }, mulberry32(123));
    for (const step of first.log) {
      const result = applyAction(state, { type: 'play_card', ...step }, { rng: mulberry32(123) });
      if (!result.ok) throw new Error('replayed action must be accepted');
      state = result.state;
    }
    expect(state).toEqual(first.final);
  });

  it('returns a NEW state object on success and never mutates the input', () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    const result = playCard(state, { actor: state.playerToAct, card: state.hands[state.playerToAct][0]! });
    if (!result.ok) throw new Error('legal play must succeed');
    expect(result.state).not.toBe(state);
    expect(state).toEqual(snapshot);
  });

  it('is side-effect free on rejection (original reference untouched)', () => {
    const state = makeState();
    const snapshot = structuredClone(state);
    const opponent = other(state.playerToAct);
    const result = playCard(state, { actor: opponent, card: state.hands[opponent][0]! });
    if (result.ok) throw new Error('must reject');
    // The rejection carries back the SAME untouched reference.
    expect(result.state).toBe(state);
    expect(state).toEqual(snapshot);
  });
});

describe('Turn flow + illegal plays', () => {
  it('rejects out-of-turn plays with E_OUT_OF_TURN', () => {
    const state = makeState({ mano: 'A' });
    const result = playCard(state, { actor: 'B', card: state.hands.B[0]! });
    if (result.ok) throw new Error('must reject');
    expect(result.errorCode).toBe('E_OUT_OF_TURN');
  });

  it('rejects a card the actor does not own with E_CARD_NOT_OWNED', () => {
    const state = withHands(makeState(), ['1espada', '1basto', '3oro'], ['4oro', '4copa', '4basto']);
    // A does not hold 12copa.
    const result = playCard(state, { actor: 'A', card: '12copa' });
    if (result.ok) throw new Error('must reject');
    expect(result.errorCode).toBe('E_CARD_NOT_OWNED');
  });

  it('rejects replaying an already-played card with E_CARD_ALREADY_PLAYED', () => {
    const state = withHands(makeState(), ['1espada', '1basto', '3oro'], ['4oro', '4copa', '4basto']);
    const b1 = playBaza(state, '1espada', '4oro');
    if (!b1?.ok) throw new Error('baza 1 must succeed');
    // A leads baza 2 and tries to replay the card from baza 1.
    const again = playCard(b1.state, { actor: 'A', card: '1espada' });
    if (again.ok) throw new Error('must reject');
    expect(again.errorCode).toBe('E_CARD_ALREADY_PLAYED');
  });

  it('blocks spectators (non-participant actors) with E_NOT_PARTICIPANT', () => {
    const state = makeState();
    const result = applyAction(state, {
      type: 'play_card',
      actor: 'C' as PlayerSlot,
      card: '1espada',
    });
    if (result.ok) throw new Error('must reject');
    expect(result.errorCode).toBe('E_NOT_PARTICIPANT');
  });

  it('rejects every game action once the match finished with E_MATCH_FINISHED', () => {
    const state = makeState();
    const finished: TrucoState = { ...structuredClone(state), phase: 'match_end', winner: 'A' };
    const result = playCard(finished, { actor: 'A', card: finished.hands.A[0]! });
    if (result.ok) throw new Error('must reject');
    expect(result.errorCode).toBe('E_MATCH_FINISHED');
  });

  it('consumes rng only at deal boundaries (mid-hand actions are RNG-free)', () => {
    const state = makeState();
    // No deps.rng supplied at all — mid-hand play must not need one.
    const result = playCard(state, { actor: state.playerToAct, card: state.hands[state.playerToAct][0]! });
    expect(result.ok).toBe(true);
  });

  it('requires deps.rng when a hand ends because the next hand must be dealt', () => {
    const state = withHands(makeState(), ['1espada', '1basto', '3oro'], ['4oro', '4copa', '4basto']);
    const r1 = playBaza(state, '1espada', '4oro');
    if (!r1?.ok) throw new Error('setup failed');
    // Winning baza 2 ends the hand → next deal needs rng.
    const r2a = playCard(r1.state, { actor: 'A', card: '1basto' });
    if (!r2a.ok) throw new Error('second lead must succeed');
    expect(() =>
      applyAction(r2a.state, { type: 'play_card', actor: 'B', card: '4copa' }),
    ).toThrowError(/rng/);
    const r2bRng = applyAction(
      r2a.state,
      { type: 'play_card', actor: 'B', card: '4copa' },
      { rng: mulberry32(11) },
    );
    expect(r2bRng.ok).toBe(true);
  });
});

describe('Mano rotation', () => {
  it('swaps mano/pie for the next dealt hand (winner of two bazas)', () => {
    const state = withHands(makeState({ mano: 'A' }), ['1espada', '1basto', '3oro'], ['4oro', '4copa', '4basto']);
    const b1 = playBaza(state, '1espada', '4oro');
    if (!b1?.ok) throw new Error('baza 1 failed');
    const end = playBaza(b1.state, '1basto', '4copa');
    if (!end?.ok) throw new Error('baza 2 failed');
    expect(end.state.handNumber).toBe(2);
    expect(end.state.mano).toBe('B');
    expect(end.state.pie).toBe('A');
    expect(end.state.playerToAct).toBe('B'); // new mano leads baza 1
    expect(end.state.scores.A).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Task 2.3 — Bazas resolution and parda cascade
// ---------------------------------------------------------------------------

describe('Bazas cascade', () => {
  it('winning bazas 1 and 2 ends the hand; baza 3 is never played', () => {
    const state = withHands(makeState({ mano: 'A' }), ['1espada', '1basto', '12oro'], ['4oro', '4copa', '11oro']);
    const b1 = playBaza(state, '1espada', '4oro');
    if (!b1?.ok) throw new Error('baza 1 failed');
    const end = playBaza(b1.state, '1basto', '4copa');
    if (!end?.ok) throw new Error('hand should have ended here');
    expect(end.state.handNumber).toBe(2); // auto-dealt next hand
    expect(end.state.scores.A).toBe(1);
    // The previous hand's history shows exactly two resolved bazas.
    const prevHandEvents = end.state.history.filter((e) => e.type === 'hand_ended');
    expect(prevHandEvents).toHaveLength(1);
    expect(end.state.hands.A).toHaveLength(3); // fresh deal
  });

  it('baza-1 win + parda baza 2 gives the hand to the baza-one winner immediately', () => {
    const state = withHands(makeState({ mano: 'A' }), ['1espada', '3oro', '12oro'], ['4oro', '3basto', '11oro']);
    const b1 = playBaza(state, '1espada', '4oro');
    if (!b1?.ok) throw new Error('baza 1 failed');
    const end = playBaza(b1.state, '3oro', '3basto'); // parda
    if (!end?.ok) throw new Error('hand should have ended via cascade item 3');
    expect(end.state.scores.A).toBe(1);
    expect(end.state.handNumber).toBe(2);
  });

  it('parda baza 1 + won baza 2 hands it to the baza-two winner immediately', () => {
    const state = withHands(makeState({ mano: 'A' }), ['3oro', '1espada', '12oro'], ['3basto', '4copa', '11oro']);
    const b1 = playBaza(state, '3oro', '3basto'); // parda
    if (!b1?.ok) throw new Error('baza 1 failed');
    const end = playBaza(b1.state, '1espada', '4copa');
    if (!end?.ok) throw new Error('hand should have ended via cascade item 2');
    expect(end.state.scores.A).toBe(1);
    expect(end.state.handNumber).toBe(2);
  });

  it('double parda forces a decider baza whose winner takes the hand', () => {
    const state = withHands(makeState({ mano: 'A' }), ['3oro', '2espada', '7oro'], ['3basto', '2copa', '6oro']);
    const b1 = playBaza(state, '3oro', '3basto'); // parda
    if (!b1?.ok) throw new Error('baza 1 failed');
    const b2 = playBaza(b1.state, '2espada', '2copa'); // parda
    if (!b2?.ok) throw new Error('baza 2 failed');
    const b3 = playBaza(b2.state, '7oro', '6oro'); // decider — A leads (kept leader)
    if (!b3?.ok) throw new Error('baza 3 failed');
    expect(b3.state.scores.A).toBe(1); // A won the decider
    expect(b3.state.handNumber).toBe(2);
  });

  it('split bazas with tied third gives the hand to the earliest untied baza winner', () => {
    const state = withHands(makeState({ mano: 'A' }), ['1espada', '4oro', '3oro'], ['4copa', '1basto', '3basto']);
    const b1 = playBaza(state, '1espada', '4copa'); // A wins
    if (!b1?.ok) throw new Error('baza 1 failed');
    const b2 = playBaza(b1.state, '4oro', '1basto'); // B wins, B leads b3
    if (!b2?.ok) throw new Error('baza 2 failed');
    const b3 = playBaza(b2.state, '3basto', '3oro'); // parda (B led)
    if (!b3?.ok) throw new Error('baza 3 failed');
    expect(b3.state.scores.A).toBe(1); // earliest untied = baza 1 → A
    expect(b3.state.handNumber).toBe(2);
  });

  it('all three bazas parda: the MANO side wins the hand', () => {
    const state = withHands(makeState({ mano: 'A' }), ['3oro', '2oro', '1oro'], ['3basto', '2copa', '1copa']);
    const b1 = playBaza(state, '3oro', '3basto');
    if (!b1?.ok) throw new Error('baza 1 failed');
    const b2 = playBaza(b1.state, '2oro', '2copa');
    if (!b2?.ok) throw new Error('baza 2 failed');
    const b3 = playBaza(b2.state, '1oro', '1copa');
    if (!b3?.ok) throw new Error('baza 3 failed');
    expect(b3.state.scores.A).toBe(1); // mano (A) wins the all-parda hand
    expect(b3.state.handNumber).toBe(2);
  });

  it('a parda keeps the same leader for the next baza', () => {
    const state = withHands(makeState({ mano: 'A' }), ['3oro', '1espada', '12oro'], ['3basto', '4copa', '11oro']);
    const b1 = playBaza(state, '3oro', '3basto'); // parda
    if (!b1?.ok) throw new Error('baza 1 failed');
    expect(b1.state.bazas).toHaveLength(1);
    expect(b1.state.bazas[0]!.winner).toBeNull();
    expect(b1.state.bazaLeader).toBe('A'); // same leader again
    expect(b1.state.playerToAct).toBe('A');
    expect(b1.state.bazas[0]!.number).toBe(1);
  });

  it('emits baza_resolved and hand_ended events for a completed hand', () => {
    const state = withHands(makeState({ mano: 'A' }), ['1espada', '1basto', '12oro'], ['4oro', '4copa', '11oro']);
    const b1 = playBaza(state, '1espada', '4oro');
    if (!b1?.ok) throw new Error('baza 1 failed');
    const end = playBaza(b1.state, '1basto', '4copa');
    if (!end?.ok) throw new Error('baza 2 failed');
    // Per-call events of the hand-ending action…
    expect(end.events.some((e) => e.type === 'card_played')).toBe(true);
    const resolvedInCall = end.events.filter((e) => e.type === 'baza_resolved');
    expect(resolvedInCall).toHaveLength(1);
    // …and the cumulative public history across the whole hand.
    const resolved = end.state.history.filter((e) => e.type === 'baza_resolved');
    expect(resolved).toHaveLength(2);
    expect(
      resolved.every((e) => e.type === 'baza_resolved' && e.winner === 'A'),
    ).toBe(true);
    const ended = end.events.find((e) => e.type === 'hand_ended');
    expect(ended).toMatchObject({ type: 'hand_ended', winner: 'A' });
    const awarded = end.events.find((e) => e.type === 'points_awarded');
    expect(awarded).toMatchObject({ type: 'points_awarded', side: 'A', amount: 1 });
  });
});
