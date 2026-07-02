import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
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
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { friendsRoutes } from '../routes/friends.js';
import Fastify from 'fastify';

function setupMockDbChain() {
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

async function buildFriendsApp() {
  const app = Fastify();
  await app.register(friendsRoutes);
  return app;
}

describe('friend request creation', () => {
  let app: Awaited<ReturnType<typeof buildFriendsApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildFriendsApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should require a username in the request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('username is required');
  });

  it('should return 404 when target user is not found', async () => {
    // Mock: select returns empty array
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'nonexistent' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('User not found');
  });

  it('should prevent sending request to yourself', async () => {
    // Mock: user found is the same as the requester
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([{ id: 'user-1', username: 'testuser' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'testuser' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/yourself/i);
  });

  it('should prevent duplicate friend request', async () => {
    // Mock: user found, but already has a pending request
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'user-2', username: 'other' }])  // first call: user search
      .mockResolvedValueOnce([{ id: 'req-1', status: 'pending', userId: 'user-1', friendId: 'user-2' }]);  // second call: existing check

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'other' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/already sent/i);
  });

  it('should prevent duplicate accepted friendship', async () => {
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'user-2', username: 'other' }])
      .mockResolvedValueOnce([{ id: 'req-1', status: 'accepted', userId: 'user-1', friendId: 'user-2' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'other' },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/already friends/i);
  });

  it('should successfully create a friend request', async () => {
    const now = new Date();
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'user-2', username: 'other' }])  // user search
      .mockResolvedValueOnce([]);  // no existing relationship

    mockDb.insert.mockReturnThis();
    mockDb.values.mockReturnThis();
    mockDb.returning.mockResolvedValue([
      { id: 'req-1', status: 'pending', createdAt: now },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'other' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('pending');
    expect(body.id).toBe('req-1');
  });
});

describe('accept / decline friend request', () => {
  let app: Awaited<ReturnType<typeof buildFriendsApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildFriendsApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should accept a valid friend request', async () => {
    const now = new Date();
    // First select: find the friend request (limit)
    // Second select: after update returning
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit
      .mockResolvedValueOnce([{ id: 'req-1', userId: 'user-2', friendId: 'user-1', status: 'pending' }])  // find request
      .mockResolvedValueOnce([]);  // unused

    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.returning.mockResolvedValue([
      { id: 'req-1', status: 'accepted', userId: 'user-2' },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/accept',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('accepted');
    expect(body.friendId).toBe('user-2');
  });

  it('should return 404 when request is not found', async () => {
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValue([]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/accept',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'nonexistent' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/not found/i);
  });

  it('should decline a valid friend request', async () => {
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    mockDb.limit.mockResolvedValueOnce([
      { id: 'req-1', userId: 'user-2', friendId: 'user-1', status: 'pending' },
    ]);

    mockDb.delete.mockReturnThis();
    mockDb.where.mockReturnThis();

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/decline',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});

describe('user search with prefix matching', () => {
  let app: Awaited<ReturnType<typeof buildFriendsApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildFriendsApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when query is too short', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=a',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should return users matching the prefix', async () => {
    // Mock the query chain for the search endpoint
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockReturnThis();
    // The limit in the friends search returns user data
    // The mockDb.limit is tricky here because it's the last in the chain
    // We need to set up the chain to resolve with mock data at the end

    // Actually, the chain goes: db.select(...).from(...).where(...).limit(10)
    // Each of select/from/where returns the same mockDb object (returnThis()),
    // and limit resolves to the actual data.

    mockDb.limit.mockResolvedValue([
      { id: 'user-2', username: 'geotano_fan', displayName: 'Geotano Fan', avatarUrl: null },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=geo',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.users).toHaveLength(1);
    expect(body.users[0].username).toBe('geotano_fan');
  });
});
