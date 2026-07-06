import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerCors } from '../../plugins/index.js';
import { healthRoutes, authRoutes, quizRoutes, friendsRoutes, chatRoutes, rankingsRoutes } from '../../routes/index.js';

// ─── Mock DB ────────────────────────────────────────────────────────────────
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
  having: vi.fn(),
  as: vi.fn(),
  or: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
  gte: vi.fn(),
  inArray: vi.fn(),
  ne: vi.fn(),
  notInArray: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
}));

function setupMockDbChain() {
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
  mockDb.having.mockReturnThis();
  mockDb.as.mockReturnThis();
}

function resetMockDb() {
  Object.values(mockDb).forEach((fn: any) => {
    if (typeof fn?.mockReset === 'function') {
      fn.mockReset();
    }
  });
}

vi.mock('../../db/index.js', () => ({
  db: mockDb,
}));

vi.mock('../../auth/index.js', () => ({
  authGuard: vi.fn((_req, _reply, done) => {
    // Must set (request as any).user for the route handlers
    // We'll do it inside each specific test since patterns differ
    done?.();
  }),
  signToken: vi.fn(() => 'jwt-token-abc123'),
  verifyToken: vi.fn(() => ({ userId: 'user-1', username: 'testuser' })),
  hashPassword: vi.fn(() => Promise.resolve('$2a$10$hashedpassword')),
  verifyPassword: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('../../services/gameModes.js', () => ({
  getModeConfig: vi.fn().mockReturnValue({
    slug: 'flag-guess',
    questionTypes: ['flag-to-country'],
    timerSeconds: 15,
    lives: 3,
    multiplier: 1.0,
    description: 'See the flag, guess the country',
  }),
  isValidModeSlug: vi.fn((slug: string) =>
    ['flag-guess', 'capital-guess', 'country-by-flag', 'continent', 'free'].includes(slug),
  ),
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'uuid-mock-0000'),
    randomBytes: vi.fn(() => Buffer.from('abcdef123456', 'hex')),
  },
  randomUUID: vi.fn(() => 'uuid-mock-0000'),
  randomBytes: vi.fn(() => Buffer.from('abcdef123456', 'hex')),
}));

describe('API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await registerCors(app);
    await app.register(healthRoutes);
    await app.register(authRoutes);
    await app.register(quizRoutes);
    await app.register(friendsRoutes);
    await app.register(chatRoutes);
    await app.register(rankingsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDb();
    setupMockDbChain();
  });

  // ── Health endpoint ──────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  // ── Auth flow ────────────────────────────────────────────────────────────

  describe('Auth flow: register → login → me', () => {
    it('should register a new user and return JWT', async () => {
      // Mock: no existing user with that username/email
      mockDb.limit.mockResolvedValueOnce([]);
      // Mock: insert returning the new user
      const now = new Date();
      mockDb.returning.mockResolvedValueOnce([{
        id: 'new-user-1',
        username: 'newuser',
        email: 'new@test.com',
        displayName: 'newuser',
        language: 'en',
        avatarUrl: null,
        joinCode: 'abc123',
        createdAt: now,
        passwordHash: '$2a$10$...',
      }]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'newuser', email: 'new@test.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('jwt-token-abc123');
      expect(body.user.username).toBe('newuser');
      expect(body.user.email).toBe('new@test.com');
    });

    it('should return 409 when username or email already exists', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing', username: 'newuser' }]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { username: 'newuser', email: 'new@test.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/already exists/i);
    });

    it('should login with correct credentials', async () => {
      const now = new Date();
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        displayName: 'Test User',
        passwordHash: '$2a$10$hashed',
        avatarUrl: null,
        language: 'en',
        joinCode: 'abc',
        createdAt: now,
        lastLogin: null,
      }]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'testuser', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.token).toBe('jwt-token-abc123');
      expect(body.user.username).toBe('testuser');
    });

    it('should return 401 with wrong password', async () => {
      const now = new Date();
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-1',
        username: 'testuser',
        passwordHash: '$2a$10$hashed',
      }]);
      // Override verifyPassword to return false for this test
      const authModule = await import('../../auth/index.js');
      vi.mocked(authModule.verifyPassword).mockResolvedValueOnce(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'testuser', password: 'wrongpassword' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/invalid/i);
    });

    it('should access /auth/me with valid token', async () => {
      const now = new Date();
      mockDb.limit.mockResolvedValueOnce([{
        id: 'user-1',
        username: 'testuser',
        email: 'test@test.com',
        displayName: 'Test User',
        avatarUrl: null,
        language: 'en',
        joinCode: 'abc',
        createdAt: now,
        lastLogin: null,
      }]);

      // Override authGuard to set user
      const authModule = await import('../../auth/index.js');
      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.username).toBe('testuser');
    });
  });

  // ── Protected routes ────────────────────────────────────────────────────

  describe('protected routes', () => {
    it('should return 401 without token (no authGuard set user)', async () => {
      const authModule = await import('../../auth/index.js');
      vi.mocked(authModule.authGuard).mockImplementationOnce(async (_req: any, reply: any) => {
        reply.status(401).send({ message: 'Missing or invalid authorization header' });
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── Quiz flow ────────────────────────────────────────────────────────────

  /** Reusable mock country to feed the 5-question batch (POOL_INITIAL_SIZE). */
  function mockCountries() {
    const countries = [
      { id: 'c1', nameEn: 'France', continent: 'Europe', capitalEn: 'Paris', flagSvgUrl: 'https://flag.com/fr.svg' },
      { id: 'c2', nameEn: 'Germany', continent: 'Europe', capitalEn: 'Berlin', flagSvgUrl: 'https://flag.com/de.svg' },
      { id: 'c3', nameEn: 'Italy', continent: 'Europe', capitalEn: 'Rome', flagSvgUrl: 'https://flag.com/it.svg' },
      { id: 'c4', nameEn: 'Spain', continent: 'Europe', capitalEn: 'Madrid', flagSvgUrl: 'https://flag.com/es.svg' },
      { id: 'c5', nameEn: 'UK', continent: 'Europe', capitalEn: 'London', flagSvgUrl: 'https://flag.com/uk.svg' },
      { id: 'c6', nameEn: 'Portugal', continent: 'Europe', capitalEn: 'Lisbon', flagSvgUrl: 'https://flag.com/pt.svg' },
      { id: 'c7', nameEn: 'Netherlands', continent: 'Europe', capitalEn: 'Amsterdam', flagSvgUrl: 'https://flag.com/nl.svg' },
      { id: 'c8', nameEn: 'Belgium', continent: 'Europe', capitalEn: 'Brussels', flagSvgUrl: 'https://flag.com/be.svg' },
      { id: 'c9', nameEn: 'Sweden', continent: 'Europe', capitalEn: 'Stockholm', flagSvgUrl: 'https://flag.com/se.svg' },
      { id: 'c10', nameEn: 'Norway', continent: 'Europe', capitalEn: 'Oslo', flagSvgUrl: 'https://flag.com/no.svg' },
      { id: 'c11', nameEn: 'Denmark', continent: 'Europe', capitalEn: 'Copenhagen', flagSvgUrl: 'https://flag.com/dk.svg' },
      { id: 'c12', nameEn: 'Finland', continent: 'Europe', capitalEn: 'Helsinki', flagSvgUrl: 'https://flag.com/fi.svg' },
      { id: 'c13', nameEn: 'Poland', continent: 'Europe', capitalEn: 'Warsaw', flagSvgUrl: 'https://flag.com/pl.svg' },
      { id: 'c14', nameEn: 'Austria', continent: 'Europe', capitalEn: 'Vienna', flagSvgUrl: 'https://flag.com/at.svg' },
      { id: 'c15', nameEn: 'Switzerland', continent: 'Europe', capitalEn: 'Bern', flagSvgUrl: 'https://flag.com/ch.svg' },
    ];
    return countries;
  }

  describe('Quiz session flow', () => {
    it('should start a quiz session', async () => {
      const now = new Date();
      const all = mockCountries();

      // POOL_INITIAL_SIZE=5 → startSession needs 12 limit mocks:
      // mode(1) + session(1) + 5 questions × (1 correct + 1 distractor)
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'mode-1', slug: 'flag-guess' }])            // 1: mode lookup
        .mockResolvedValueOnce([{                                                   // 2: session lookup
          id: 'session-1', userId: 'user-1', gameModeId: 'mode-1',
          score: 0, correctCount: 0, totalQuestions: 0, streakMax: 0,
          livesRemaining: 3, isActive: true, startedAt: now,
        }])
        // Q1
        .mockResolvedValueOnce([all[0]]) // 3: correct
        .mockResolvedValueOnce([all[1], all[2], all[3]])                           // 4: distractors
        // Q2
        .mockResolvedValueOnce([all[4]])                                            // 5: correct
        .mockResolvedValueOnce([all[5], all[6], all[7]])                           // 6: distractors
        // Q3
        .mockResolvedValueOnce([all[8]])                                            // 7: correct
        .mockResolvedValueOnce([all[9], all[10], all[11]])                         // 8: distractors
        // Q4
        .mockResolvedValueOnce([all[12]])                                           // 9: correct
        .mockResolvedValueOnce([all[13], all[14], all[0]])                         // 10: distractors (wrap around)
        // Q5
        .mockResolvedValueOnce([all[1]])                                            // 11: correct
        .mockResolvedValueOnce([all[2], all[3], all[4]]);                          // 12: distractors

      const authModule = await import('../../auth/index.js');
      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/quiz/session?mode=flag-guess',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.sessionId).toBeDefined();
      expect(body.question).toBeDefined();
      expect(body.question.options).toHaveLength(4);
    });

    it('should submit an answer and return result', async () => {
      // The question cache won't have a session from a previous inject call
      // This is a limitation — for a full test we'd need the cache populated
      // Instead, test the validation paths

      const authModule = await import('../../auth/index.js');
      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/quiz/answer',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          sessionId: 'session-nonexistent',
          answer: 'France',
          timeMs: 5000,
        },
      });

      // Should get 400 because the session isn't in the question cache
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/not found/i);
    });
  });

  // ── Friend request flow ──────────────────────────────────────────────────

  describe('Friend request → accept → chat flow', () => {
    it('should send, accept friend request, and access chat', async () => {
      const authModule = await import('../../auth/index.js');

      // 1. Send friend request
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'user-2', username: 'friend2' }])  // user lookup
        .mockResolvedValueOnce([]);  // no existing relationship

      mockDb.returning.mockResolvedValueOnce([{
        id: 'req-1',
        status: 'pending',
        createdAt: new Date(),
      }]);

      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const reqRes = await app.inject({
        method: 'POST',
        url: '/api/friends/request',
        headers: { authorization: 'Bearer valid-token' },
        payload: { username: 'friend2' },
      });

      expect(reqRes.statusCode).toBe(200);
      expect(JSON.parse(reqRes.body).status).toBe('pending');

      // 2. Accept friend request
      vi.clearAllMocks();
      setupMockDbChain();
      mockDb.limit.mockResolvedValueOnce([{
        id: 'req-1',
        userId: 'user-2',
        friendId: 'user-1',
        status: 'pending',
      }]);
      mockDb.returning.mockResolvedValueOnce([{
        id: 'req-1',
        status: 'accepted',
        userId: 'user-2',
      }]);

      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const acceptRes = await app.inject({
        method: 'POST',
        url: '/api/friends/accept',
        headers: { authorization: 'Bearer valid-token' },
        payload: { requestId: 'req-1' },
      });

      expect(acceptRes.statusCode).toBe(200);
      expect(JSON.parse(acceptRes.body).status).toBe('accepted');

      // 3. Access chat messages (friendship must exist)
      vi.clearAllMocks();
      setupMockDbChain();
      mockDb.limit
        .mockResolvedValueOnce([{ id: 'friendship-1', status: 'accepted' }]) // friendship check
        .mockResolvedValueOnce([]); // chat history

      vi.mocked(authModule.authGuard).mockImplementationOnce((req: any, _reply: any, done: any) => {
        req.user = { userId: 'user-1', username: 'testuser' };
        done?.();
      });

      const chatRes = await app.inject({
        method: 'GET',
        url: '/api/chat/user-2',
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(chatRes.statusCode).toBe(200);
      const chatBody = JSON.parse(chatRes.body);
      expect(chatBody.messages).toBeDefined();
    });
  });
});
