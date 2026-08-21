import { describe, expect, it } from 'vitest';
import { computeEnvido } from '../envido.js';

describe('Envido value calculation', () => {
  it('scores a same-suit pair as 20 plus suited values (figures count 0)', () => {
    // 5 + 0 (11 is a figure) + 20
    expect(computeEnvido(['5oro', '11oro', '3espada'])).toBe(25);
  });

  it('reaches the maximum 33 with 7+6 of a suit', () => {
    expect(computeEnvido(['7copa', '6copa', '1espada'])).toBe(33);
  });

  it('scores all-figure hands as zero', () => {
    expect(computeEnvido(['10oro', '11copa', '12espada'])).toBe(0);
  });

  it('drops the lowest card of a three-of-a-suit hand (Flor-less variant)', () => {
    // 6 + 3 + 20, ignoring the 2
    expect(computeEnvido(['6basto', '3basto', '2basto'])).toBe(29);
  });

  it('uses only the two best suited cards when a figure joins the pair', () => {
    // 12 counts 0, so pair value = 20 + 5
    expect(computeEnvido(['12oro', '5oro', '4espada'])).toBe(25);
  });

  it('returns the highest face value when all suits differ', () => {
    expect(computeEnvido(['12copa', '7espada', '3oro'])).toBe(7);
    expect(computeEnvido(['6oro', '5copa', '4espada'])).toBe(6);
  });

  it('counts figures as zero even as the lone highest card', () => {
    expect(computeEnvido(['12oro', '5copa', '4espada'])).toBe(5);
    expect(computeEnvido(['10basto', '11oro', '12copa'])).toBe(0);
  });
});
