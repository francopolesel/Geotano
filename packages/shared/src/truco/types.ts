// ---------------------------------------------------------------------------
// Truco Argentino — core vocabulary types
// ---------------------------------------------------------------------------
// Leaf layer: imports NOTHING intra-module. Every other engine module may
// import from here; this file must never import from a sibling.

/** Spanish-deck suits used by the engine. */
export type Suit = 'oro' | 'copa' | 'espada' | 'basto';

/** Ranks present in the 40-card deck (8s and 9s do not exist). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

/** Card identity string in `{rank}{suit}` form, e.g. `7espada`, `12copa`. */
export type CardId = `${Rank}${Suit}`;

/** Injected pseudo-random source: returns numbers in [0, 1). */
export type Rng = () => number;
