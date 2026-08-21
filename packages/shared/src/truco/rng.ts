// ---------------------------------------------------------------------------
// Truco Argentino — seeded RNG
// ---------------------------------------------------------------------------
import type { Rng } from './types.js';

/**
 * Deterministic mulberry32 PRNG factory.
 *
 * Same seed always yields the same number sequence, enabling reproducible
 * deals and tests. The engine never uses `Math.random` directly; randomness
 * enters exclusively through an injected `Rng`.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
