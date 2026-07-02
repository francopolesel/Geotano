import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB before importing quizEngine ────────────────────────────────────
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

// Mock gameModes
vi.mock('../services/gameModes.js', () => ({
  getModeConfig: vi.fn().mockReturnValue({
    slug: 'flag-guess',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the flag, guess the country',
  }),
  isValidModeSlug: vi.fn().mockReturnValue(true),
}));

// Mock crypto.randomUUID
const mockUUID = vi.hoisted(() => '550e8400-e29b-41d4-a716-446655440000');
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn().mockReturnValue(mockUUID),
    randomBytes: vi.fn(),
  },
  randomUUID: vi.fn().mockReturnValue(mockUUID),
}));

import { calculateScore } from '../services/quizEngine.js';

// ─── calculateScore (pure function, no DB needed) ───────────────────────────

describe('calculateScore', () => {
  it('should return 0 for an incorrect answer', () => {
    const score = calculateScore(false, 5000, 15000, 0, 1.0);
    expect(score).toBe(0);
  });

  it('should return base score for a correct answer with no streak', () => {
    const score = calculateScore(true, 0, 15000, 0, 1.0);
    // BASE_SCORE (100) + timeBonus (50% of 100 = 50) = 150
    expect(score).toBe(150);
  });

  it('should give a time bonus for fast answers', () => {
    const fastScore = calculateScore(true, 1000, 15000, 0, 1.0);
    const slowScore = calculateScore(true, 14000, 15000, 0, 1.0);

    // Fast: timeRatio = 1 - 1000/15000 ≈ 0.933, bonus = floor(50 * 0.933) = 46, total = 146
    // Slow: timeRatio = 1 - 14000/15000 ≈ 0.067, bonus = floor(50 * 0.067) = 3, total = 103
    expect(fastScore).toBeGreaterThan(slowScore);
  });

  it('should apply streak multiplier after 3 consecutive correct', () => {
    const score = calculateScore(true, 0, 15000, 3, 1.0);
    // Base (100) + timeBonus (50) = 150, then * 1.5 = 225
    expect(score).toBe(225);
  });

  it('should NOT apply streak multiplier below threshold', () => {
    const scoreNoStreak = calculateScore(true, 0, 15000, 0, 1.0);
    const scoreBelowThreshold = calculateScore(true, 0, 15000, 2, 1.0);

    expect(scoreNoStreak).toBe(scoreBelowThreshold);
  });

  it('should apply mode multiplier correctly', () => {
    const score = calculateScore(true, 0, 15000, 0, 1.5);
    // 150 * 1.5 = 225
    expect(score).toBe(225);
  });

  it('should never return negative score', () => {
    const score = calculateScore(true, 999999, 1000, 0, 1.0);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should combine streak multiplier with mode multiplier', () => {
    const score = calculateScore(true, 0, 15000, 4, 2.0);
    // (100 + 50) * 1.5 (streak) * 2.0 (mode) = 450
    expect(score).toBe(450);
  });
});

// ─── Scoring edge cases ─────────────────────────────────────────────────────

describe('scoring edge cases', () => {
  it('should give zero time bonus when time equals limit', () => {
    const score = calculateScore(true, 15000, 15000, 0, 1.0);
    // timeRatio = 0, so only base score (100)
    expect(score).toBe(100);
  });

  it('should give full time bonus at time 0', () => {
    const score = calculateScore(true, 0, 15000, 0, 1.0);
    // timeRatio = 1, bonus = floor(50 * 1) = 50, total = 150
    expect(score).toBe(150);
  });

  it('should reduce score to 0 with multiplier 0', () => {
    // Note: this tests edge behavior — our configs don't use 0 multiplier
    const score = calculateScore(true, 0, 15000, 5, 0);
    // (100 + 50) * 1.5 * 0 = 0
    expect(score).toBe(0);
  });
});
