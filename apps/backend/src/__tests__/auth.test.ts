import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken, authGuard } from '../auth/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ─── Password hashing ───────────────────────────────────────────────────────

describe('password hashing', () => {
  it('should hash a password and verify with correct password', async () => {
    const password = 'mySecret123!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const password = 'mySecret123!';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for the same password (salt)', async () => {
    const password = 'samePassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });
});

// ─── JWT signing / verification ─────────────────────────────────────────────

describe('JWT', () => {
  const payload = { userId: 'user-123', username: 'testuser' };

  it('should sign and verify a valid token', () => {
    const token = signToken(payload);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.username).toBe('testuser');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
  });

  it('should throw on an invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  it('should throw on a tampered token', () => {
    const token = signToken(payload);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    expect(() => verifyToken(tampered)).toThrow();
  });

  it('should decode the correct username from token', () => {
    const token = signToken({ userId: 'abc', username: 'geotano_fan' });
    const decoded = verifyToken(token);
    expect(decoded.username).toBe('geotano_fan');
  });
});

// ─── Auth guard middleware ───────────────────────────────────────────────────

describe('authGuard middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let sendSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ send: sendSpy });
    mockRequest = {
      headers: {},
    };
    mockReply = {
      status: statusSpy,
      send: sendSpy,
    } as unknown as FastifyReply;
  });

  it('should return 401 when no authorization header is present', async () => {
    await authGuard(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
    );

    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(sendSpy).toHaveBeenCalledWith({
      message: 'Missing or invalid authorization header',
    });
  });

  it('should return 401 when authorization header is not Bearer', async () => {
    mockRequest.headers = { authorization: 'Basic token123' };

    await authGuard(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
    );

    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(sendSpy).toHaveBeenCalledWith({
      message: 'Missing or invalid authorization header',
    });
  });

  it('should return 401 when token is invalid', async () => {
    mockRequest.headers = { authorization: 'Bearer invalid-token' };

    await authGuard(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
    );

    expect(statusSpy).toHaveBeenCalledWith(401);
    expect(sendSpy).toHaveBeenCalledWith({
      message: 'Invalid or expired token',
    });
  });

  it('should set user on request when token is valid', async () => {
    const token = signToken({ userId: 'user-123', username: 'testuser' });
    mockRequest.headers = { authorization: `Bearer ${token}` };

    // We need to check that the request.user gets set — authGuard doesn't call
    // reply.send on success, it just resolves. Use a promise to catch resolution.
    await authGuard(
      mockRequest as FastifyRequest,
      mockReply as FastifyReply,
    );

    expect(statusSpy).not.toHaveBeenCalled();
    expect((mockRequest as any).user).toBeDefined();
    expect((mockRequest as any).user.userId).toBe('user-123');
    expect((mockRequest as any).user.username).toBe('testuser');
  });
});
