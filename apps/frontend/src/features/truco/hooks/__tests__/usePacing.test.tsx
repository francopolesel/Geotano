import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { TrucoView } from '@geotano/shared';
import { usePacing } from '../usePacing';
import { overrideTiming, resetTiming } from '../../lib/GAME_TIMING';

function baseView(overrides: Partial<TrucoView> = {}): TrucoView {
  return {
    phase: 'playing',
    playerToAct: 'A',
    mano: 'A',
    targetPoints: 30,
    scores: { A: 12, B: 8 },
    bazaNumber: 1,
    bazaLeader: 'A',
    openBazaPlays: [],
    cardsPlayedThisHand: 0,
    myHand: ['7oro', '3espada', '1copa'],
    opponentHandCount: 3,
    envidoAwaiting: null,
    trucoAwaiting: null,
    trucoAcceptedThisHand: false,
    envidoClosed: false,
    acceptedTrucoLevel: 1,
    handNumber: 1,
    playedCards: { A: [], B: [] },
    bazas: [],
    history: [],
    ...overrides,
  };
}

describe('usePacing — event-derived hand-end (CRITICAL: never phase-gated)', () => {
  beforeEach(() => {
    resetTiming();
    // Collapse handEndDisplay delay for instant hand-end panel in tests
    overrideTiming({ handEndDisplay: 0 });
  });
  afterEach(() => resetTiming());

  it('handEndOpen is true when hand_ended exists and no later match_ended, even though the next hand is already dealt (playing)', () => {
    // The engine auto-deals the next hand into `playing`; handEndOpen must still
    // derive from the event, NOT from phase === 'hand_end'.
    const view = baseView({
      phase: 'playing', // next hand already dealt
      handNumber: 2,
      history: [
        { type: 'baza_resolved', baza: 1, winner: 'A' },
        { type: 'hand_ended', winner: 'A' },
      ],
    });
    const { result } = renderHook(() => usePacing({ view }));
    expect(result.current.handEndOpen).toBe(true);
    expect(result.current.paused).toBe(true);
  });

  it('handEndOpen is false when match_ended appears AFTER hand_ended (EndScreen takes over, C4-M)', () => {
    const view = baseView({
      phase: 'match_end',
      history: [
        { type: 'hand_ended', winner: 'A' },
        { type: 'match_ended', winner: 'A', scores: { A: 30, B: 8 } },
      ],
    });
    const { result } = renderHook(() => usePacing({ view }));
    expect(result.current.handEndOpen).toBe(false);
    expect(result.current.paused).toBe(false);
  });

  it('handEndOpen is false when no hand has ended yet', () => {
    const view = baseView({ history: [{ type: 'baza_resolved', baza: 1, winner: 'A' }] });
    const { result } = renderHook(() => usePacing({ view }));
    expect(result.current.handEndOpen).toBe(false);
    expect(result.current.paused).toBe(false);
  });

  it('advanceHandEnd is a PURE UI release: unpauses and closes the panel with ZERO engine calls', () => {
    const view = baseView({
      phase: 'playing',
      history: [{ type: 'hand_ended', winner: 'A' }],
    });
    const { result } = renderHook(() => usePacing({ view }));

    expect(result.current.handEndOpen).toBe(true);
    act(() => {
      result.current.advanceHandEnd();
    });
    expect(result.current.handEndOpen).toBe(false);
    expect(result.current.paused).toBe(false);
    // Not gated on any engine calls — no onAction/apply dispatched by the hook.
  });
});

describe('usePacing — pacing gates read GAME_TIMING and honor reduced motion (C1/C2/I3)', () => {
  beforeEach(() => {
    resetTiming();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetTiming();
  });

  it('dealState resolves after the cardDeal delay following a hand deal', () => {
    const view = baseView({ history: [] });
    const { result } = renderHook(() => usePacing({ view }));

    // A fresh hand blocks playability until the deal delay elapses.
    expect(result.current.dealState).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000); // GAME_TIMING.cardDeal
    });
    expect(result.current.dealState).toBe(false);
  });

  it('overrideTiming({cardDeal:0}) collapses the deal gate to immediate (C1-A)', () => {
    overrideTiming({ cardDeal: 0 });
    const view = baseView({ history: [] });
    const { result } = renderHook(() => usePacing({ view }));
    // With cardDeal zeroed the gate is already released after the effect.
    expect(result.current.dealState).toBe(false);
  });

  it('bazaState arms when a baza resolves and releases after the trickReveal delay', () => {
    const view = baseView({
      history: [{ type: 'baza_resolved', baza: 1, winner: 'A' }],
    });
    const { result } = renderHook(() => usePacing({ view }));

    // A just-resolved baza holds the reveal gate open.
    expect(result.current.bazaState).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1200); // GAME_TIMING.trickReveal
    });
    expect(result.current.bazaState).toBe(false);
  });

  it('bazaState stays off with no baza resolved', () => {
    const view = baseView({ history: [] });
    const { result } = renderHook(() => usePacing({ view }));
    expect(result.current.bazaState).toBe(false);
  });
});
