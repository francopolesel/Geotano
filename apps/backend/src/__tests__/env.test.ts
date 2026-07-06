import { describe, it, expect, vi, afterEach } from 'vitest';

// Note: env.ts is NOT imported at top level — it reads process.env at import time.
// Each test dynamically imports it after setting env state.

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('env config', () => {
  it('should read DATABASE_URL from env', async () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb';
    process.env.JWT_SECRET = 'test-secret';
    vi.resetModules();
    const { env } = await import('../config/env.js');
    expect(env.DATABASE_URL).toBe('postgres://test:test@localhost:5432/testdb');
    expect(env.JWT_SECRET).toBe('test-secret');
  });

  it('should provide defaults for optional vars', async () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.HOST;
    delete process.env.CORS_ORIGIN;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.REST_COUNTRIES_API_KEY;
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb';
    process.env.JWT_SECRET = 'test-secret';
    vi.resetModules();
    const { env } = await import('../config/env.js');
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
    expect(env.JWT_EXPIRES_IN).toBe('7d');
    expect(env.REST_COUNTRIES_API_KEY).toBe('');
    expect(env.REST_COUNTRIES_URL).toBe('https://api.restcountries.com/v5');
  });

  it('should throw when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret';
    vi.resetModules();
    await expect(import('../config/env.js')).rejects.toThrow(
      'Missing required environment variable: DATABASE_URL',
    );
  });

  it('should throw when JWT_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb';
    delete process.env.JWT_SECRET;
    vi.resetModules();
    await expect(import('../config/env.js')).rejects.toThrow(
      'Missing required environment variable: JWT_SECRET',
    );
  });
});
