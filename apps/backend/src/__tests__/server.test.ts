import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const waitData: any[] = [];
const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
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

vi.mock('../db/index.js', () => ({ db: mockDb, runMigrations: vi.fn() }));

// ─── Mock auth ───────────────────────────────────────────────────────────────
vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request: any, _reply: any, done: any) => {
    request.user = { userId: 'user-1', username: 'testuser' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

// ─── Mock socket (don't need real socket.io) ─────────────────────────────────
vi.mock('../socket/index.js', () => ({
  initSocket: vi.fn(() => ({})),
  getIO: vi.fn(() => ({
    to: vi.fn(() => ({ emit: vi.fn() })),
    emit: vi.fn(),
  })),
}));

// ─── Mock email ──────────────────────────────────────────────────────────────
vi.mock('../lib/email.js', () => ({
  isEmailConfigured: vi.fn(() => false),
  sendPasswordResetEmail: vi.fn(),
}));

import { buildApp } from '../index.js';

function setupMockDb() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

describe('buildApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
  });

  it('should build app without throwing', async () => {
    const app = await buildApp();
    expect(app).toBeDefined();
    await app.close();
  });

  it('should set anti-cache headers on responses', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate, no-transform');
    expect(res.headers['pragma']).toBe('no-cache');
    expect(res.headers['expires']).toBe('0');
    await app.close();
  });

  it('should register all route modules', async () => {
    const app = await buildApp();

    // Health
    let res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);

    // Auth routes — register returns 400 when no body (route is registered)
    res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {} });
    expect(res.statusCode).not.toBe(404);

    await app.close();
  });
});
