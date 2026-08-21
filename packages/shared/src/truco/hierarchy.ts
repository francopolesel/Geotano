// ---------------------------------------------------------------------------
// Truco Argentino — card strength hierarchy (normative total order)
// ---------------------------------------------------------------------------
import type { CardId } from './types.js';

/** Strength tier: 14 (strongest) down to 1 (weakest). */
export type CardTier =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/**
 * Normative tier table (spec: "Card hierarchy total order").
 * Tier 14 `1espada` · 13 `1basto` · 12 `7espada` · 11 `7oro`
 * 10 all threes · 9 all twos · 8 {1oro,1copa} (anchos falsos) · 7 all twelves
 * 6 all elevens · 5 all tens · 4 {7copa,7basto} (sietes falsos)
 * 3 all sixes · 2 all fives · 1 all fours.
 */
export const TIER_TABLE: Record<CardId, CardTier> = {
  // Tier 14
  '1espada': 14,
  // Tier 13
  '1basto': 13,
  // Tier 12
  '7espada': 12,
  // Tier 11
  '7oro': 11,
  // Tier 10 — all threes
  '3oro': 10,
  '3copa': 10,
  '3espada': 10,
  '3basto': 10,
  // Tier 9 — all twos
  '2oro': 9,
  '2copa': 9,
  '2espada': 9,
  '2basto': 9,
  // Tier 8 — anchos falsos
  '1oro': 8,
  '1copa': 8,
  // Tier 7 — all twelves
  '12oro': 7,
  '12copa': 7,
  '12espada': 7,
  '12basto': 7,
  // Tier 6 — all elevens
  '11oro': 6,
  '11copa': 6,
  '11espada': 6,
  '11basto': 6,
  // Tier 5 — all tens
  '10oro': 5,
  '10copa': 5,
  '10espada': 5,
  '10basto': 5,
  // Tier 4 — sietes falsos
  '7copa': 4,
  '7basto': 4,
  // Tier 3 — all sixes
  '6oro': 3,
  '6copa': 3,
  '6espada': 3,
  '6basto': 3,
  // Tier 2 — all fives
  '5oro': 2,
  '5copa': 2,
  '5espada': 2,
  '5basto': 2,
  // Tier 1 — all fours
  '4oro': 1,
  '4copa': 1,
  '4espada': 1,
  '4basto': 1,
};

/** Outcome of comparing two cards in a baza. */
export type CardOutcome = 'win1' | 'win2' | 'parda';

/**
 * Compare two cards by strength tier.
 * Equal tiers are a tie (`parda`) regardless of suit.
 */
export function compareCards(a: CardId, b: CardId): CardOutcome {
  const tierA = TIER_TABLE[a];
  const tierB = TIER_TABLE[b];
  if (tierA > tierB) return 'win1';
  if (tierB > tierA) return 'win2';
  return 'parda';
}
