import { describe, expect, it } from 'vitest';
import { DECK_40, shuffle } from '../deck.js';
import { mulberry32 } from '../rng.js';
import type { CardId } from '../types.js';

const SUITS = ['oro', 'copa', 'espada', 'basto'] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

describe('Deck contents', () => {
  it('contains exactly 40 unique cards', () => {
    expect(DECK_40).toHaveLength(40);
    expect(new Set(DECK_40).size).toBe(40);
  });

  it('contains every combination of the 4 suits x ranks {1..7,10,11,12} exactly once', () => {
    const expected = SUITS.flatMap((suit) =>
      RANKS.map((rank) => `${rank}${suit}` as CardId),
    ).sort();
    expect([...DECK_40].sort()).toEqual(expected);
  });

  it('identifies cards as {rank}{suit} (e.g. 7espada) and excludes 8s/9s', () => {
    expect(DECK_40).toContain('7espada');
    expect(DECK_40).toContain('12copa');
    expect(DECK_40).not.toContain('8oro');
    expect(DECK_40).not.toContain('9espada');
    expect(DECK_40).not.toContain('espada7');
  });
});

describe('shuffle', () => {
  const deck = DECK_40;

  it('produces the identical sequence for the same seed', () => {
    const a = shuffle(deck, mulberry32(42));
    const b = shuffle(deck, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('differs across different seeds (rng is actually consumed)', () => {
    const a = shuffle(deck, mulberry32(1));
    const b = shuffle(deck, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('consumes the injected rng stream sequentially across calls', () => {
    const r1 = mulberry32(99);
    const seqA = [shuffle(deck, r1), shuffle(deck, r1)];
    const r2 = mulberry32(99);
    const seqB = [shuffle(deck, r2), shuffle(deck, r2)];
    expect(seqA).toEqual(seqB);
  });

  it('returns a permutation of the input without mutating it', () => {
    const source = [...deck];
    const snapshot = [...source];
    const out = shuffle(source, mulberry32(7));
    expect(out).toHaveLength(source.length);
    expect([...out].sort()).toEqual([...deck].sort());
    expect(source).toEqual(snapshot);
  });
});
