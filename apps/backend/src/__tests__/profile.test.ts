import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockGetUserAchievements = vi.hoisted(() => vi.fn());

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  innerJoin: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  onConflictDoNothing: vi.fn(),
  groupBy: vi.fn(),
  having: vi.fn(),
  as: vi.fn(),
  then(resolve: (value: any) => void) {
    const data = waitData.shift();
    resolve(data !== undefined ? data : []);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));
vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request, _reply, done) => {
    (request as any).user = { userId: 'user-1', username: 'testuser' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1', username: 'testuser' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../services/achievements.js', () => ({
  getUserAchievements: mockGetUserAchievements,
}));

import { profileRoutes } from '../routes/profile.js';
import Fastify from 'fastify';

function setupMockDbChain() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
  mockDb.onConflictDoNothing.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.having.mockReturnThis();
  mockDb.as.mockReturnThis();
}

async function buildApp() {
  const app = Fastify();
  await app.register(profileRoutes);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-06T12:00:00Z');

const PROFILE_USER = {
  id: 'user-1',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: null,
  bio: 'Hello!',
  createdAt: NOW,
};

const SCORE_STATS = {
  totalScore: 15000,
  totalGames: 42,
  bestScore: 2500,
};

const FRIEND_COUNT = { count: 7 };

const RECENT_GAMES = [
  {
    id: 'game-1',
    score: 1200,
    correctCount: 10,
    totalQuestions: 12,
    gameModeSlug: 'flag-guess',
    gameModeNameEn: 'Flag Guess',
    completedAt: NOW,
  },
  {
    id: 'game-2',
    score: 800,
    correctCount: 6,
    totalQuestions: 10,
    gameModeSlug: 'capital-guess',
    gameModeNameEn: 'Capital Guess',
    completedAt: new Date('2026-07-05T10:00:00Z'),
  },
];

const ACHIEVEMENTS = [
  { slug: 'first_game', nameEn: 'First Game', nameEs: 'Primer Juego', earnedAt: NOW.toISOString() },
];

describe('GET /api/users/:id/profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return full profile with stats and recent games', async () => {
    // 6 DB queries + 1 external service call
    waitData.push([PROFILE_USER]);           // Q1: user lookup → .limit(1)
    waitData.push([SCORE_STATS]);             // Q2: score stats → .where()
    waitData.push([{ count: 5 }]);             // Q3: global rank → .having()
    waitData.push([FRIEND_COUNT]);             // Q4: friend count → .where()
    waitData.push([{ count: 5 }]);             // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 12 }]);        // Q6: best streak → .where()
    waitData.push(RECENT_GAMES);               // Q7: recent games → .limit(10)
    mockGetUserAchievements.mockResolvedValueOnce(ACHIEVEMENTS);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.user).toMatchObject({
      id: 'user-1',
      username: 'testuser',
      displayName: 'Test User',
    });
    expect(body.stats).toMatchObject({
      totalScore: 15000,
      totalGames: 42,
      bestScore: 2500,
      friends: 7,
      perfectGames: 5,
      bestStreak: 12,
    });
    expect(body.recentGames).toHaveLength(2);
    expect(body.recentGames[0]).toMatchObject({
      id: 'game-1',
      gameMode: 'flag-guess',
    });
    expect(body.achievements).toEqual(ACHIEVEMENTS);
  });

  it('should return 404 when user does not exist', async () => {
    waitData.push([]); // Q1: empty → not found

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/nonexistent/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('User not found');
  });

  it('should handle null score stats gracefully', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([]); // Q2: empty stats → defaults to 0
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 0 }]);    // Q4: perfect games
    waitData.push([{ maxStreak: 0 }]); // Q5: best streak
    waitData.push(RECENT_GAMES);        // Q6: recent games
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.stats).toMatchObject({
      totalScore: 0,
      totalGames: 0,
      bestScore: 0,
      perfectGames: 0,
      bestStreak: 0,
    });
  });

  it('should handle zero friends', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);     // Q3: global rank → .having()
    waitData.push([{ count: 0 }]);     // Q4: friend count → .where()
    waitData.push([{ count: 0 }]);     // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 0 }]); // Q6: best streak → .where()
    waitData.push(RECENT_GAMES);        // Q7: recent games → .limit(10)
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).stats.friends).toBe(0);
  });

  it('should return empty recent games list', async () => {
    waitData.push([PROFILE_USER]);
    waitData.push([SCORE_STATS]);
    waitData.push([{ count: 5 }]);     // Q3: global rank → .having()
    waitData.push([FRIEND_COUNT]);
    waitData.push([{ count: 0 }]);     // Q5: perfect games → .where()
    waitData.push([{ maxStreak: 0 }]); // Q6: best streak → .where()
    waitData.push([]);                 // Q7: no recent games
    mockGetUserAchievements.mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/user-1/profile',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).recentGames).toEqual([]);
  });
});
