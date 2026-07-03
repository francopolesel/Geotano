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

import { api } from '../lib/api';

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
