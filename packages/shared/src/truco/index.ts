// ---------------------------------------------------------------------------
// Truco Argentino engine — public barrel
// ---------------------------------------------------------------------------
// S6 layering (design-gate): types/deck/hierarchy/envido/rng are foundation
// modules; this barrel is the only place that re-exports them together.

export * from './deck.js';
export * from './envido.js';
export * from './hierarchy.js';
export * from './rng.js';
export * from './types.js';
