import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (run before any imports) ──────────────────────────────────

const mockI18n = vi.hoisted(() => ({
  use: vi.fn(function (this: any) {
    return this;
  }),
  init: vi.fn(),
  on: vi.fn(),
  language: 'en',
  changeLanguage: vi.fn(),
  t: (key: string) => key,
}));

const localStorageMock = vi.hoisted(() => {
  let store: Record<string, string> = {};
  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  });
  return mock;
});

vi.mock('i18next', () => ({
  default: mockI18n,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {},
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    localStorageMock.clear();
  });

  it('should initialize i18n with saved locale from localStorage', async () => {
    localStorageMock.setItem('locale', 'es');

    await import('./i18n');

    expect(mockI18n.init).toHaveBeenCalledWith(
      expect.objectContaining({ lng: 'es' }),
    );
  });

  it('should default to en when no locale is saved', async () => {
    await import('./i18n');

    expect(mockI18n.init).toHaveBeenCalledWith(
      expect.objectContaining({ lng: 'en' }),
    );
  });

  it('should register a languageChanged event handler', async () => {
    await import('./i18n');

    expect(mockI18n.on).toHaveBeenCalledWith(
      'languageChanged',
      expect.any(Function),
    );
  });

  it('should persist locale to localStorage on languageChanged event', async () => {
    await import('./i18n');

    const callback = mockI18n.on.mock.calls.find(
      (call) => call[0] === 'languageChanged',
    )?.[1];

    expect(callback).toBeDefined();
    expect(typeof callback).toBe('function');

    callback('fr');

    expect(localStorageMock.setItem).toHaveBeenCalledWith('locale', 'fr');
  });
});
