import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock i18n ──────────────────────────────────────────────────────────────

const mockLanguage = vi.hoisted(() => {
  let _lang = 'en';
  return {
    get value() { return _lang; },
    set value(v: string) { _lang = v; },
  };
});

vi.mock('../i18n/i18n', () => ({
  default: {
    get language() { return mockLanguage.value; },
    t: (key: string) => key,
    changeLanguage: vi.fn(),
    on: vi.fn(),
  },
}));

// ─── Mock fetch ─────────────────────────────────────────────────────────────

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

// ─── Mock localStorage ──────────────────────────────────────────────────────

const mockStorage = vi.hoisted(() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
});
vi.stubGlobal('localStorage', mockStorage);

import { api, ApiError } from '../lib/api';

describe('api ?lang= interceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage.value = 'en';
    mockStorage.clear();
  });

  it('should append ?lang=en when i18n language is en', async () => {
    mockLanguage.value = 'en';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
      status: 200,
    });

    await api.get('/test');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('lang=en');
  });

  it('should append ?lang=es when i18n language is es', async () => {
    mockLanguage.value = 'es';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
      status: 200,
    });

    await api.get('/test');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('lang=es');
  });

  it('should use &lang= when URL already has query params', async () => {
    mockLanguage.value = 'en';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
      status: 200,
    });

    await api.get('/test?existing=true');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('&lang=en');
  });
});

// ─── Error Handling ─────────────────────────────────────────────────────────

describe('api error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage.value = 'en';
    mockStorage.clear();
  });

  it('should not send Authorization header when no token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
      status: 200,
    });

    await api.get('/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('should send Authorization header when token exists', async () => {
    mockStorage.setItem('auth_token', 'test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
      status: 200,
    });

    await api.get('/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-token');
  });

  it('401 response clears auth and redirects to login', async () => {
    mockStorage.setItem('auth_token', 'some-token');
    mockStorage.setItem('auth_user', '{"id":"1"}');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Session expired' }),
    });

    await expect(api.get('/test')).rejects.toThrow(ApiError);

    expect(mockStorage.removeItem).toHaveBeenCalledWith('auth_token');
    expect(mockStorage.removeItem).toHaveBeenCalledWith('auth_user');
  });

  it('non-ok response throws ApiError with parsed message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ message: 'Server error occurred' }),
    });

    await expect(api.get('/test')).rejects.toMatchObject({
      status: 500,
      message: 'Server error occurred',
    });
  });

  it('non-ok with unparseable body falls back to statusText', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    await expect(api.get('/test')).rejects.toMatchObject({
      message: 'Internal Server Error',
    });
  });

  it('non-ok response without message field falls back to HTTP status string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({}),
    });

    await expect(api.get('/test')).rejects.toMatchObject({
      status: 403,
      message: 'HTTP 403',
    });
  });
});

// ─── API Methods ────────────────────────────────────────────────────────────

describe('api methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage.value = 'en';
    mockStorage.clear();
  });

  it('post sends JSON body with POST method and injects lang', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      status: 200,
    });

    await api.post('/test', { name: 'test' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe('test');
    expect(body.lang).toBe('en'); // lang is now auto-injected into POST bodies
  });

  it('delete sends DELETE method', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
      status: 200,
    });

    await api.delete('/test/1');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });

  it('patch sends JSON body with PATCH method and injects lang', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      status: 200,
    });

    await api.patch('/test/1', { name: 'updated' });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('PATCH');
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe('updated');
    expect(body.lang).toBe('en'); // lang is now auto-injected into PATCH bodies
  });

  it('post should include lang in the request body', async () => {
    mockLanguage.value = 'es';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      status: 200,
    });

    await api.post('/quiz/answer', {
      sessionId: 's1',
      questionId: 'q1',
      answer: 'Argentina',
      timeMs: 3000,
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    // The bug: POST body does NOT include lang — backend reads it from body,
    // so it silently defaults to 'en'. The fix must inject lang into the body.
    expect(body.lang).toBe('es');
  });

  it('patch should include lang in the request body', async () => {
    mockLanguage.value = 'es';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
      status: 200,
    });

    await api.patch('/auth/profile', { bio: 'Hola mundo' });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body as string);

    expect(body.lang).toBe('es');
  });

  it('delete should still append lang only in query string (no body)', async () => {
    mockLanguage.value = 'es';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
      status: 200,
    });

    await api.delete('/test/1');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // DELETE has no body — lang must still appear in the URL
    expect(calledUrl).toContain('lang=es');
  });
});
