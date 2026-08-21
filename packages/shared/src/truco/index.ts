// ---------------------------------------------------------------------------
// Truco Argentino engine — public barrel
// ---------------------------------------------------------------------------
// S6 layering (design-gate): types/deck/hierarchy/envido/rng are foundation
// modules; state/events/errors form the middle tier; engine/legalActions/view
// sit on top. This barrel is the only place that re-exports them together.

export * from './deck.js';
export * from './envido.js';
export * from './errors.js';
export * from './events.js';
export * from './hierarchy.js';
export * from './rng.js';
export * from './state.js';
export * from './types.js';
