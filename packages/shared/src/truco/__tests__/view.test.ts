import { describe, expect, it } from 'vitest';
import { applyAction, createMatch } from '../engine.js';
import { mulberry32 } from '../rng.js';
import { buildCpuDecisionInput, buildView } from '../view.js';
import type { PlayerSlot, TrucoState } from '../types.js';

function makeState(seed = 11): TrucoState {
  return createMatch({ mano: 'A' }, mulberry32(seed));
}

const PUBLIC_KEYS = [
  'phase',
  'playerToAct',
  'mano',
  'targetPoints',
  'scores',
  'bazaNumber',
  'bazaLeader',
  'openBazaPlays',
  'cardsPlayedThisHand',
  'opponentHandCount',
  'envidoAwaiting',
  'trucoAwaiting',
  'trucoAcceptedThisHand',
  'envidoClosed',
  'acceptedTrucoLevel',
] as const;

describe('buildView — redaction', () => {
  it('own hand full, opponent hand reduced to a count', () => {
    const state = makeState();
    const viewA = buildView(state, 'A');
    expect(viewA.myHand).toEqual(state.hands.A);
    expect(viewA.opponentHandCount).toBe(state.hands.B.length);
    const viewB = buildView(state, 'B');
    expect(viewB.myHand).toEqual(state.hands.B);
    expect(viewB.opponentHandCount).toBe(state.hands.A.length);
  });

  it("opponent's unplayed card ids never appear in A's serialized view", () => {
    let state = makeState();
    // B plays one card so the rest stay hidden.
    let r = applyAction(state, { type: 'play_card', actor: 'A', card: state.hands.A[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'play_card', actor: 'B', card: r.state.hands.B[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    state = r.state;
    const serialized = JSON.stringify(buildView(state, 'A'));
    for (const hidden of state.hands.B) {
      expect(serialized).not.toContain(hidden);
    }
  });

  it('public info is identical for both viewers (deep-equal on public projection)', () => {
    const state = makeState();
    const viewA = buildView(state, 'A');
    const viewB = buildView(state, 'B');
    const project = (v: Record<string, unknown>) =>
      Object.fromEntries(PUBLIC_KEYS.map((k) => [k, v[k]]));
    expect(project(viewA as never)).toEqual(project(viewB as never));
  });

  it('settled envido showdown values are public history; unresolved bets expose no values', () => {
    const state = makeState();
    let r = applyAction(state, { type: 'sing_envido', actor: 'A' }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'quiero', actor: 'B' }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    const viewA = buildView(r.state, 'A');
    const showdown = viewA.history.find((e) => e.type === 'envido_showdown');
    expect(showdown).toBeDefined();

    // Fresh unresolved bet: no internal substate leaks through the DTO.
    const fresh = makeState(12);
    const opened = applyAction(fresh, { type: 'sing_envido', actor: 'A' }, { rng: mulberry32(2) });
    if (!opened.ok) throw new Error(opened.errorCode);
    const serialOpen = JSON.stringify(buildView(opened.state, 'B'));
    expect(serialOpen).not.toContain('"stake"');
    expect(serialOpen).not.toContain('"priorStake"');
    expect(serialOpen).not.toContain('"lastCaller"');
  });

  it('played cards with owners and bazas are visible to both viewers', () => {
    let state = makeState();
    let r = applyAction(state, { type: 'play_card', actor: 'A', card: state.hands.A[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'play_card', actor: 'B', card: r.state.hands.B[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    for (const viewer of ['A', 'B'] as const) {
      const view = buildView(r.state, viewer);
      expect(view.playedCards.A).toHaveLength(1);
      expect(view.playedCards.B).toHaveLength(1);
      expect(view.bazas).toHaveLength(1);
      expect(['A', 'B', null]).toContain(view.bazas[0]!.winner);
    }
  });

  it('match end exposes the winner in both views', () => {
    const base = makeState();
    const ended: TrucoState = { ...structuredClone(base), phase: 'match_end', winner: 'B' };
    expect(buildView(ended, 'A').winner).toBe('B');
    expect(buildView(ended, 'B').winner).toBe('B');
  });
});

describe('buildCpuDecisionInput — hard information firewall', () => {
  it('exposes exactly the whitelisted keys (no hands/deck/private substates)', () => {
    const state = makeState();
    const input = buildCpuDecisionInput(state, 'A');
    expect(Object.keys(input).sort()).toEqual(
      [
        ...PUBLIC_KEYS,
        'myHand',
        'history',
        'handNumber',
        'bazas',
        'playedCards',
        'winner',
      ].sort(),
    );
  });

  it('runtime leak probe: opponent cards and engine internals absent from serialization', () => {
    let state = makeState();
    let r = applyAction(state, { type: 'play_card', actor: 'A', card: state.hands.A[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'play_card', actor: 'B', card: r.state.hands.B[0]! }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    state = r.state;
    const input = buildCpuDecisionInput(state, 'A'); // CPU plays A → must not see B's hand
    const serial = JSON.stringify(input);
    for (const hidden of state.hands.B) {
      expect(serial).not.toContain(hidden);
    }
    expect(serial).not.toContain('"deck"');
    expect(serial).not.toContain('"hands"');
    expect(serial).not.toContain('"parkedTruco"');

    // Symmetric: CPU playing B must not see A's hidden cards either.
    const inputB = buildCpuDecisionInput(state, 'B');
    const serialB = JSON.stringify(inputB);
    for (const hidden of state.hands.A) {
      expect(serialB).not.toContain(hidden);
    }
  });

  it('carries decision-relevant public facts (turn, pending bet, scores, history)', () => {
    const state = makeState();
    let r = applyAction(state, { type: 'sing_truco', actor: 'A' }, { rng: mulberry32(1) });
    if (!r.ok) throw new Error(r.errorCode);
    const input = buildCpuDecisionInput(r.state, 'B');
    expect(input.playerToAct).toBe('A'); // global turn preserved
    expect(input.trucoAwaiting).toMatchObject({ responder: 'B', level: 2 });
    expect(input.scores).toBeDefined();
    expect(input.targetPoints).toBe(30);
    expect(Array.isArray(input.history)).toBe(true);
  });
});
