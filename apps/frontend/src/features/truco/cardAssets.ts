import type { CardId, Suit } from '@geotano/shared';

/**
 * Single source of truth for Spanish-deck card artwork.
 *
 * Every card surface in the UI resolves its image EXCLUSIVELY through
 * `cardAssetUrl` / `CARD_BACK_URL` from this module — no scattered asset
 * paths anywhere else.
 *
 * WHY WEBP: the official SVG sources embed base64 RASTER artwork (~69 MB raw),
 * so shipping them verbatim would put tens of MB into the bundle. The WebP
 * derivatives are rasterized from those same SVGs at 400–480px width (cards
 * render between ~44px and ~150px CSS px) with quality 82, preserving the
 * visible design exactly while keeping the whole set ≈1.2 MB. The original
 * SVG files remain in the repo untouched as the visual source of truth.
 *
 * Asset naming: `webp/card_{clubs|coins|cups|swords}_{rank}.webp` with
 * zero-padded two-digit ranks. Suit mapping is FIXED by convention:
 *   basto → clubs · oro → coins · copa → cups · espada → swords
 *
 * Only game ranks are imported. The physical Spanish deck deals 1–7 and
 * 10–12 per suit (40 cards); ranks 08/09 exist as files but are never dealt,
 * so they are deliberately NOT imported (keeps them out of the build).
 */

/* ─── Eager URL imports (?url) — resolved at build time, zero runtime fetch ── */

import backUrl from '../../assets/spanish-playing-cards-svg-main/webp/card_back.webp?url';

// Bastos → clubs
import basto01 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_01.webp?url';
import basto02 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_02.webp?url';
import basto03 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_03.webp?url';
import basto04 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_04.webp?url';
import basto05 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_05.webp?url';
import basto06 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_06.webp?url';
import basto07 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_07.webp?url';
import basto10 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_10.webp?url';
import basto11 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_11.webp?url';
import basto12 from '../../assets/spanish-playing-cards-svg-main/webp/card_clubs_12.webp?url';

// Oros → coins
import oro01 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_01.webp?url';
import oro02 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_02.webp?url';
import oro03 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_03.webp?url';
import oro04 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_04.webp?url';
import oro05 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_05.webp?url';
import oro06 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_06.webp?url';
import oro07 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_07.webp?url';
import oro10 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_10.webp?url';
import oro11 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_11.webp?url';
import oro12 from '../../assets/spanish-playing-cards-svg-main/webp/card_coins_12.webp?url';

// Copas → cups
import copa01 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_01.webp?url';
import copa02 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_02.webp?url';
import copa03 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_03.webp?url';
import copa04 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_04.webp?url';
import copa05 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_05.webp?url';
import copa06 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_06.webp?url';
import copa07 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_07.webp?url';
import copa10 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_10.webp?url';
import copa11 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_11.webp?url';
import copa12 from '../../assets/spanish-playing-cards-svg-main/webp/card_cups_12.webp?url';

// Espadas → swords
import espada01 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_01.webp?url';
import espada02 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_02.webp?url';
import espada03 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_03.webp?url';
import espada04 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_04.webp?url';
import espada05 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_05.webp?url';
import espada06 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_06.webp?url';
import espada07 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_07.webp?url';
import espada10 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_10.webp?url';
import espada11 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_11.webp?url';
import espada12 from '../../assets/spanish-playing-cards-svg-main/webp/card_swords_12.webp?url';

/** Ranks that actually exist in the imported artwork set. */
type GameRank = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '10' | '11' | '12';

const FACE_URLS: Record<Suit, Record<GameRank, string>> = {
  basto: {
    '1': basto01,
    '2': basto02,
    '3': basto03,
    '4': basto04,
    '5': basto05,
    '6': basto06,
    '7': basto07,
    '10': basto10,
    '11': basto11,
    '12': basto12,
  },
  oro: {
    '1': oro01,
    '2': oro02,
    '3': oro03,
    '4': oro04,
    '5': oro05,
    '6': oro06,
    '7': oro07,
    '10': oro10,
    '11': oro11,
    '12': oro12,
  },
  copa: {
    '1': copa01,
    '2': copa02,
    '3': copa03,
    '4': copa04,
    '5': copa05,
    '6': copa06,
    '7': copa07,
    '10': copa10,
    '11': copa11,
    '12': copa12,
  },
  espada: {
    '1': espada01,
    '2': espada02,
    '3': espada03,
    '4': espada04,
    '5': espada05,
    '6': espada06,
    '7': espada07,
    '10': espada10,
    '11': espada11,
    '12': espada12,
  },
};

const CARD_ID_PATTERN = /^(\d+)(oro|copa|espada|basto)$/;

/**
 * Resolves a game `CardId` (`{rank}{suit}`, rank ∈ 1..7|10|12) to the build
 * imported asset URL for its artwork. Throws loudly on unknown ids — a broken
 * image must never render silently.
 */
export function cardAssetUrl(cardId: CardId): string {
  const match = CARD_ID_PATTERN.exec(cardId);
  if (!match) throw new Error(`Malformed card id: ${cardId}`);
  const url = FACE_URLS[match[2] as Suit][match[1] as GameRank];
  if (!url) throw new Error(`No artwork for card id: ${cardId}`);
  return url;
}

/** Uniform printed back used for every face-down card. */
export const CARD_BACK_URL = backUrl;
