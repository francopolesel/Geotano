import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng.js';

describe('mulberry32', () => {
  it('produces numbers in the [0, 1) range', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('yields equal sequences for equal seeds', () => {
    const a = mulberry32(2026);
    const b = mulberry32(2026);
    const seqA = Array.from({ length: 100 }, () => a());
    const seqB = Array.from({ length: 100 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('yields divergent sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});
