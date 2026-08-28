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
  /** Per-difficulty human-like CPU thinking delays. */
  opponentThinking: OpponentThinkingTiming;
  /** Modal entry, kept short enough to feel responsive. */
  betModal: number;
}

const DEFAULT_TIMING: GameTimingShape = {
  cardDeal: 700,
  cardPlay: 350,
  trickReveal: 900,
  handEnd: 1200,
  opponentThinking: { easy: 1200, medium: 900, hard: [1100, 1000, 900] },
  betModal: 220,
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
