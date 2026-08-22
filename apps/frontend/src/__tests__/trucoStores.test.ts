import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock localStorage (same pattern as stores.test.ts)
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

import {
  useTrucoPrefsStore,
  TRUCO_PREFS_KEY,
} from '../store/trucoPrefsStore';
import {
  useTruCpuStatsStore,
  selectWinRate,
  selectMostPlayedDifficulty,
  TRUCO_CPU_STATS_KEY,
} from '../store/truCpuStatsStore';

// ─── Prefs Store ────────────────────────────────────────────────────────────

describe('trucoPrefsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useTrucoPrefsStore.setState({
      difficulty: 'easy',
      targetPoints: 30,
      personaIndex: 0,
    });
  });

  it('starts with defaults: easy / 30 / persona 0', () => {
    const s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('easy');
    expect(s.targetPoints).toBe(30);
    expect(s.personaIndex).toBe(0);
  });

  it('setters update state and persist the full prefs object', () => {
    useTrucoPrefsStore.getState().setDifficulty('hard');

    let s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('hard');
    expect(JSON.parse(localStorageMock.getItem(TRUCO_PREFS_KEY)!)).toEqual({
      difficulty: 'hard',
      targetPoints: 30,
      personaIndex: 0,
    });

    useTrucoPrefsStore.getState().setTargetPoints(15);
    s = useTrucoPrefsStore.getState();
    expect(s.targetPoints).toBe(15);

    useTrucoPrefsStore.getState().setPersonaIndex(3);
    s = useTrucoPrefsStore.getState();
    expect(s.personaIndex).toBe(3);
  });

  it('persists round-trip: hydrate restores what was saved', () => {
    useTrucoPrefsStore.getState().setDifficulty('hard');
    useTrucoPrefsStore.getState().setTargetPoints(15);
    useTrucoPrefsStore.getState().setPersonaIndex(2);

    // Simulate a reload: wipe in-memory state back to defaults, rehydrate
    useTrucoPrefsStore.setState({
      difficulty: 'easy',
      targetPoints: 30,
      personaIndex: 0,
    });
    useTrucoPrefsStore.getState().hydrate();

    const s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('hard');
    expect(s.targetPoints).toBe(15);
    expect(s.personaIndex).toBe(2);
  });

  it('hydrates defaults when nothing is stored', () => {
    useTrucoPrefsStore.getState().hydrate();

    const s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('easy');
    expect(s.targetPoints).toBe(30);
    expect(s.personaIndex).toBe(0);
  });

  it('recovers from corrupted stored JSON (defaults + key removed)', () => {
    localStorageMock.setItem(TRUCO_PREFS_KEY, '{not-valid-json');
    useTrucoPrefsStore.setState({ difficulty: 'medium' });

    useTrucoPrefsStore.getState().hydrate();

    const s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('easy');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(TRUCO_PREFS_KEY);
  });

  it('fills gaps when stored prefs are only partially valid', () => {
    localStorageMock.setItem(
      TRUCO_PREFS_KEY,
      JSON.stringify({ difficulty: 'hard', targetPoints: 99, personaIndex: 'x' }),
    );

    useTrucoPrefsStore.getState().hydrate();

    const s = useTrucoPrefsStore.getState();
    expect(s.difficulty).toBe('hard');
    expect(s.targetPoints).toBe(30); // invalid value rejected → default kept
    expect(s.personaIndex).toBe(0); // invalid type rejected → default kept
  });
});

// ─── CPU Stats Store ────────────────────────────────────────────────────────

describe('truCpuStatsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    useTruCpuStatsStore.setState({
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        byDifficulty: {
          easy: { games: 0, wins: 0, losses: 0 },
          medium: { games: 0, wins: 0, losses: 0 },
          hard: { games: 0, wins: 0, losses: 0 },
        },
      },
    });
  });

  it('accumulates a Medium win plus a Hard loss into totals and per-difficulty buckets', () => {
    const store = useTruCpuStatsStore.getState();
    store.recordMatchResult('medium', true);
    useTruCpuStatsStore.getState().recordMatchResult('hard', false);

    const { stats } = useTruCpuStatsStore.getState();
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.wins).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.byDifficulty.medium).toEqual({ games: 1, wins: 1, losses: 0 });
    expect(stats.byDifficulty.hard).toEqual({ games: 1, wins: 0, losses: 1 });
    expect(stats.byDifficulty.easy).toEqual({ games: 0, wins: 0, losses: 0 });
  });

  it('persists stats on every recorded match', () => {
    useTruCpuStatsStore.getState().recordMatchResult('easy', true);

    const stored = JSON.parse(localStorageMock.getItem(TRUCO_CPU_STATS_KEY)!);
    expect(stored.gamesPlayed).toBe(1);
    expect(stored.wins).toBe(1);
  });

  it('persists round-trip: hydrate restores accumulated stats', () => {
    useTruCpuStatsStore.getState().recordMatchResult('medium', true);

    // Simulate reload
    useTruCpuStatsStore.setState({
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        byDifficulty: {
          easy: { games: 0, wins: 0, losses: 0 },
          medium: { games: 0, wins: 0, losses: 0 },
          hard: { games: 0, wins: 0, losses: 0 },
        },
      },
    });
    useTruCpuStatsStore.getState().hydrate();

    const { stats } = useTruCpuStatsStore.getState();
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.byDifficulty.medium.wins).toBe(1);
  });

  it('hydrates safely from partial or legacy-shaped payloads', () => {
    localStorageMock.setItem(
      TRUCO_CPU_STATS_KEY,
      JSON.stringify({ gamesPlayed: 4, wins: 3 }),
    );

    expect(() => useTruCpuStatsStore.getState().hydrate()).not.toThrow();

    const { stats } = useTruCpuStatsStore.getState();
    expect(stats.gamesPlayed).toBe(4);
    expect(stats.byDifficulty.easy).toBeDefined();
    expect(stats.byDifficulty.hard).toEqual({ games: 0, wins: 0, losses: 0 });
  });

  describe('derived selectors', () => {
    it('win rate is 0% with no games and rounds correctly otherwise', () => {
      expect(selectWinRate(useTruCpuStatsStore.getState().stats)).toBe(0);

      useTruCpuStatsStore.getState().recordMatchResult('easy', true);
      useTruCpuStatsStore.getState().recordMatchResult('easy', true);
      useTruCpuStatsStore.getState().recordMatchResult('easy', false);

      expect(selectWinRate(useTruCpuStatsStore.getState().stats)).toBe(67);
    });

    it('most played difficulty is null before any game', () => {
      expect(selectMostPlayedDifficulty(useTruCpuStatsStore.getState().stats)).toBeNull();
    });

    it('most played difficulty tracks the bucket with most games (ties keep the lower difficulty)', () => {
      const store = useTruCpuStatsStore.getState();
      store.recordMatchResult('medium', true);
      store.recordMatchResult('medium', true);
      useTruCpuStatsStore.getState().recordMatchResult('hard', true);

      expect(selectMostPlayedDifficulty(useTruCpuStatsStore.getState().stats)).toBe('medium');
    });
  });
});

// ─── Key namespace isolation (spec: Key namespace isolation scenario) ──────

describe('truco store key namespace isolation', () => {
  it('truco writes touch ONLY truco-* localStorage keys', () => {
    localStorageMock.clear();
    vi.clearAllMocks();

    useTrucoPrefsStore.getState().setDifficulty('hard');
    useTrucoPrefsStore.getState().setTargetPoints(15);
    useTrucoPrefsStore.getState().setPersonaIndex(1);
    useTruCpuStatsStore.getState().recordMatchResult('hard', true);

    const writtenKeys = localStorageMock.setItem.mock.calls.map(
      (call) => call[0] as string,
    );
    expect(writtenKeys.length).toBeGreaterThan(0);
    for (const key of writtenKeys) {
      expect(key.startsWith('truco-')).toBe(true);
    }

    // Existing non-namespaced keys are never repurposed
    for (const forbidden of ['auth_token', 'auth_user', 'locale', 'theme', 'soundEnabled']) {
      expect(writtenKeys).not.toContain(forbidden);
    }
  });
});
