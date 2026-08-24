import type { CardId } from '@geotano/shared';
import { TIER_TABLE } from '@geotano/shared';
import type { StrengthHint } from '../../components/game/PlayingCard';

/**
 * Maps the engine's normative tier (14 strongest … 1 weakest) onto a
 * three-bucket presentation hint. Presentation-only: never shows numbers.
 *   strong  — tiers 10-14 (matadores, threes): sure winners
 *   medium  — tiers 6-9 (twos, anchos falsos, figuras altas)
 *   weak    — tiers 1-5 (low cards)
 */
export function cardStrengthHint(card: CardId): StrengthHint {
  const tier = TIER_TABLE[card];
  if (tier >= 10) return 'strong';
  if (tier >= 6) return 'medium';
  return 'weak';
}
