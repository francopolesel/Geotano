import { describe, it, expect, beforeEach, afterEach, vi, afterAll } from 'vitest';
import { GAME_TIMING, overrideTiming, resetTiming, reduceMotion } from '../GAME_TIMING';

describe('GAME_TIMING — single source of durations (C1)', () => {
  beforeEach(() => resetTiming());
  afterEach(() => resetTiming());

  const HARD_SLOTS = GAME_TIMING.opponentThinking.hard;

  it('exposes the exact spec durations', () => {
    expect(GAME_TIMING.cardDeal).toBe(700);
    expect(GAME_TIMING.cardPlay).toBe(350);
    expect(GAME_TIMING.trickReveal).toBe(900);
    expect(GAME_TIMING.handEnd).toBe(1200);
    expect(GAME_TIMING.betModal).toBe(220);
    expect(GAME_TIMING.opponentThinking.easy).toBe(1200);
    expect(GAME_TIMING.opponentThinking.medium).toBe(900);
    expect(GAME_TIMING.opponentThinking.hard).toEqual([1100, 1000, 900]);
  });

  it('ordering invariant: easy strictly longer than medium AND every hard slot (C3-H)', () => {
    expect(GAME_TIMING.opponentThinking.easy).toBeGreaterThan(
      GAME_TIMING.opponentThinking.medium,
    );
    for (const slot of HARD_SLOTS) {
      expect(GAME_TIMING.opponentThinking.easy).toBeGreaterThan(slot);
    }
    const maxHard = Math.max(...HARD_SLOTS);
    expect(GAME_TIMING.opponentThinking.medium).toBeLessThan(maxHard);
  });

  it('consumers observe overrideTiming patch (single source of truth, C1-A)', () => {
    overrideTiming({ cardDeal: 0 });
    expect(GAME_TIMING.cardDeal).toBe(0);
    // Unpatched keys still carry their spec default.
    expect(GAME_TIMING.cardPlay).toBe(350);
  });

  it('overrideTiming patches the opponentThinking table too', () => {
    overrideTiming({ opponentThinking: { easy: 5, medium: 4, hard: [3, 2, 1] } });
    expect(GAME_TIMING.opponentThinking.easy).toBe(5);
    expect(GAME_TIMING.opponentThinking.hard).toEqual([3, 2, 1]);
  });

  it('resetTiming restores the spec defaults after an override', () => {
    overrideTiming({ cardDeal: 0, trickReveal: 11 });
    resetTiming();
    expect(GAME_TIMING.cardDeal).toBe(700);
    expect(GAME_TIMING.trickReveal).toBe(900);
  });

  it('reduceMotion() reports the matchMedia prefers-reduced-motion state', () => {
    // Default jsdom: no matchMedia hint → false.
    expect(reduceMotion()).toBe(false);
  });
});

describe('GAME_TIMING — reduceMotion honors prefers-reduced-motion (I3)', () => {
  const original = window.matchMedia;
  afterAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = original;
  });

  it('returns true when the media query matches', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matchMedia = vi.fn().mockReturnValue({ matches: true });
    expect(reduceMotion()).toBe(true);
  });
});
