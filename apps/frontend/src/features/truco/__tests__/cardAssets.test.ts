import { describe, it, expect } from 'vitest';
import type { CardId } from '@geotano/shared';
import { CARD_BACK_URL, cardAssetUrl } from '../cardAssets';

/**
 * Unit contract for the single source of truth of card artwork.
 * Suit mapping is FIXED: basto→clubs · oro→coins · copa→cups · espada→swords.
 */
describe('cardAssets (official Spanish-deck asset mapping)', () => {
  it('maps each game suit to its fixed asset suit family', () => {
    expect(cardAssetUrl('1basto').endsWith('webp/card_clubs_01.webp')).toBe(true);
    expect(cardAssetUrl('1oro').endsWith('webp/card_coins_01.webp')).toBe(true);
    expect(cardAssetUrl('1copa').endsWith('webp/card_cups_01.webp')).toBe(true);
    expect(cardAssetUrl('1espada').endsWith('webp/card_swords_01.webp')).toBe(true);
  });

  it('zero-pads ranks to two digits', () => {
    expect(cardAssetUrl('7espada').endsWith('webp/card_swords_07.webp')).toBe(true);
    expect(cardAssetUrl('12copa').endsWith('webp/card_cups_12.webp')).toBe(true);
  });

  it('exposes the printed back asset', () => {
    expect(CARD_BACK_URL.endsWith('webp/card_back.webp')).toBe(true);
  });

  it('throws loudly on malformed ids instead of rendering broken images', () => {
    expect(() => cardAssetUrl('' as CardId)).toThrow(/Malformed/);
    expect(() => cardAssetUrl('7oros' as CardId)).toThrow(/Malformed/);
    expect(() => cardAssetUrl('basto7' as CardId)).toThrow(/Malformed/);
  });

  it('throws on undealt ranks (08/09 exist as files but are never mapped)', () => {
    expect(() => cardAssetUrl('8copa' as CardId)).toThrow(/No artwork/);
    expect(() => cardAssetUrl('9oro' as CardId)).toThrow(/No artwork/);
  });
});
