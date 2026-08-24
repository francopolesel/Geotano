import { describe, it, expect } from 'vitest';
import type { TrucoPublicContext } from '@geotano/shared';
import { isAwaitingOpponent } from '../turnQuery';

// ---------------------------------------------------------------------------
// Remediation #14a — ONE shared turn-query rule for "the rival owes the next
// move". Previously the same ternary chain was duplicated in TrucoTable and
// useTruCpuGame; this suite pins the single source so both surfaces can never
// drift apart.
// ---------------------------------------------------------------------------

function baseContext(overrides: Partial<TrucoPublicContext> = {}): TrucoPublicContext {
  return {
    phase: 'playing',
    playerToAct: 'A',
    mano: 'A',
    targetPoints: 30,
    scores: { A: 0, B: 0 },
    bazaNumber: 1,
    bazaLeader: 'A',
    openBazaPlays: [],
    cardsPlayedThisHand: 0,
    myHand: ['1espada'],
    opponentHandCount: 3,
    envidoAwaiting: null,
    trucoAwaiting: null,
    trucoAcceptedThisHand: false,
    envidoClosed: false,
    acceptedTrucoLevel: 1,
    ...overrides,
  };
}

describe('isAwaitingOpponent', () => {
  it('is true while a bet awaits the OTHER seat (envido)', () => {
    const ctx = baseContext({
      phase: 'envido_betting',
      playerToAct: 'A',
      envidoAwaiting: { responder: 'B', falta: false, realRaised: false },
    });
    expect(isAwaitingOpponent(ctx, 'A')).toBe(true);
  });

  it('is false when MY seat owes the bet answer (envido)', () => {
    const ctx = baseContext({
      phase: 'envido_betting',
      playerToAct: 'A',
      envidoAwaiting: { responder: 'A', falta: false, realRaised: false },
    });
    expect(isAwaitingOpponent(ctx, 'A')).toBe(false);
  });

  it('envido awaiting outranks the truco chain in the same context', () => {
    // Parked-truco states can carry both projections; envido wins first.
    const ctx = baseContext({
      phase: 'truco_betting',
      envidoAwaiting: { responder: 'A', falta: false, realRaised: false },
      trucoAwaiting: { responder: 'A', level: 2 },
    });
    expect(isAwaitingOpponent(ctx, 'A')).toBe(false);
  });

  it('is true while a truco bet awaits the OTHER seat', () => {
    const ctx = baseContext({
      phase: 'truco_betting',
      playerToAct: 'A',
      trucoAwaiting: { responder: 'B', level: 2 },
    });
    expect(isAwaitingOpponent(ctx, 'A')).toBe(true);
  });

  it('is false when MY seat owes the truco answer', () => {
    const ctx = baseContext({
      phase: 'truco_betting',
      playerToAct: 'A',
      trucoAwaiting: { responder: 'A', level: 2 },
    });
    expect(isAwaitingOpponent(ctx, 'A')).toBe(false);
  });

  it('falls back to card-play turn order while plain playing', () => {
    expect(isAwaitingOpponent(baseContext({ playerToAct: 'B' }), 'A')).toBe(true);
    expect(isAwaitingOpponent(baseContext({ playerToAct: 'A' }), 'A')).toBe(false);
  });

  it('is false outside live play (hand_end / match_end owe nobody)', () => {
    expect(isAwaitingOpponent(baseContext({ phase: 'match_end' }), 'A')).toBe(false);
    expect(isAwaitingOpponent(baseContext({ phase: 'hand_end' }), 'A')).toBe(false);
  });
});
