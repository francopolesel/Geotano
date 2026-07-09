import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Thenable mockDb for controlled query returns ─────────────────────────────
const waitData: any[] = [];

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  innerJoin: vi.fn(),
  groupBy: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  then(resolve: (value: any) => void) {
    const data = waitData.shift();
    resolve(data !== undefined ? data : []);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));

// Mock gameModes (supports multiple mode slugs)
vi.mock('../services/gameModes.js', () => ({
  getModeConfig: vi.fn((slug: string) => {
    const configs: Record<string, any> = {
      'flag-guess': {
        slug: 'flag-guess',
        questionTypes: ['flag-to-country'],
        timerSeconds: 15,
        lives: 3,
        multiplier: 1.0,
        description: 'See the flag, guess the country',
      },
      'flag-guess-unlimited': {
        slug: 'flag-guess-unlimited',
        questionTypes: ['flag-to-country'],
        timerSeconds: 15,
        lives: 3,
        multiplier: 1.0,
        description: 'See the flag, guess the country (Unlimited)',
      },
    };
    return configs[slug] ?? configs['flag-guess'];
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

import {
  calculateScore,
  getQuestionText,
  getAnswerText,
  startSession,
  submitAnswer,
  questionPool,
  questionCache,
} from '../services/quizEngine.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────
function setupMockDb() {
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

const MOCK_COUNTRIES = [
  { id: 'c1', nameEn: 'Argentina', nameEs: 'Argentina', capitalEn: 'Buenos Aires', capitalEs: 'Buenos Aires', continent: 'South America', flagSvgUrl: 'https://example.com/ar.svg' },
  { id: 'c2', nameEn: 'Brazil', nameEs: 'Brasil', capitalEn: 'Brasília', capitalEs: 'Brasília', continent: 'South America', flagSvgUrl: 'https://example.com/br.svg' },
  { id: 'c3', nameEn: 'Chile', nameEs: 'Chile', capitalEn: 'Santiago', capitalEs: 'Santiago', continent: 'South America', flagSvgUrl: 'https://example.com/cl.svg' },
  { id: 'c4', nameEn: 'Uruguay', nameEs: 'Uruguay', capitalEn: 'Montevideo', capitalEs: 'Montevideo', continent: 'South America', flagSvgUrl: 'https://example.com/uy.svg' },
  { id: 'c5', nameEn: 'Colombia', nameEs: 'Colombia', capitalEn: 'Bogotá', capitalEs: 'Bogotá', continent: 'South America', flagSvgUrl: 'https://example.com/co.svg' },
  { id: 'c6', nameEn: 'Peru', nameEs: 'Perú', capitalEn: 'Lima', capitalEs: 'Lima', continent: 'South America', flagSvgUrl: 'https://example.com/pe.svg' },
  { id: 'c7', nameEn: 'Ecuador', nameEs: 'Ecuador', capitalEn: 'Quito', capitalEs: 'Quito', continent: 'South America', flagSvgUrl: 'https://example.com/ec.svg' },
  { id: 'c8', nameEn: 'Venezuela', nameEs: 'Venezuela', capitalEn: 'Caracas', capitalEs: 'Caracas', continent: 'South America', flagSvgUrl: 'https://example.com/ve.svg' },
];

// ─── calculateScore (pure function, no DB needed) ───────────────────────────

describe('calculateScore', () => {
  it('should return -50 for an incorrect answer', () => {
    const score = calculateScore(false, 5000, 15000, 0, 1.0);
    expect(score).toBe(-50);
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

// ─── Question text and answer text with lang param ──────────────────────────

describe('getQuestionText', () => {
  const testCountry = {
    nameEn: 'Argentina',
    nameEs: 'Argentina',
    capitalEn: 'Buenos Aires',
    capitalEs: 'Buenos Aires',
  };

  it('should return English question text when lang=en', () => {
    const text = getQuestionText(testCountry, 'flag-to-country', 'en');
    expect(text).toBe('Which country does this flag belong to?');
  });

  it('should return Spanish question text when lang=es', () => {
    const text = getQuestionText(testCountry, 'flag-to-country', 'es');
    expect(text).toBe('¿A qué país pertenece esta bandera?');
  });

  it('should fall back to English when lang is invalid', () => {
    const text = getQuestionText(testCountry, 'flag-to-country', 'invalid');
    expect(text).toBe('Which country does this flag belong to?');
  });

  it('should use nameEs in capital-to-country question when lang=es', () => {
    const country = { nameEn: 'France', nameEs: 'Francia', capitalEn: 'Paris', capitalEs: 'París' };
    const text = getQuestionText(country, 'capital-to-country', 'es');
    expect(text).toBe('París es la capital de qué país?');
  });

  it('should use nameEn in capital-to-country question when lang=en', () => {
    const country = { nameEn: 'France', nameEs: 'Francia', capitalEn: 'Paris', capitalEs: 'París' };
    const text = getQuestionText(country, 'capital-to-country', 'en');
    expect(text).toBe('Paris is the capital of which country?');
  });
});

describe('getAnswerText', () => {
  it('should return nameEn when lang=en for flag-to-country', () => {
    const country = { nameEn: 'Germany', nameEs: 'Alemania' };
    const text = getAnswerText(country, 'flag-to-country', 'en');
    expect(text).toBe('Germany');
  });

  it('should return nameEs when lang=es for flag-to-country', () => {
    const country = { nameEn: 'Germany', nameEs: 'Alemania' };
    const text = getAnswerText(country, 'flag-to-country', 'es');
    expect(text).toBe('Alemania');
  });

  it('should fall back to English when lang is invalid', () => {
    const country = { nameEn: 'Germany', nameEs: 'Alemania' };
    const text = getAnswerText(country, 'flag-to-country', 'invalid');
    expect(text).toBe('Germany');
  });

  it('should return nameEs for country-to-flag when lang=es', () => {
    const country = { nameEn: 'Spain', nameEs: 'España' };
    const text = getAnswerText(country, 'country-to-flag', 'es');
    expect(text).toBe('España');
  });

  it('should translate continent name when lang=es', () => {
    const country = { nameEn: 'Brazil', nameEs: 'Brasil', continent: 'South America' };
    const text = getAnswerText(country, 'continent', 'es');
    expect(text).toBe('Sudamérica');
  });

  it('should return English continent name when lang=en', () => {
    const country = { nameEn: 'Brazil', nameEs: 'Brasil', continent: 'South America' };
    const text = getAnswerText(country, 'continent', 'en');
    expect(text).toBe('South America');
  });
});

// ─── startSession: game mode insert path ──────────────────────────────────────

describe('startSession — mode insert path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    waitData.length = 0;
    questionPool.clear();
    questionCache.clear();
  });

  it('should insert game mode when mode is not in DB', async () => {
    // 1. gameModes select → limit(1): empty → triggers insert
    waitData.push([]);
    // 2. insert gameModes → returning(): returns the inserted mode
    waitData.push([{ id: 'mode-1' }]);
    // 3. insert gameSessions → no returning, no limit
    waitData.push(undefined);
    // 4. gameSessions select → limit(1): returns session
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, startedAt: new Date(), isActive: true,
    }]);

    // 5 POOL_INITIAL_SIZE=5 questions × 2 pickRandomCountries calls each
    for (let i = 0; i < 5; i++) {
      // correct country pick: limit(1)
      waitData.push([MOCK_COUNTRIES[i]]);
      // distractor picks: limit(3)
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const result = await startSession('user-1', 'flag-guess', 'en');

    expect(result.sessionId).toBe('session-1');
    expect(result.question).toBeDefined();
    expect(result.question).not.toHaveProperty('correctAnswer');
    expect(result.question.questionNumber).toBe(1);

    // Verify that gameModes.insert was called
    expect(mockDb.insert).toHaveBeenCalled();
    // Verify that returning() was called (only on insert)
    expect(mockDb.returning).toHaveBeenCalled();
  });
});

// ─── startSession: error when session creation fails ──────────────────────────

describe('startSession — creation failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    waitData.length = 0;
    questionPool.clear();
    questionCache.clear();
  });

  it('should throw when session select returns empty after insert', async () => {
    // 1. gameModes select → mode found
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // 2. insert gameSessions succeeds (no return value)
    waitData.push(undefined);
    // 3. gameSessions select → empty (session was NOT created, e.g. DB constraint fail)
    waitData.push([]);

    await expect(
      startSession('user-1', 'flag-guess', 'en'),
    ).rejects.toThrow(/failed to create session/i);
  });
});

// ─── startSession: error when no countries available ──────────────────────────

describe('startSession — empty batch error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    waitData.length = 0;
    questionPool.clear();
    questionCache.clear();
  });

  it('should throw when generateQuestionBatch returns empty', async () => {
    // 1. gameModes select → mode found
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // 2. insert gameSessions
    waitData.push(undefined);
    // 3. gameSessions select → returns session
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, startedAt: new Date(), isActive: true,
    }]);
    // 4. generateQuestionBatch: first pickRandomCountries returns empty → generateQuestion throws
    waitData.push([]);

    await expect(
      startSession('user-1', 'flag-guess', 'en'),
    ).rejects.toThrow(/no countries available/i);
  });
});

// ─── submitAnswer: country exhaustion treated as win in unlimited mode ─────────

describe('submitAnswer — country exhaustion win', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    waitData.length = 0;
    questionPool.clear();
    questionCache.clear();
  });

  it('should return win:true when generateQuestion throws "No countries available" in pool fallback', async () => {
    // ── startSession first ──────────────────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    waitData.push(undefined);
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, startedAt: new Date(), isActive: true,
    }]);

    // 5 pool questions
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    await startSession('user-1', 'flag-guess-unlimited', 'en');

    // Pool should have 4 questions now (Q1 was the first, 4 remain)
    // Q1 was cached, so pool has questions 2-5

    // ── submitAnswer — correct answer, depletes pool by 1 ──────────────────
    // Session select
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, isActive: true,
    }]);
    // Mode select
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    // Update session (correct answer, score=150)
    waitData.push([{
      id: 'session-1', score: 150, correctCount: 1, totalQuestions: 1,
      streakMax: 1, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    // Insert gameAnswers
    waitData.push(undefined);
    // Pool refill triggered (pool had 4 → shift one → 3, threshold is 2, so 3 >= 2, no refill)
    // Actually: pool was [Q2,Q3,Q4,Q5], shift gives Q2, pool=[Q3,Q4,Q5], length=3 >= 2 → no refill
    // Next question is Q2 from pool, need to push its expected data:
    // (no more DB calls needed for existing pool — it's already in questionPool)

    const answer1 = await submitAnswer('session-1', 'user-1', 'Argentina', 5000, 'en');

    expect(answer1.correct).toBe(true);
    expect(answer1.score).toBeGreaterThan(0);
    expect(answer1.nextQuestion).toBeDefined();
    expect(answer1.result).toBeUndefined();

    // ── Second answer — clear pool to force fallback path ──────────────────
    questionPool.set('session-1', []);

    // Session select
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 150, correctCount: 1, totalQuestions: 1,
      streakMax: 1, isActive: true,
    }]);
    // Mode select
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    // Update session (correct again, score=300)
    waitData.push([{
      id: 'session-1', score: 300, correctCount: 2, totalQuestions: 2,
      streakMax: 2, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    // Insert answer
    waitData.push(undefined);
    // Pool is empty → fallback path: prevAnswers query
    waitData.push([]); // prevAnswers returns empty
    // Fallback generateQuestion: pickRandomCountries(1) returns empty → throws "No countries available"
    waitData.push([]);

    const answer2 = await submitAnswer('session-1', 'user-1', 'Argentina', 5000, 'en');

    // Should be treated as win in unlimited mode
    expect(answer2.win).toBe(true);
    expect(answer2.result).toBeDefined();
    expect(answer2.result!.totalScore).toBe(300);
    expect(answer2.result!.totalQuestions).toBe(2);
    expect(answer2.result!.gameModeSlug).toBe('flag-guess-unlimited');
    expect(answer2.nextQuestion).toBeUndefined();
    // Cache and pool should be cleaned up
    expect(questionCache.has('session-1')).toBe(false);
    expect(questionPool.has('session-1')).toBe(false);
  });
});

// ─── refillPool: catch block silently logs errors ──────────────────────────────

describe('refillPool — silent error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    waitData.length = 0;
    questionPool.clear();
    questionCache.clear();
  });

  it('should not propagate when refillPool DB query throws', async () => {
    // ── startSession ──────────────────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, startedAt: new Date(), isActive: true,
    }]);

    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    await startSession('user-1', 'flag-guess', 'en');

    // Verify pool has 4 questions after startSession
    expect(questionPool.get('session-1')!.length).toBe(4);

    // Clear pool to trigger fallback (pool empty after shift)
    // Actually: with pool of 4, shift 1 → 3, threshold is 2 → no refill
    // We need POOL_REFILL_THRESHOLD check to trigger refill.
    // Start with fewer pool questions: only put 1 question in pool
    // so after shifting it, currentPool is empty (< threshold)
    questionPool.set('session-1', []); // empty → triggers refill on next answer

    // ── submitAnswer ────────────────────────────────────────────────────
    // Session select
    waitData.push([{
      id: 'session-1', gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, isActive: true,
    }]);
    // Mode select
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // Update session (correct)
    waitData.push([{
      id: 'session-1', score: 150, correctCount: 1, totalQuestions: 1,
      streakMax: 1, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    // Insert answer
    waitData.push(undefined);
    // Fallback: prevAnswers
    waitData.push([]);
    // Fallback: generateQuestion → pickRandomCountries(1) returns a country
    waitData.push([MOCK_COUNTRIES[0]]);
    // Fallback: distractors
    waitData.push(MOCK_COUNTRIES.slice(1, 4));

    // After submitAnswer finishes the fallback path, it checks pool:
    // Pool is empty (< threshold) → triggers fire-and-forget refillPool
    // refillPool does: await db.select().from(gameAnswers).where(...)
    // This calls mockDb.then → we push a rejected promise to waitData
    // so that resolve(rejectedPromise) makes the outer await reject.
    waitData.push(Promise.reject(new Error('DB connection lost')));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const answer = await submitAnswer('session-1', 'user-1', 'Argentina', 5000, 'en');

    // Should succeed despite refill failure
    expect(answer.correct).toBe(true);
    expect(answer.nextQuestion).toBeDefined();
    expect(answer.nextQuestion!.questionNumber).toBe(2);

    // Wait for microtask queue to drain (refillPool is fire-and-forget,
    // its async body runs after submitAnswer's synchronous tail returns.
    // The await inside refillPool schedules a microtask.)
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify the error was logged (refillPool caught and logged)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[refillPool] Failed to refill question pool:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
