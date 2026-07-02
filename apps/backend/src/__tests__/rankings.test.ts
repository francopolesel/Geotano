import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
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
}));

vi.mock('../db/index.js', () => ({
  db: mockDb,
}));

vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request, _reply, done) => {
    (request as any).user = { userId: 'user-1', username: 'testuser' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1', username: 'testuser' })),
}));

import { rankingsRoutes } from '../routes/rankings.js';
import Fastify from 'fastify';

async function buildRankingsApp() {
  const app = Fastify();
  await app.register(rankingsRoutes);
  return app;
}

function setupMockDbChain() {
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.groupBy.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.having.mockReturnThis();
  mockDb.as.mockReturnThis();
}

describe('Rankings API', () => {
  let app: Awaited<ReturnType<typeof buildRankingsApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildRankingsApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should validate scope parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=invalid',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/scope/i);
  });

  it('should validate period parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=invalid',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/period/i);
  });

  it('should validate mode slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever&mode=invalid',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/mode/i);
  });

  it('should return global rankings with entries and total players', async () => {
    // Mock the chain for the main query
    // db.select() → .from() → .innerJoin() → .innerJoin() → .where() → .groupBy() → .orderBy() → .limit(100)
    // And then the totalPlayers count query

    // For the inner joins, we need the mock chain to work
    mockDb.where
      .mockImplementationOnce(() => mockDb)
      .mockResolvedValueOnce([{ totalPlayers: 10 }]);

    mockDb.limit
      .mockResolvedValueOnce([
        { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
        { userId: 'user-2', username: 'player2', avatarUrl: null, score: 1200 },
      ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(2);
    expect(body.totalPlayers).toBe(10);
    expect(body.scope).toBe('global');
    expect(body.period).toBe('forever');
  });

  it('should return friends-scoped rankings', async () => {
    // Mock the friends lookup
    mockDb.where
      .mockResolvedValueOnce([{ friendId: 'user-2' }, { friendId: 'user-3' }])
      .mockResolvedValueOnce([])
      .mockImplementationOnce(() => mockDb)
      .mockResolvedValueOnce([{ totalPlayers: 2 }]);

    mockDb.limit.mockResolvedValueOnce([
        { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
        { userId: 'user-2', username: 'player2', avatarUrl: null, score: 1200 },
      ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=friends&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.scope).toBe('friends');
  });

  it('should return daily period rankings', async () => {
    mockDb.where
      .mockImplementationOnce(() => mockDb)
      .mockResolvedValueOnce([{ totalPlayers: 0 }])
      .mockImplementationOnce(() => mockDb);

    mockDb.limit.mockResolvedValueOnce([]);
    mockDb.groupBy
      .mockImplementationOnce(() => mockDb)
      .mockResolvedValueOnce([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=daily',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.period).toBe('daily');
  });

  it('should include userRank when user is in top entries', async () => {
    mockDb.where
      .mockImplementationOnce(() => mockDb)
      .mockResolvedValueOnce([{ totalPlayers: 5 }]);

    mockDb.limit.mockResolvedValueOnce([
        { userId: 'user-1', username: 'testuser', avatarUrl: null, score: 1500 },
      ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/rankings?scope=global&period=forever',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userRank).toBeDefined();
    expect(body.entries[0].userId).toBe('user-1');
  });
});
