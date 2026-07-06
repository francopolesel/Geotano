import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../services/quizEngine.js', () => ({
  startSession: vi.fn(),
  submitAnswer: vi.fn(),
}));

vi.mock('../services/achievements.js', () => ({
  checkAchievements: vi.fn(() => Promise.reject(new Error('Achievement check failed'))),
}));

vi.mock('../services/gameModes.js', () => ({
  isValidModeSlug: vi.fn((mode: string) => ['flag-guess', 'capital-guess', 'country-by-flag', 'continent', 'free'].includes(mode)),
  getModeConfig: vi.fn(),
}));

vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request, _reply, done) => {
    (request as any).user = { userId: 'user-1' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { quizRoutes } from '../routes/quiz.js';
import { startSession, submitAnswer } from '../services/quizEngine.js';
import { isValidModeSlug } from '../services/gameModes.js';
import { checkAchievements } from '../services/achievements.js';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(quizRoutes);
  return app;
}

function mockQuestion(overrides = {}) {
  return {
    id: 'q-1',
    countryId: 'country-1',
    questionType: 'flag-to-country',
    questionText: 'Which country does this flag belong to?',
    options: ['Argentina', 'Brazil', 'Chile', 'Uruguay'],
    correctIndex: 0,
    flagUrl: 'https://example.com/flag.svg',
    timeLimitMs: 15000,
    questionNumber: 1,
    ...overrides,
  };
}

describe('GET /api/quiz/session', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when mode is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/quiz/session',
      headers: { authorization: 'Bearer token' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid mode/i);
  });

  it('should return 400 when mode is invalid', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/quiz/session?mode=invalid-mode',
      headers: { authorization: 'Bearer token' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).message).toMatch(/invalid mode/i);
  });

  it('should return 200 with sessionId and question', async () => {
    vi.mocked(startSession).mockResolvedValue({
      sessionId: 'session-1',
      question: mockQuestion(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/quiz/session?mode=flag-guess',
      headers: { authorization: 'Bearer token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('sessionId', 'session-1');
    expect(body).toHaveProperty('question');
    expect(body.question).not.toHaveProperty('correctAnswer');
  });

  it('should return 503 when no countries available', async () => {
    vi.mocked(startSession).mockRejectedValue(new Error('No countries available'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/quiz/session?mode=flag-guess',
      headers: { authorization: 'Bearer token' },
    });

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).message).toMatch(/no countries available/i);
  });

  it('should return 500 on unexpected error', async () => {
    vi.mocked(startSession).mockRejectedValue(new Error('DB connection failed'));

    const res = await app.inject({
      method: 'GET',
      url: '/api/quiz/session?mode=flag-guess',
      headers: { authorization: 'Bearer token' },
    });

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).message).toMatch(/failed to start/i);
  });
});

describe('POST /api/quiz/answer', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when sessionId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { answer: 'Argentina', timeMs: 5000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when answer is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', timeMs: 5000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when timeMs is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 200 with result and trigger achievements when game is over', async () => {
    vi.mocked(submitAnswer).mockResolvedValue({
      correct: true,
      correctAnswer: 'Argentina',
      score: 150,
      totalScore: 450,
      livesRemaining: 0,
      streak: 3,
      result: {
        totalScore: 450,
        correctCount: 3,
        totalQuestions: 5,
        streakMax: 3,
        gameModeSlug: 'flag-guess',
        completedAt: '2026-07-06T12:00:00.000Z',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('result');
    expect(body.result).toHaveProperty('totalScore', 450);
    // Achievements should be triggered when result is present
    expect(checkAchievements).toHaveBeenCalledWith('user-1');
  });

  it('should return 200 without result and without achievements when game continues', async () => {
    vi.mocked(submitAnswer).mockResolvedValue({
      correct: true,
      correctAnswer: 'Argentina',
      score: 150,
      totalScore: 150,
      livesRemaining: 3,
      streak: 1,
      nextQuestion: { ...mockQuestion({ questionNumber: 2 }), correctAnswer: undefined, optionsCountryIds: undefined },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000, lang: 'es' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).not.toHaveProperty('result');
    expect(body).toHaveProperty('nextQuestion');
    expect(body.nextQuestion.questionNumber).toBe(2);
    // lang should be passed through
    expect(submitAnswer).toHaveBeenCalledWith('s-1', 'user-1', 'Argentina', 5000, 'es');
    // No achievements when game continues
    expect(checkAchievements).not.toHaveBeenCalled();
  });

  it('should default lang to en when not provided', async () => {
    vi.mocked(submitAnswer).mockResolvedValue({
      correct: false,
      correctAnswer: 'Brazil',
      score: 0,
      totalScore: 0,
      livesRemaining: 2,
      streak: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000 },
    });

    expect(res.statusCode).toBe(200);
    expect(submitAnswer).toHaveBeenCalledWith('s-1', 'user-1', 'Argentina', 5000, 'en');
  });

  it('should return 400 when session is not found or completed', async () => {
    vi.mocked(submitAnswer).mockRejectedValue(new Error('not found'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when session is completed', async () => {
    vi.mocked(submitAnswer).mockRejectedValue(new Error('completed'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 on unexpected error', async () => {
    vi.mocked(submitAnswer).mockRejectedValue(new Error('DB crash'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/quiz/answer',
      headers: { authorization: 'Bearer token' },
      payload: { sessionId: 's-1', answer: 'Argentina', timeMs: 5000 },
    });
    expect(res.statusCode).toBe(500);
  });
});
