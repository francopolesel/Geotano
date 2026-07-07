import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Thenable mockDb ─────────────────────────────────────────────────────────
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
  authGuard: vi.fn((request: any, _reply: any, done: any) => {
    request.user = { userId: 'user-1' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import { chatRoutes } from '../routes/chat.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

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

function makeMessage(id: string, senderId: string, content: string, minutesAgo: number) {
  return {
    id,
    senderId,
    receiverId: senderId === 'user-1' ? 'friend-1' : 'user-1',
    content,
    read: false,
    createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
  };
}

let app: FastifyInstance;

describe('GET /api/chat/:friendId', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockDb();
    app = Fastify();
    await app.register(chatRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return messages between friends (ASC order)', async () => {
    // Friendship check returns a match
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    // Messages query returns messages DESC (newest first), route reverses them
    waitData.push([
      makeMessage('m3', 'friend-1', 'Hey back!', 5),
      makeMessage('m2', 'user-1', 'Hi!', 10),
      makeMessage('m1', 'friend-1', 'Hello!', 15),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages).toHaveLength(3);
    // Messages come back in ASC order (oldest first)
    expect(body.messages[0].content).toBe('Hello!');
    expect(body.messages[1].content).toBe('Hi!');
    expect(body.messages[2].content).toBe('Hey back!');
    // Each message has ISO createdAt string
    expect(typeof body.messages[0].createdAt).toBe('string');
  });

  it('should return 403 when not friends', async () => {
    // Friendship check returns empty
    waitData.push([]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-2',
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain('Not friends');
  });

  it('should filter messages by before cursor', async () => {
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    waitData.push([
      makeMessage('m2', 'user-1', 'older', 60),
      makeMessage('m1', 'friend-1', 'oldest', 120),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1?before=2026-07-01T00:00:00.000Z',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(2);
  });

  it('should accept custom limit parameter', async () => {
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    waitData.push([
      makeMessage('m3', 'friend-1', 'c', 5),
      makeMessage('m2', 'user-1', 'b', 10),
      makeMessage('m1', 'friend-1', 'a', 15),
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1?limit=3',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(3);
  });

  it('should cap limit at 100', async () => {
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    const messages = Array.from({ length: 100 }, (_, i) =>
      makeMessage(`m${i}`, i % 2 === 0 ? 'user-1' : 'friend-1', `msg${i}`, i + 1),
    );
    waitData.push(messages);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1?limit=999',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(100);
  });

  it('should default to 50 messages when no limit given', async () => {
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    const messages = Array.from({ length: 50 }, (_, i) =>
      makeMessage(`m${i}`, i % 2 === 0 ? 'user-1' : 'friend-1', `msg${i}`, i + 1),
    );
    waitData.push(messages);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(50);
  });

  it('should default to 50 when limit is NaN (non-numeric string)', async () => {
    waitData.push([{ userId: 'user-1', friendId: 'friend-1', status: 'accepted' }]);
    const messages = Array.from({ length: 50 }, (_, i) =>
      makeMessage(`m${i}`, i % 2 === 0 ? 'user-1' : 'friend-1', `msg${i}`, i + 1),
    );
    waitData.push(messages);

    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/friend-1?limit=abc',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toHaveLength(50);
  });
});
