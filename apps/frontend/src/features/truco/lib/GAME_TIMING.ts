// ---------------------------------------------------------------------------
// GAME_TIMING — single source of all pacing durations (spec C1)
// ---------------------------------------------------------------------------
// Every table/sequencer/CPU delay is read from this module; no component or
// hook hardcodes a phase duration. `overrideTiming`/`resetTiming` let tests
// collapse wall-clock waits to zero deterministically.

export interface OpponentThinkingTiming {
  easy: number;
  medium: number;
  hard: readonly [number, number, number];
}

export interface GameTimingShape {
  /** Pause before the deal sequence completes and cards become playable. */
  cardDeal: number;
  /** Card lands in the active baza before control proceeds. */
  cardPlay: number;
  /** Baza winner reveal before the next baza activates. */
  trickReveal: number;
  /** Hand-end pause before the result is understood. */
  handEnd: number;
  /** Time to show final baza before hand-end modal opens. */
  handEndDisplay: number;
  /** Per-difficulty human-like CPU thinking delays. */
  opponentThinking: OpponentThinkingTiming;
  /** Modal entry, kept short enough to feel responsive. */
  betModal: number;
}

const DEFAULT_TIMING: GameTimingShape = {
  cardDeal: 1000,
  cardPlay: 500,
  trickReveal: 1200,
  handEnd: 1500,
  handEndDisplay: 2500,
  opponentThinking: { easy: 1500, medium: 1200, hard: [1400, 1300, 1200] },
  betModal: 300,
};

/** Live, mutable module-level copy so `overrideTiming` is observed everywhere. */
let current: GameTimingShape = structuredClone(DEFAULT_TIMING);

/** Current pacing durations. Mutated by `overrideTiming`; restored by `resetTiming`. */
export const GAME_TIMING: GameTimingShape = current;

/** Sets one or more durations on the live copy (single source of truth). */
export function overrideTiming(patch: Partial<GameTimingShape>): void {
  current = { ...current, ...patch };
  // Keep the exported binding pointed at the mutated object.
  Object.assign(GAME_TIMING, current);
}

/** Restores every duration to its spec default. */
export function resetTiming(): void {
  current = structuredClone(DEFAULT_TIMING);
  Object.assign(GAME_TIMING, current);
}

/** True when the user prefers reduced motion (honors GAME_TIMING zeroing). */
export function reduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
