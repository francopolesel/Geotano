// ---------------------------------------------------------------------------
// Truco Argentino — 40-card Spanish deck
// ---------------------------------------------------------------------------
import type { CardId, Rank, Rng, Suit } from './types.js';

const SUITS: readonly Suit[] = ['oro', 'copa', 'espada', 'basto'];
const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

/** The complete 40-card deck: 4 suits x ranks {1..7,10,11,12}, each once. */
export const DECK_40: readonly CardId[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => `${rank}${suit}` as CardId),
);

/**
 * Fisher-Yates shuffle consuming ONLY the injected rng.
 * Pure: returns a new array and never mutates the input.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
