// ---------------------------------------------------------------------------
// Truco Argentino — envido value calculation (Flor-less variant)
// ---------------------------------------------------------------------------
import type { CardId, Rank, Suit } from './types.js';

const SUITS: readonly Suit[] = ['oro', 'copa', 'espada', 'basto'];
const CARD_PATTERN = /^(\d{1,2})(oro|copa|espada|basto)$/;

/** Face value for envido: figures (10, 11, 12) count 0; others face value. */
function rankValue(rank: Rank): number {
  return rank >= 10 ? 0 : rank;
}

function parseCard(card: CardId): { rank: Rank; suit: Suit } {
  const match = CARD_PATTERN.exec(card);
  if (!match) {
    throw new Error(`Malformed card id: ${card}`);
  }
  return { rank: Number(match[1]) as Rank, suit: match[2] as Suit };
}

/**
 * Compute the envido value of a hand:
 * - figures (10/11/12) count 0, other ranks count face value;
 * - two or more cards sharing a suit: 20 + the TWO best suited values
 *   (with three of a suit, the two highest count);
 * - all suits different: the single highest card's value.
 */
export function computeEnvido(hand: readonly CardId[]): number {
  const suitedValues = new Map<Suit, number[]>();
  let highestStandalone = 0;

  for (const card of hand) {
    const { rank, suit } = parseCard(card);
    const value = rankValue(rank);
    highestStandalone = Math.max(highestStandalone, value);
    const list = suitedValues.get(suit) ?? [];
    list.push(value);
    suitedValues.set(suit, list);
  }

  for (const values of suitedValues.values()) {
    if (values.length >= 2) {
      const [best, secondBest] = [...values].sort((a, b) => b - a);
      return 20 + best! + secondBest!;
    }
  }

  return highestStandalone;
}
