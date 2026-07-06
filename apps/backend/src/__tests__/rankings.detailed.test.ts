import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Thenable mockDb ─────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  groupBy: vi.fn(),
  innerJoin: vi.fn(),
  having: vi.fn(),
  as: vi.fn(),
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
vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request: any, _reply: any, done: any) => {
    request.user = { userId: 'user-1', username: 'testuser' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1', username: 'testuser' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { rankingsRoutes } from '../routes/rankings.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

function setupMockDb() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.having.mockReturnThis();
  mockDb.as.mockReturnThis();
}

let app: FastifyInstance;

describe('Rankings — uncovered paths', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockDb();
    app = Fastify();
    await app.register(rankingsRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should filter by mode when mode slug is given', async () => {
    // Top entries (with mode filter)
    waitData.push([
      { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
      { userId: 'user-2', username: 'player2', avatarUrl: null, score: 1200 },
    ]);
    // Total players
    waitData.push([{ totalPlayers: 5 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever&mode=flag-guess',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(2);
    expect(body.gameModeSlug).toBe('flag-guess');
  });

  it('should filter by daily period', async () => {
    waitData.push([
      { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
    ]);
    waitData.push([{ totalPlayers: 3 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=daily',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.period).toBe('daily');
    expect(body.entries).toHaveLength(1);
  });

  it('should handle user not in top 100 — global scope', async () => {
    // Top entries — user-1 NOT in this list
    waitData.push([
      { userId: 'user-2', username: 'player2', avatarUrl: 'http://example.com/2.jpg', score: 2000 },
      { userId: 'user-3', username: 'player3', avatarUrl: null, score: 1500 },
    ]);
    // Total players
    waitData.push([{ totalPlayers: 10 }]);
    // User's own total score
    waitData.push([{ score: 800 }]);
    // Higher count — 2 users ahead
    waitData.push([{ count: 2 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(2);
    expect(body.userRank).toBeDefined();
    expect(body.userRank.userId).toBe('user-1');
    expect(body.userRank.rank).toBe(3); // 2 ahead + 1
    expect(body.userRank.score).toBe(800);
    // entries should have correct ranks (different scores → different ranks)
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[1].rank).toBe(2);
    expect(body.entries[0].avatarUrl).toBe('http://example.com/2.jpg');
  });

  it('should handle user not in top 100 — with mode filter', async () => {
    waitData.push([
      { userId: 'user-2', username: 'player2', avatarUrl: null, score: 2000 },
    ]);
    waitData.push([{ totalPlayers: 5 }]);
    waitData.push([{ score: 400 }]);
    waitData.push([{ count: 1 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever&mode=flag-guess',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userRank).toBeDefined();
    expect(body.userRank.rank).toBe(2); // 1 ahead + 1
    expect(body.gameModeSlug).toBe('flag-guess');
  });

  it('should handle user not in top 100 — friends scope', async () => {
    // Sent friends
    waitData.push([{ friendId: 'user-2' }, { friendId: 'user-3' }]);
    // Received friends
    waitData.push([]);
    // Top entries (friends only)
    waitData.push([
      { userId: 'user-2', username: 'player2', avatarUrl: null, score: 2000 },
    ]);
    // Total players (friends only)
    waitData.push([{ totalPlayers: 3 }]);
    // User score
    waitData.push([{ score: 600 }]);
    // Higher count
    waitData.push([{ count: 1 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=friends&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.scope).toBe('friends');
    expect(body.userRank).toBeDefined();
    expect(body.userRank.rank).toBe(2); // 1 friend ahead + 1
  });

  it('should handle user not in top 100 — daily period', async () => {
    waitData.push([
      { userId: 'user-2', username: 'player2', avatarUrl: null, score: 2000 },
      { userId: 'user-3', username: 'player3', avatarUrl: null, score: 1500 },
    ]);
    waitData.push([{ totalPlayers: 5 }]);
    waitData.push([{ score: 300 }]);
    waitData.push([{ count: 2 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=daily',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.period).toBe('daily');
    expect(body.userRank).toBeDefined();
    expect(body.userRank.rank).toBe(3);
  });

  it('should handle tie scores — same rank for equal scores', async () => {
    // user-1 and user-2 have same score
    waitData.push([
      { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
      { userId: 'user-2', username: 'player2', avatarUrl: null, score: 1500 },
      { userId: 'user-3', username: 'player3', avatarUrl: null, score: 1000 },
    ]);
    waitData.push([{ totalPlayers: 3 }]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(3);
    // Both user-1 and user-2 should have rank 1 (tied)
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[1].rank).toBe(1); // same score = same rank
    expect(body.entries[2].rank).toBe(3); // different score = position-based rank
    // user-1 is in top, so userRank should be from entries
    expect(body.userRank).toBeDefined();
    expect(body.userRank.userId).toBe('user-1');
  });
});
