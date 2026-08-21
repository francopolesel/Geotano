import { describe, expect, it } from 'vitest';
import { DECK_40 } from '../deck.js';
import { TIER_TABLE, compareCards } from '../hierarchy.js';
import type { CardId } from '../types.js';

const BRAVAS = ['1espada', '1basto', '7espada', '7oro'] as const;

describe('Card hierarchy total order', () => {
  it('assigns a tier to every card of the deck and nothing else', () => {
    expect(Object.keys(TIER_TABLE).sort()).toEqual([...DECK_40].sort());
  });

  it('keeps normative tier sizes: singles 14-11, pairs on tiers 8/4, quads elsewhere', () => {
    const byTier = new Map<number, string[]>();
    for (const [card, tier] of Object.entries(TIER_TABLE)) {
      const list = byTier.get(tier) ?? [];
      list.push(card);
      byTier.set(tier, list);
    }
    // Tier: 14..11 single; 10,9,7,6,5,3,2,1 quad; 8 and 4 double.
    expect(byTier.get(14)).toEqual(['1espada']);
    expect(byTier.get(13)).toEqual(['1basto']);
    expect(byTier.get(12)).toEqual(['7espada']);
    expect(byTier.get(11)).toEqual(['7oro']);
    for (const tier of [10, 9, 7, 6, 5, 3, 2, 1]) {
      expect(byTier.get(tier)).toHaveLength(4);
    }
    expect([...byTier.get(8)!].sort()).toEqual(['1copa', '1oro'].sort());
    expect([...byTier.get(4)!].sort()).toEqual(['7basto', '7copa'].sort());
  });

  it('bravas beat every other card in both directions', () => {
    const others = DECK_40.filter((c) => !(BRAVAS as readonly CardId[]).includes(c));
    expect(others.length).toBe(36);
    for (const brava of BRAVAS) {
      for (const other of others) {
        expect(compareCards(brava, other)).toBe('win1');
        expect(compareCards(other, brava)).toBe('win2');
      }
    }
  });

  it('treats same-tier cards as equal strength (parda)', () => {
    expect(compareCards('3oro', '3basto')).toBe('parda');
    expect(compareCards('3espada', '3copa')).toBe('parda');
    expect(compareCards('7copa', '7basto')).toBe('parda');
    expect(compareCards('1oro', '1copa')).toBe('parda');
  });

  it('ranks false anchors over twelves and sevens falseos over sixes', () => {
    expect(compareCards('1copa', '12oro')).toBe('win1');
    expect(compareCards('7copa', '6espada')).toBe('win1');
  });

  it.each([
    { higher: '1espada', lower: '1basto' }, // 14 > 13
    { higher: '1basto', lower: '7espada' }, // 13 > 12
    { higher: '7espada', lower: '7oro' }, // 12 > 11
    { higher: '7oro', lower: '3espada' }, // 11 > 10
    { higher: '3copa', lower: '2oro' }, // 10 > 9
    { higher: '2espada', lower: '1oro' }, // 9 > 8
    { higher: '1copa', lower: '12oro' }, // 8 > 7
    { higher: '12basto', lower: '11copa' }, // 7 > 6
    { higher: '11oro', lower: '10espada' }, // 6 > 5
    { higher: '10copa', lower: '7basto' }, // 5 > 4
    { higher: '7basto', lower: '6oro' }, // 4 > 3
    { higher: '6espada', lower: '5basto' }, // 3 > 2
    { higher: '5oro', lower: '4copa' }, // 2 > 1
  ])('spot row tier boundary: $higher beats $lower', ({ higher, lower }) => {
    expect(compareCards(higher as CardId, lower as CardId)).toBe('win1');
    expect(compareCards(lower as CardId, higher as CardId)).toBe('win2');
  });

  it('puts all fours at the bottom losing against everything above', () => {
    const fours = DECK_40.filter((c) => c.startsWith('4'));
    expect(fours).toHaveLength(4);
    const above = DECK_40.filter((c) => !c.startsWith('4'));
    for (const four of fours) {
      for (const other of above) {
        expect(compareCards(four, other)).toBe('win2');
      }
    }
  });
});
