import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB (thenable pattern) ─────────────────────────────────────────────
const waitData: any[] = [];

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

vi.mock('../services/notifications.js', () => ({
  createNotification: vi.fn(() => ({ catch: vi.fn() })),
}));

import { friendsRoutes } from '../routes/friends.js';
import Fastify from 'fastify';

function setupMockDb() {
  waitData.length = 0;
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

async function buildApp() {
  const app = Fastify();
  await app.register(friendsRoutes);
  return app;
}

const NOW = new Date('2026-07-06T12:00:00Z');

describe('GET /api/friends', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return friends, incoming, and outgoing lists', async () => {
    // Query 1: accepted friends → .where(and(or(...), eq(status,'accepted')))
    waitData.push([
      { id: 'f1', userId: 'user-1', friendId: 'user-2', status: 'accepted', createdAt: NOW },
      { id: 'f2', userId: 'user-3', friendId: 'user-1', status: 'accepted', createdAt: NOW },
    ]);
    // Query 2: friend profiles → .where(inArray(...))
    waitData.push([
      { id: 'user-2', username: 'friend2', displayName: 'Friend 2', avatarUrl: null },
      { id: 'user-3', username: 'friend3', displayName: 'Friend 3', avatarUrl: null },
    ]);
    // Query 3: incoming pending → .where(...)
    waitData.push([
      { id: 'f3', userId: 'user-4', friendId: 'user-1', status: 'pending', createdAt: NOW },
    ]);
    // Query 4: incoming profiles → .where(inArray(...))
    waitData.push([
      { id: 'user-4', username: 'sender4', displayName: 'Sender 4', avatarUrl: null },
    ]);
    // Query 5: outgoing pending → .where(...)
    waitData.push([
      { id: 'f4', userId: 'user-1', friendId: 'user-5', status: 'pending', createdAt: NOW },
    ]);
    // Query 6: outgoing profiles → .where(inArray(...))
    waitData.push([
      { id: 'user-5', username: 'receiver5', displayName: 'Receiver 5', avatarUrl: null },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.friends).toHaveLength(2);
    expect(body.friends[0]).toMatchObject({ friendId: 'user-2', username: 'friend2' });
    expect(body.friends[1]).toMatchObject({ friendId: 'user-3', username: 'friend3' });

    expect(body.pendingIncoming).toHaveLength(1);
    expect(body.pendingIncoming[0]).toMatchObject({ senderId: 'user-4', username: 'sender4' });

    expect(body.pendingOutgoing).toHaveLength(1);
    expect(body.pendingOutgoing[0]).toMatchObject({ receiverId: 'user-5', username: 'receiver5' });
  });

  it('should return empty lists when no friends', async () => {
    // All 6 queries return empty
    waitData.push([]); // accepted
    // No profiles needed (no accepted friends → friendIds.length === 0)
    waitData.push([]); // incoming
    // No profiles needed
    waitData.push([]); // outgoing

    const res = await app.inject({
      method: 'GET',
      url: '/api/friends',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.friends).toEqual([]);
    expect(body.pendingIncoming).toEqual([]);
    expect(body.pendingOutgoing).toEqual([]);
  });
});

describe('GET /api/invite-link', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return invite code and link', async () => {
    waitData.push([{ joinCode: 'abc123', username: 'testuser' }]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/invite-link',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('code');
    expect(body.inviteLink).toContain('/invite/abc123');
  });

  it('should return 404 when user not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/invite-link',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/friends/invite', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when code missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when code is invalid', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'invalid' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should reject self-invite', async () => {
    waitData.push([{ id: 'user-1', username: 'testuser' }]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'selfcode' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('SELF_REQUEST');
  });

  it('should auto-accept when target already sent a pending request', async () => {
    waitData.push([{ id: 'user-2', username: 'friend2' }]); // target user
    // existing friendship check — pending request FROM target TO us
    waitData.push([{ id: 'req-1', userId: 'user-2', friendId: 'user-1', status: 'pending' }]);
    // update accept → returning
    waitData.push([{ id: 'req-1', status: 'accepted', userId: 'user-2' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'invitecode' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('accepted');
  });

  it('should return 409 when request already sent by us', async () => {
    waitData.push([{ id: 'user-2', username: 'friend2' }]);
    // existing — pending FROM us TO target
    waitData.push([{ id: 'req-1', userId: 'user-1', friendId: 'user-2', status: 'pending' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'invitecode' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).errorCode).toBe('REQUEST_ALREADY_SENT');
  });

  it('should return 409 when already friends', async () => {
    waitData.push([{ id: 'user-2', username: 'friend2' }]);
    waitData.push([{ id: 'req-1', userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'invitecode' },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).errorCode).toBe('ALREADY_FRIENDS');
  });

  it('should create accepted friendship directly via invite', async () => {
    waitData.push([{ id: 'user-2', username: 'friend2' }]);
    waitData.push([]); // no existing
    // insert → returning
    waitData.push([{ id: 'new-f', status: 'accepted' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/invite',
      headers: { authorization: 'Bearer valid-token' },
      payload: { code: 'invitecode' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('accepted');
    expect(body.friend).toMatchObject({ id: 'user-2', username: 'friend2' });
  });
});

describe('POST /api/friends/cancel', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when requestId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/cancel',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when request not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/cancel',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'nonexistent' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should cancel successfully', async () => {
    waitData.push([{ id: 'req-1', userId: 'user-1', friendId: 'user-2', status: 'pending' }]);
    // delete
    mockDb.delete.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/cancel',
      headers: { authorization: 'Bearer valid-token' },
      payload: { requestId: 'req-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });
});

describe('POST /api/friends/accept (validation)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when requestId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/accept',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/friends/decline (validation)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when requestId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/decline',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/friends/block', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when friendId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/block',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should create blocked entry when no relationship exists', async () => {
    waitData.push([]); // no existing
    waitData.push([{ id: 'block-1', status: 'blocked' }]); // insert returning

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/block',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('blocked');
  });

  it('should update existing relationship to blocked', async () => {
    waitData.push([{ id: 'rel-1', userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);
    waitData.push([{ id: 'rel-1', status: 'blocked' }]); // update returning

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/block',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('blocked');
  });

  it('should return 409 when already blocked by us', async () => {
    waitData.push([{ id: 'rel-1', userId: 'user-1', friendId: 'user-2', status: 'blocked' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/block',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).errorCode).toBe('ALREADY_BLOCKED');
  });
});

describe('POST /api/friends/unblock', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when friendId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/unblock',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when blocked relationship not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/unblock',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should unblock successfully', async () => {
    waitData.push([{ id: 'rel-1' }]); // found blocked
    mockDb.delete.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/unblock',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });
});

describe('POST /api/friends/remove', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when friendId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/remove',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when friendship not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/remove',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should remove friend successfully', async () => {
    waitData.push([{ id: 'rel-1', userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);
    mockDb.delete.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/friends/remove',
      headers: { authorization: 'Bearer valid-token' },
      payload: { friendId: 'user-2' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });
});

describe('GET /api/friends/blocked', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return empty list when no blocked users', async () => {
    waitData.push([]); // blocked list

    const res = await app.inject({
      method: 'GET',
      url: '/api/friends/blocked',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('should return blocked users with profiles', async () => {
    waitData.push([
      { id: 'b1', friendId: 'user-2', createdAt: NOW },
    ]);
    waitData.push([
      { id: 'user-2', username: 'blocked2', displayName: 'Blocked 2', avatarUrl: null },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/friends/blocked',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ userId: 'user-2', username: 'blocked2' });
  });
});
