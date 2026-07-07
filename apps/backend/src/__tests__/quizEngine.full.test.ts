import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Thenable mockDb pattern ─────────────────────────────────────────────────
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

// Mock gameModes
const mockModeConfigs: Record<string, any> = {
  'flag-guess': {
    slug: 'flag-guess',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the flag, guess the country',
  },
  'flag-guess-express': {
    slug: 'flag-guess-express',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the flag, guess the country (Express)',
    totalQuestions: 30,
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
vi.mock('../services/gameModes.js', () => ({
  getModeConfig: vi.fn((slug: string) => mockModeConfigs[slug] ?? mockModeConfigs['flag-guess']),
  isValidModeSlug: vi.fn(() => true),
}));

// Fixed crypto for deterministic tests
vi.mock('crypto', () => ({
  default: { randomUUID: vi.fn(() => 'mock-uuid'), randomBytes: vi.fn() },
  randomUUID: vi.fn(() => 'mock-uuid'),
}));

import { startSession, submitAnswer, questionPool } from '../services/quizEngine.js';

function setupMockDb() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
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

describe('startSession + submitAnswer integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
  });

  it('should start a session and submit a correct answer with pooled next question', async () => {
    // ── startSession DB calls ────────────────────────────────────────────
    // 1. gameModes select → limit(1)
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // 2. insert gameSessions → no limit
    waitData.push(undefined);
    // 3. gameSessions select → limit(1)
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    // For 5 questions in batch:
    // Q1: pickRandomCountries(1, [])
    waitData.push([MOCK_COUNTRIES[0]]); // Argentina
    // Q1: pickRandomCountries(3, [c1])
    waitData.push(MOCK_COUNTRIES.slice(1, 4)); // Brazil, Chile, Uruguay

    // Q2: pickRandomCountries(1, [c1])
    waitData.push([MOCK_COUNTRIES[1]]); // Brazil
    // Q2: pickRandomCountries(3, [c1, c2])
    waitData.push(MOCK_COUNTRIES.slice(2, 5)); // Chile, Uruguay, Colombia

    // Q3: pickRandomCountries(1, [c1, c2])
    waitData.push([MOCK_COUNTRIES[2]]); // Chile
    // Q3: pickRandomCountries(3, [c1, c2, c3])
    waitData.push(MOCK_COUNTRIES.slice(3, 6)); // Uruguay, Colombia, Peru

    // Q4: pickRandomCountries(1, [c1, c2, c3])
    waitData.push([MOCK_COUNTRIES[3]]); // Uruguay
    // Q4: pickRandomCountries(3, [c1, c2, c3, c4])
    waitData.push(MOCK_COUNTRIES.slice(4, 7)); // Colombia, Peru, Ecuador

    // Q5: pickRandomCountries(1, [c1, c2, c3, c4])
    waitData.push([MOCK_COUNTRIES[4]]); // Colombia
    // Q5: pickRandomCountries(3, [c1, c2, c3, c4, c5])
    waitData.push(MOCK_COUNTRIES.slice(5, 8)); // Peru, Ecuador, Venezuela

    const result = await startSession('user-1', 'flag-guess', 'en');

    expect(result.sessionId).toBeDefined();
    expect(result.question).toBeDefined();
    expect(result.question).not.toHaveProperty('correctAnswer');
    expect(result.question.questionNumber).toBe(1);

    // ── submitAnswer DB calls (non-game-over) ────────────────────────────
    // 4. gameSessions select → limit(1)
    waitData.push([{ id: 'session-1', gameModeId: 'mode-1', userId: 'user-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0, isActive: true }]);
    // 5. gameModes select → limit(1)
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // 6. update gameSessions → returning()
    waitData.push([{ id: 'session-1', score: 150, correctCount: 1, totalQuestions: 1, streakMax: 1, livesRemaining: 3, isActive: true, completedAt: null }]);
    // 7. insert gameAnswers → no limit
    waitData.push(undefined);
    // 8. refillPool: gameAnswers select
    waitData.push([]);
    // 9. refillPool: 5 more questions in batch
    // Qr1: pickRandomCountries(1, ...)
    waitData.push([MOCK_COUNTRIES[5]]); // Peru
    // Qr1: pickRandomCountries(3, ...)
    waitData.push(MOCK_COUNTRIES.slice(6, 8).concat([MOCK_COUNTRIES[0]])); // Ecuador, Venezuela, Argentina (reused)
    // Qr2-r5: 4 more questions × 2 each = 8 more
    for (let i = 0; i < 4; i++) {
      waitData.push([MOCK_COUNTRIES[(i + 6) % MOCK_COUNTRIES.length]]);
      waitData.push(MOCK_COUNTRIES.slice(0, 3));
    }

    const answer = await submitAnswer('session-1', 'user-1', 'Argentina', 5000, 'en');

    // Should NOT be game over (lives remaining 3)
    expect(answer.result).toBeUndefined();
    // Score should be > 0 (correct answer + time bonus)
    expect(answer.score).toBeGreaterThan(0);
    // Should have next question from pool
    expect(answer.nextQuestion).toBeDefined();
    expect(answer.nextQuestion!.questionNumber).toBe(2);
    expect(answer.nextQuestion!).not.toHaveProperty('correctAnswer');
  });

  it('should return result when game is over (wrong answer at 1 life)', async () => {
    // ── startSession ──────────────────────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    // 5 questions
    waitData.push([MOCK_COUNTRIES[0]]);
    waitData.push(MOCK_COUNTRIES.slice(1, 4));
    waitData.push([MOCK_COUNTRIES[1]]);
    waitData.push(MOCK_COUNTRIES.slice(2, 5));
    waitData.push([MOCK_COUNTRIES[2]]);
    waitData.push(MOCK_COUNTRIES.slice(3, 6));
    waitData.push([MOCK_COUNTRIES[3]]);
    waitData.push(MOCK_COUNTRIES.slice(4, 7));
    waitData.push([MOCK_COUNTRIES[4]]);
    waitData.push(MOCK_COUNTRIES.slice(5, 8));

    await startSession('user-1', 'flag-guess', 'en');

    // ── submitAnswer — wrong answer, game over (1 life → 0) ──────────────
    waitData.push([{ id: 'session-1', gameModeId: 'mode-1', userId: 'user-1', livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0, isActive: true }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // update: isActive=false, completedAt=now
    waitData.push([{ id: 'session-1', score: 0, correctCount: 0, totalQuestions: 1, streakMax: 0, livesRemaining: 0, isActive: false, completedAt: new Date() }]);
    // insert gameAnswers
    waitData.push(undefined);

    const answer = await submitAnswer('session-1', 'user-1', 'WrongAnswer', 5000, 'en');

    expect(answer.correct).toBe(false);
    expect(answer.score).toBe(0);
    expect(answer.livesRemaining).toBe(0);
    expect(answer.result).toBeDefined();
    expect(answer.result!.totalQuestions).toBe(1);
    expect(answer.result!.totalScore).toBe(0);
    expect(answer).not.toHaveProperty('nextQuestion');
  });

  it('should throw when session is not found', async () => {
    // questionCache is empty — no session started
    await expect(
      submitAnswer('nonexistent', 'user-1', 'Argentina', 5000),
    ).rejects.toThrow(/not found/i);
  });

  it('should throw when session is completed from start', async () => {
    // Populate cache by starting a session
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);
    waitData.push([MOCK_COUNTRIES[0]]);
    waitData.push(MOCK_COUNTRIES.slice(1, 4));
    waitData.push([MOCK_COUNTRIES[1]]);
    waitData.push(MOCK_COUNTRIES.slice(2, 5));
    waitData.push([MOCK_COUNTRIES[2]]);
    waitData.push(MOCK_COUNTRIES.slice(3, 6));
    waitData.push([MOCK_COUNTRIES[3]]);
    waitData.push(MOCK_COUNTRIES.slice(4, 7));
    waitData.push([MOCK_COUNTRIES[4]]);
    waitData.push(MOCK_COUNTRIES.slice(5, 8));

    await startSession('user-1', 'flag-guess', 'en');

    // Now the DB returns no active session (isActive=false)
    waitData.push([]); // session select returns empty
    await expect(
      submitAnswer('session-1', 'user-1', 'Argentina', 5000),
    ).rejects.toThrow(/not found/i);
  });

  it('should throw for invalid session', async () => {
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);
    waitData.push([MOCK_COUNTRIES[0]]);
    waitData.push(MOCK_COUNTRIES.slice(1, 4));
    waitData.push([MOCK_COUNTRIES[1]]);
    waitData.push(MOCK_COUNTRIES.slice(2, 5));
    waitData.push([MOCK_COUNTRIES[2]]);
    waitData.push(MOCK_COUNTRIES.slice(3, 6));
    waitData.push([MOCK_COUNTRIES[3]]);
    waitData.push(MOCK_COUNTRIES.slice(4, 7));
    waitData.push([MOCK_COUNTRIES[4]]);
    waitData.push(MOCK_COUNTRIES.slice(5, 8));

    await startSession('user-1', 'flag-guess', 'en');

    // [session lookup returns empty, cache is deleted, error thrown]
    waitData.push([]);
    await expect(
      submitAnswer('session-1', 'user-1', 'Argentina', 5000),
    ).rejects.toThrow(/not found|completed/i);
  });

  it('should handle time-exceeded answer', async () => {
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);
    waitData.push([MOCK_COUNTRIES[0]]);
    waitData.push(MOCK_COUNTRIES.slice(1, 4));
    waitData.push([MOCK_COUNTRIES[1]]);
    waitData.push(MOCK_COUNTRIES.slice(2, 5));
    waitData.push([MOCK_COUNTRIES[2]]);
    waitData.push(MOCK_COUNTRIES.slice(3, 6));
    waitData.push([MOCK_COUNTRIES[3]]);
    waitData.push(MOCK_COUNTRIES.slice(4, 7));
    waitData.push([MOCK_COUNTRIES[4]]);
    waitData.push(MOCK_COUNTRIES.slice(5, 8));

    await startSession('user-1', 'flag-guess', 'en');

    // timeLimitMs is 15000, GRACE_MS is 2000, so time > 17000 is exceeded
    waitData.push([{ id: 'session-1', gameModeId: 'mode-1', userId: 'user-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0, isActive: true }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push([{ id: 'session-1', score: 0, correctCount: 0, totalQuestions: 1, streakMax: 0, livesRemaining: 2, isActive: true, completedAt: null }]);
    waitData.push(undefined);
    // Pool refill triggered (pool had 4 remaining after Q1 consumed, now at 3 after Q2 popped)
    waitData.push([]);
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i % 8]]);
      waitData.push(MOCK_COUNTRIES.slice((i + 1) % 8, (i + 4) % 8));
    }

    const answer = await submitAnswer('session-1', 'user-1', 'Argentina', 999999, 'en');

    // Time exceeded, so should be incorrect even though text matches
    expect(answer.correct).toBe(false);
    expect(answer.score).toBe(0);
  });

  it('should generate fallback question when pool is empty', async () => {
    // ── startSession ──────────────────────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    // 5 pool questions
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess', 'en');

    // ── Clear the pool to force fallback path ─────────────────────────────
    questionPool.set(session.sessionId, []);

    // ── submitAnswer DB calls ─────────────────────────────────────────────
    // Session select
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, isActive: true,
    }]);
    // Mode select
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    // Update session
    waitData.push([{
      id: session.sessionId, score: 150, correctCount: 1, totalQuestions: 1,
      streakMax: 1, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    // Insert answer
    waitData.push(undefined);
    // Fallback: prevAnswers
    waitData.push([]);
    // Fallback: pickRandomCountries(1, [...]) — correct country
    waitData.push([MOCK_COUNTRIES[6]]); // Ecuador
    // Fallback: pickRandomCountries(3, [...]) — distractors
    waitData.push(MOCK_COUNTRIES.slice(0, 3)); // Argentina, Brazil, Chile

    const answer = await submitAnswer(session.sessionId, 'user-1', 'Argentina', 5000, 'en');

    expect(answer.correct).toBe(true);
    expect(answer.score).toBeGreaterThan(0);
    expect(answer.result).toBeUndefined(); // not game over
    expect(answer.nextQuestion).toBeDefined();
    expect(answer.nextQuestion!.questionNumber).toBe(2);
    expect(answer.nextQuestion!).not.toHaveProperty('correctAnswer');

    // Pool should be empty (refill failed silently — no waitData left)
    expect(questionPool.get(session.sessionId)).toEqual([]);
  });

  it('should correct question number when pool question is desynced', async () => {
    // ── startSession ──────────────────────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    // 5 pool questions
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess', 'en');

    // ── Manipulate pool to desync question numbers ────────────────────────
    const pool = questionPool.get(session.sessionId)!;
    // Set the first pooled question to have wrong questionNumber (e.g., 99 instead of 2)
    pool[0] = { ...pool[0], questionNumber: 99 };
    questionPool.set(session.sessionId, pool);

    // ── submitAnswer ──────────────────────────────────────────────────────
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0,
      streakMax: 0, isActive: true,
    }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push([{
      id: session.sessionId, score: 150, correctCount: 1, totalQuestions: 1,
      streakMax: 1, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    waitData.push(undefined);
    // Pool refill triggered (pool had 4 after Q1, now at 3 after shifting)
    waitData.push([]);
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i % 8]]);
      waitData.push(MOCK_COUNTRIES.slice((i + 1) % 8, (i + 4) % 8));
    }

    const answer = await submitAnswer(session.sessionId, 'user-1', 'Argentina', 5000, 'en');

    // Question number should be corrected to actualQuestionNumber (totalQuestions + 1 = 2)
    expect(answer.nextQuestion).toBeDefined();
    expect(answer.nextQuestion!.questionNumber).toBe(2);
  });
});

// ─── Win detection tests ──────────────────────────────────────────────────────

describe('express mode win detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
  });

  it('should return win:true when express mode reaches 30 total questions', async () => {
    // ── startSession with express mode ────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-express' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    // 5 pool questions
    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess-express', 'en');

    // Clear pool (won't be needed — win check runs before pool pop)
    questionPool.set(session.sessionId, []);

    // ── submitAnswer — session at totalQuestions=29, correct answer → 30 ──
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 2900, correctCount: 29, totalQuestions: 29,
      streakMax: 5, isActive: true,
    }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-express' }]);
    waitData.push([{
      id: session.sessionId, score: 3050, correctCount: 30, totalQuestions: 30,
      streakMax: 6, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    waitData.push(undefined); // insert gameAnswers

    const answer = await submitAnswer(session.sessionId, 'user-1', 'Argentina', 5000, 'en');

    expect(answer.win).toBe(true);
    expect(answer.result).toBeDefined();
    expect(answer.result!.totalQuestions).toBe(30);
    expect(answer.result!.correctCount).toBe(30);
    expect(answer.nextQuestion).toBeUndefined();
    // Score should be > 0 for a correct answer
    expect(answer.score).toBeGreaterThan(0);
  });

  it('should return gameOver (not win) when express mode player loses before 30', async () => {
    // ── startSession with express mode ────────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-express' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess-express', 'en');

    // ── submitAnswer — wrong answer at 1 life → game over ─────────────────
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 5,
      streakMax: 0, isActive: true,
    }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-express' }]);
    waitData.push([{
      id: session.sessionId, score: 0, correctCount: 0, totalQuestions: 6,
      streakMax: 0, livesRemaining: 0, isActive: false, completedAt: new Date(),
    }]);
    waitData.push(undefined); // insert gameAnswers

    const answer = await submitAnswer(session.sessionId, 'user-1', 'WrongAnswer', 5000, 'en');

    expect(answer.win).toBeUndefined();
    expect(answer.livesRemaining).toBe(0);
    expect(answer.result).toBeDefined();
    expect(answer.result!.totalQuestions).toBe(6);
    expect(answer.nextQuestion).toBeUndefined();
  });
});

describe('unlimited mode win detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
  });

  it('should return win:true when unlimited mode exhausts all countries', async () => {
    // ── startSession with unlimited mode ──────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess-unlimited', 'en');

    // Clear pool to force fallback path
    questionPool.set(session.sessionId, []);

    // ── submitAnswer — pool empty, fallback fails → exhaustion win ────────
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 3, score: 500, correctCount: 5, totalQuestions: 5,
      streakMax: 3, isActive: true,
    }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    waitData.push([{
      id: session.sessionId, score: 650, correctCount: 6, totalQuestions: 6,
      streakMax: 4, livesRemaining: 3, isActive: true, completedAt: null,
    }]);
    waitData.push(undefined); // insert gameAnswers
    // Fallback: prevAnswers returns empty
    waitData.push([]);
    // Fallback generateQuestion: NO MORE waitData → all picks return []
    // After 30 attempts, throws "No countries available"

    const answer = await submitAnswer(session.sessionId, 'user-1', 'Argentina', 5000, 'en');

    expect(answer.win).toBe(true);
    expect(answer.result).toBeDefined();
    expect(answer.result!.totalQuestions).toBe(6);
    expect(answer.result!.correctCount).toBe(6);
    expect(answer.nextQuestion).toBeUndefined();
  });

  it('should return gameOver (not win) when unlimited mode player loses before exhaustion', async () => {
    // ── startSession with unlimited mode ──────────────────────────────────
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);

    for (let i = 0; i < 5; i++) {
      waitData.push([MOCK_COUNTRIES[i]]);
      waitData.push(MOCK_COUNTRIES.slice(i + 1, i + 4));
    }

    const session = await startSession('user-1', 'flag-guess-unlimited', 'en');

    // ── submitAnswer — wrong answer at 1 life → game over ─────────────────
    waitData.push([{
      id: session.sessionId, gameModeId: 'mode-1', userId: 'user-1',
      livesRemaining: 1, score: 0, correctCount: 0, totalQuestions: 3,
      streakMax: 0, isActive: true,
    }]);
    waitData.push([{ id: 'mode-1', slug: 'flag-guess-unlimited' }]);
    waitData.push([{
      id: session.sessionId, score: 0, correctCount: 0, totalQuestions: 4,
      streakMax: 0, livesRemaining: 0, isActive: false, completedAt: new Date(),
    }]);
    waitData.push(undefined); // insert gameAnswers

    const answer = await submitAnswer(session.sessionId, 'user-1', 'WrongAnswer', 5000, 'en');

    expect(answer.win).toBeUndefined();
    expect(answer.livesRemaining).toBe(0);
    expect(answer.result).toBeDefined();
    expect(answer.result!.totalQuestions).toBe(4);
    expect(answer.nextQuestion).toBeUndefined();
  });
});

describe('startSession error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
  });

  it('should throw when no countries available', async () => {
    waitData.push([{ id: 'mode-1', slug: 'flag-guess' }]);
    waitData.push(undefined);
    waitData.push([{ id: 'session-1', livesRemaining: 3, score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0 }]);
    // generate question returns empty
    waitData.push([]); // limit(1) returns empty → no countries

    await expect(
      startSession('user-1', 'flag-guess', 'en'),
    ).rejects.toThrow(/no countries available/i);
  });
});
