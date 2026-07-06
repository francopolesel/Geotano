import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ────────────────────────────────────────────────────────────────
// All chain methods return mockDb. mockDb is THENABLE — calling await on it
// resolves via .then() which dequeues the next result. This handles any query
// chain pattern without worrying about which method is terminal.

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
  onConflictDoNothing: vi.fn(),
  // Thenable — await on mockDb dequeues the next result
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

import { notificationsRoutes } from '../routes/notifications.js';
import Fastify from 'fastify';

function setupMockDbChain() {
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
  mockDb.onConflictDoNothing.mockReturnThis();
}

async function buildApp() {
  const app = Fastify();
  await app.register(notificationsRoutes);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-06T12:00:00Z');

function makeNotification(overrides: Partial<any> = {}) {
  return {
    id: 'notif-1',
    userId: 'user-1',
    type: 'friend_request',
    fromUserId: 'user-2',
    metadata: null,
    read: false,
    createdAt: NOW,
    ...overrides,
  };
}

describe('GET /api/notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return empty list when no notifications', async () => {
    // Query 1: db.select().from(n).where(uid).orderBy(desc).limit(50)
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });

  it('should return notifications with sender profiles', async () => {
    // Query 1: primary notification list → .limit()
    waitData.push([
      makeNotification({ id: 'notif-1', fromUserId: 'user-2', read: false }),
      makeNotification({ id: 'notif-2', fromUserId: 'user-3', read: true, type: 'friend_accepted' }),
    ]);
    // Query 2: sender profiles → .where()
    waitData.push([
      { id: 'user-2', username: 'friend2', displayName: 'Friend 2', avatarUrl: null },
      { id: 'user-3', username: 'friend3', displayName: 'Friend 3', avatarUrl: 'https://example.com/avatar.png' },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notifications).toHaveLength(2);

    expect(body.notifications[0]).toMatchObject({
      id: 'notif-1',
      fromUsername: 'friend2',
      fromDisplayName: 'Friend 2',
      fromAvatarUrl: null,
      read: false,
    });
    expect(body.notifications[1]).toMatchObject({
      id: 'notif-2',
      fromUsername: 'friend3',
      fromDisplayName: 'Friend 3',
      fromAvatarUrl: 'https://example.com/avatar.png',
      read: true,
    });
    expect(body.unreadCount).toBe(1);
  });

  it('should handle notifications from unknown users (null profile)', async () => {
    waitData.push([
      makeNotification({ id: 'notif-1', fromUserId: 'deleted-user', read: false }),
    ]);
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.notifications[0].fromUsername).toBeUndefined();
    expect(body.notifications[0].fromDisplayName).toBeUndefined();
    expect(body.unreadCount).toBe(1);
  });
});

describe('POST /api/notifications/read/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should mark notification as read and return success', async () => {
    // db.update(n).set({read:true}).where(and(...)).returning()
    waitData.push([makeNotification({ id: 'notif-1' })]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read/notif-1',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ success: true });
  });

  it('should return 404 when notification not found', async () => {
    waitData.push([]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read/nonexistent',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Notification not found');
  });
});

describe('POST /api/notifications/read-all', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should mark all as read and return success', async () => {
    // db.update(n).set({read:true}).where(and(userId, read=false))
    waitData.push({ rowCount: 3 });

    const res = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ success: true });
  });
});

describe('DELETE /api/notifications/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDbChain();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should delete notification and return success', async () => {
    // db.delete(n).where(and(...)).returning()
    waitData.push([makeNotification({ id: 'notif-1' })]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/notifications/notif-1',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({ success: true });
  });

  it('should return 404 when notification not found', async () => {
    waitData.push([]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/notifications/nonexistent',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.message).toContain('Notification not found');
  });
});
