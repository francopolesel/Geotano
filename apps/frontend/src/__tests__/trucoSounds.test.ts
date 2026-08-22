import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Fake WebAudio surface (counts real synthesis activity) ────────────────

let ctxInstances = 0;
let oscCount = 0;

class FakeAudioContext {
  destination: Record<string, never> = {};
  currentTime = 0;
  state = 'running';
  resume() {}
  constructor() {
    ctxInstances++;
  }
  createOscillator() {
    oscCount++;
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      connect: () => {},
    };
  }
}

const TRUCO_SOUND_FNS = [
  'playTrucoDeal',
  'playTrucoCardPlayed',
  'playTrucoCallEnvido',
  'playTrucoCallTruco',
  'playTrucoQuiero',
  'playTrucoNoQuiero',
  'playTrucoBazaWon',
  'playTrucoHandEnded',
  'playTrucoMatchWon',
  'playTrucoMatchLost',
] as const;

/** Fresh module graph per test — sounds.ts caches its AudioContext singleton. */
async function load() {
  const sounds = await import('../lib/sounds');
  const { useSoundStore } = await import('../store/soundStore');
  return { sounds, useSoundStore };
}

describe('truco synth sounds', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorageMock.clear();
    vi.clearAllMocks();
    ctxInstances = 0;
    oscCount = 0;
    // test-setup.ts pre-defines window.AudioContext (writable, but NOT
    // configurable/redefinable) — swap the value, never delete or redefine.
    (globalThis as any).AudioContext = FakeAudioContext;
  });

  it('exports exactly the ten truco trigger functions (trigger coverage)', async () => {
    const { sounds } = await load();

    for (const fnName of TRUCO_SOUND_FNS) {
      expect(typeof (sounds as Record<string, unknown>)[fnName]).toBe('function');
    }
    expect(
      Object.keys(sounds).filter((k) => k.startsWith('playTruco')).length,
    ).toBe(10);
  });

  it('muted setting persisted in localStorage silences ALL ten sounds', async () => {
    // Persisted mute — what Settings writes and main.tsx hydrates at boot
    localStorage.setItem('soundEnabled', 'false');

    const { sounds, useSoundStore } = await load();
    useSoundStore.getState().hydrate();
    expect(useSoundStore.getState().soundEnabled).toBe(false);

    for (const fnName of TRUCO_SOUND_FNS) {
      (sounds as Record<string, () => void>)[fnName]();
    }

    expect(ctxInstances).toBe(0);
    expect(oscCount).toBe(0);
  });

  it('enabled setting synthesizes audio for every trigger', async () => {
    localStorage.setItem('soundEnabled', 'true');

    const { sounds, useSoundStore } = await load();
    useSoundStore.getState().hydrate();
    expect(useSoundStore.getState().soundEnabled).toBe(true);

    for (const fnName of TRUCO_SOUND_FNS) {
      oscCount = 0;
      (sounds as Record<string, () => void>)[fnName]();
      expect(oscCount, `${fnName} produced no oscillators`).toBeGreaterThan(0);
    }

    expect(ctxInstances).toBe(1); // lazy singleton reused across triggers
  });
});
