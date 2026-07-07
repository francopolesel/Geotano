import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock DB (thenable pattern) ─────────────────────────────────────────────
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

vi.mock('../db/index.js', () => ({ db: mockDb }));

const mockHashPassword = vi.hoisted(() => vi.fn());
const mockVerifyPassword = vi.hoisted(() => vi.fn());
const mockSignToken = vi.hoisted(() => vi.fn(() => 'mock-token'));
const mockVerifyToken = vi.hoisted(() => vi.fn(() => ({ userId: 'user-1', username: 'testuser' })));
const mockAuthGuard = vi.hoisted(() => vi.fn((request, _reply, done) => {
  (request as any).user = { userId: 'user-1', username: 'testuser' };
  done?.();
}));

vi.mock('../auth/index.js', () => ({
  authGuard: mockAuthGuard,
  signToken: mockSignToken,
  verifyToken: mockVerifyToken,
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));

const mockIsEmailConfigured = vi.hoisted(() => vi.fn());
const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn());

vi.mock('../lib/email.js', () => ({
  isEmailConfigured: mockIsEmailConfigured,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

import { authRoutes } from '../routes/auth.js';
import Fastify from 'fastify';

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

async function buildApp() {
  const app = Fastify({ bodyLimit: 3 * 1024 * 1024 }); // 3MB for avatar tests
  await app.register(authRoutes);
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
const NOW = new Date('2026-07-06T12:00:00Z');
const USER_ROW = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  language: 'en',
  joinCode: 'a1b2c3d4',
  passwordHash: 'hashed-password',
  createdAt: NOW,
  lastLogin: NOW,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when fields missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: '', email: '', password: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('MISSING_FIELD');
  });

  it('should return 400 when password too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'newuser', email: 'new@test.com', password: '1234567' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('WEAK_PASSWORD');
  });

  it('should return 409 when username or email already exists', async () => {
    waitData.push([USER_ROW]); // existing user found
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'testuser', email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).errorCode).toBe('DUPLICATE_ACCOUNT');
  });

  it('should register a new user and return token', async () => {
    waitData.push([]); // no existing user
    mockHashPassword.mockResolvedValueOnce('hashed-password');
    waitData.push([USER_ROW]); // insert returning

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'newuser', email: 'new@test.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toMatchObject({ username: 'testuser' });
  });
});

describe('POST /api/auth/login', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when fields missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('MISSING_FIELD');
  });

  it('should return 401 when user not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nonexistent', password: 'pass1234' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 when password is wrong', async () => {
    waitData.push([USER_ROW]);
    mockVerifyPassword.mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'wrongpass' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_CREDENTIALS');
  });

  it('should login successfully and return token', async () => {
    waitData.push([USER_ROW]);
    mockVerifyPassword.mockResolvedValueOnce(true);
    // Update last login
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined); // update returns nothing

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'correctpass' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user).toMatchObject({ username: 'testuser' });
  });
});

describe('POST /api/auth/google', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when credential missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { clientId: 'abc' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('MISSING_CREDENTIAL');
  });

  it('should return 401 when Google token verification fails (network error)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'bad-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('GOOGLE_AUTH_FAILED');
  });

  it('should return 401 when Google token audience mismatches', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-999',
        email: 'wrongaud@example.com',
        name: 'Wrong Audience',
        aud: 'other-client-id',
      }),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('GOOGLE_AUTH_FAILED');
  });

  it('should return 401 when Google API returns non-ok status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'bad-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('should login existing google user by email', async () => {
    // Mock fetch to return a valid Google payload
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        aud: 'my-client-id',
      }),
    });

    waitData.push([{ ...USER_ROW, avatarUrl: null }]); // existing user
    // Update last login & maybe avatar
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
    expect(body.user.email).toBe('test@example.com');
  });

  it('should register a new google user', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-456',
        email: 'newgoogle@example.com',
        name: 'New Google User',
        picture: null,
        aud: 'my-client-id',
      }),
    });

    waitData.push([]); // no existing user by email
    waitData.push([]); // no existing user by username (username check)
    mockHashPassword.mockResolvedValueOnce('hashed-random');
    waitData.push([{ ...USER_ROW, username: 'newgoogle' }]); // insert returning

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('token');
  });

  it('should use given_name when name is not provided by Google', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-777',
        email: 'givenname@example.com',
        given_name: 'Given Name User',
        picture: null,
        aud: 'my-client-id',
      }),
    });

    waitData.push([]);
    waitData.push([]);
    mockHashPassword.mockResolvedValueOnce('hashed-random');
    waitData.push([{ ...USER_ROW, username: 'givenname' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should return 400 when Google account has no email', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-789',
        name: 'No Email User',
        aud: 'my-client-id',
      }),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('GOOGLE_AUTH_FAILED');
  });

  it('should handle username collision when registering new google user', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-101',
        email: 'collide@example.com',
        name: 'Collide User',
        picture: null,
        aud: 'my-client-id',
      }),
    });

    // No existing user by email
    waitData.push([]);
    // First username attempt taken → needs suffix
    waitData.push([{ id: 'other', username: 'collide' }]);
    // Second username attempt free
    waitData.push([]);
    mockHashPassword.mockResolvedValueOnce('hashed-random');
    waitData.push([{ ...USER_ROW, username: 'collide1' }]); // insert returning

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.username).toBe('collide1');
  });

  it('should use email prefix as name when name and given_name are missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sub: 'google-999',
        email: 'emailonly@example.com',
        // no name, no given_name
        picture: null,
        aud: 'my-client-id',
      }),
    });

    // No existing user by email
    waitData.push([]);
    // No existing user by username
    waitData.push([]);
    mockHashPassword.mockResolvedValueOnce('hashed-random');
    waitData.push([{ ...USER_ROW, username: 'emailonly', displayName: 'emailonly' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { credential: 'valid-token', clientId: 'my-client-id' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).user.displayName).toBe('emailonly');
  });
});

describe('PATCH /api/auth/profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when no fields to update', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('MISSING_FIELD');
  });

  it('should update displayName', async () => {
    waitData.push([{ ...USER_ROW, displayName: 'New Name' }]); // returning
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).displayName).toBe('New Name');
  });

  it('should set displayName to null when empty string', async () => {
    waitData.push([{ ...USER_ROW, displayName: null }]);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: '' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ displayName: null }));
  });

  it('should set avatarUrl to null when empty string', async () => {
    waitData.push([{ ...USER_ROW, avatarUrl: null }]);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { avatarUrl: '' },
    });
    expect(res.statusCode).toBe(200);
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }));
  });

  it('should return 400 for invalid avatarData format', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { avatarData: 'not-base64' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_AVATAR');
  });

  it('should return 400 for oversized avatarData', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { avatarData: 'data:image/png;base64,' + 'A'.repeat(2_800_001) },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_AVATAR');
  });

  it('should accept valid avatarData', async () => {
    waitData.push([{ ...USER_ROW, avatarUrl: 'data:image/png;base64,AA==' }]);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { avatarData: 'data:image/png;base64,AA==' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('should return 400 for bio over 500 chars', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { bio: 'x'.repeat(501) },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('VALIDATION_ERROR');
  });

  it('should set bio to null when empty string is sent', async () => {
    waitData.push([{ ...USER_ROW }]);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { bio: '' },
    });
    expect(res.statusCode).toBe(200);
    // Verify db.update was called with bio: null (mapUser doesn't expose bio)
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ bio: null }));
  });

  it('should return 400 for invalid language', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'fr' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('VALIDATION_ERROR');
  });

  it('should accept valid language', async () => {
    waitData.push([{ ...USER_ROW, language: 'es' }]);
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'es' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).language).toBe('es');
  });

  it('should return 400 for username shorter than 3 chars', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'ab' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 for username with invalid characters', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'user name!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 409 when username already taken', async () => {
    waitData.push([{ id: 'user-2', username: 'existing' }]); // conflict found
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'existing' },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).errorCode).toBe('DUPLICATE_USERNAME');
  });

  it('should update username when unique', async () => {
    waitData.push([]); // no conflict
    waitData.push([{ ...USER_ROW, username: 'newname' }]); // returning
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/auth/profile',
      headers: { authorization: 'Bearer valid-token' },
      payload: { username: 'newname' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).username).toBe('newname');
  });
});

describe('POST /api/auth/change-password', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when fields missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: 'Bearer valid-token' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when new password too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: 'Bearer valid-token' },
      payload: { currentPassword: 'oldpass', newPassword: '123' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('WEAK_PASSWORD');
  });

  it('should return 404 when user not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: 'Bearer valid-token' },
      payload: { currentPassword: 'oldpass', newPassword: 'newpass1234' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 when current password is wrong', async () => {
    waitData.push([USER_ROW]);
    mockVerifyPassword.mockResolvedValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: 'Bearer valid-token' },
      payload: { currentPassword: 'wrong', newPassword: 'newpass1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('WRONG_PASSWORD');
  });

  it('should change password successfully', async () => {
    waitData.push([USER_ROW]);
    mockVerifyPassword.mockResolvedValueOnce(true);
    mockHashPassword.mockResolvedValueOnce('new-hash');
    // update
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { authorization: 'Bearer valid-token' },
      payload: { currentPassword: 'oldpass', newPassword: 'newpass1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });
});

describe('POST /api/auth/forgot-password', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when email missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 when email not configured', async () => {
    mockIsEmailConfigured.mockReturnValueOnce(false);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).errorCode).toBe('EMAIL_NOT_CONFIGURED');
  });

  it('should return generic message when user not found (security)', async () => {
    mockIsEmailConfigured.mockReturnValueOnce(true);
    waitData.push([]); // user not found
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'unknown@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toContain('If that email is registered');
  });

  it('should send email and return generic message on success', async () => {
    mockIsEmailConfigured.mockReturnValueOnce(true);
    waitData.push([USER_ROW]); // user found
    mockHashPassword.mockResolvedValueOnce('new-hash');
    // update
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);
    mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toContain('If that email is registered');
  });

  it('should return 500 when email send fails', async () => {
    mockIsEmailConfigured.mockReturnValueOnce(true);
    waitData.push([USER_ROW]);
    mockHashPassword.mockResolvedValueOnce('new-hash');
    mockDb.update.mockReturnThis();
    mockDb.set.mockReturnThis();
    mockDb.where.mockReturnThis();
    waitData.push(undefined);
    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP error'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'test@example.com' },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).errorCode).toBe('EMAIL_FAILED');
  });
});

describe('GET /api/auth/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    setupMockDb();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 404 when user not found', async () => {
    waitData.push([]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).errorCode).toBe('USER_NOT_FOUND');
  });

  it('should return current user', async () => {
    waitData.push([USER_ROW]);
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer valid-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ username: 'testuser', email: 'test@example.com' });
  });
});
