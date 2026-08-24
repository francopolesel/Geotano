import { create } from 'zustand';
import { TRUCO_DIFFICULTIES, type TrucoDifficulty } from './trucoPrefsStore';

export interface TrucoDifficultyStats {
  games: number;
  wins: number;
  losses: number;
}

export interface TruCpuStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  byDifficulty: Record<TrucoDifficulty, TrucoDifficultyStats>;
}

interface TruCpuStatsState {
  stats: TruCpuStats;
  hydrate: () => void;
  recordMatchResult: (difficulty: TrucoDifficulty, won: boolean) => void;
}

export const TRUCO_CPU_STATS_KEY = 'truco-cpu-stats-v1';

function emptyDifficultyStats(): Record<TrucoDifficulty, TrucoDifficultyStats> {
  return {
    easy: { games: 0, wins: 0, losses: 0 },
    medium: { games: 0, wins: 0, losses: 0 },
    hard: { games: 0, wins: 0, losses: 0 },
  };
}

function emptyStats(): TruCpuStats {
  return { gamesPlayed: 0, wins: 0, losses: 0, byDifficulty: emptyDifficultyStats() };
}

function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/** Win rate as a rounded percentage (0 when no games were played). */
export function selectWinRate(stats: TruCpuStats): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 100);
}

/**
 * Difficulty with the most games played; ties keep the earlier difficulty in
 * enum order so the result is deterministic. `null` before any game.
 */
export function selectMostPlayedDifficulty(stats: TruCpuStats): TrucoDifficulty | null {
  let best: TrucoDifficulty | null = null;
  let bestGames = 0;
  for (const difficulty of TRUCO_DIFFICULTIES) {
    const games = stats.byDifficulty[difficulty].games;
    if (games > bestGames) {
      best = difficulty;
      bestGames = games;
    }
  }
  return best;
}

/**
 * CPU match statistics persisted under the namespaced `truco-*` key.
 * Hydrated on boot in main.tsx; recorded by the CPU controller on match end.
 */
export const useTruCpuStatsStore = create<TruCpuStatsState>((set, get) => ({
  stats: emptyStats(),

  hydrate: () => {
    const raw = localStorage.getItem(TRUCO_CPU_STATS_KEY);
    if (raw === null) return;
    try {
      // Merge defensively over an empty base so partial or legacy-shaped
      // payloads can never produce undefined buckets.
      const parsed = JSON.parse(raw) as Partial<TruCpuStats>;
      const base = emptyDifficultyStats();
      for (const difficulty of TRUCO_DIFFICULTIES) {
        const bucket = parsed.byDifficulty?.[difficulty];
        if (bucket) {
          base[difficulty] = {
            games: nonNegativeInt(bucket.games),
            wins: nonNegativeInt(bucket.wins),
            losses: nonNegativeInt(bucket.losses),
          };
        }
      }
      set({
        stats: {
          gamesPlayed: nonNegativeInt(parsed.gamesPlayed),
          wins: nonNegativeInt(parsed.wins),
          losses: nonNegativeInt(parsed.losses),
          byDifficulty: base,
        },
      });
    } catch {
      localStorage.removeItem(TRUCO_CPU_STATS_KEY);
    }
  },

  recordMatchResult: (difficulty, won) => {
    const current = get().stats;
    const bucket = current.byDifficulty[difficulty];
    const next: TruCpuStats = {
      gamesPlayed: current.gamesPlayed + 1,
      wins: current.wins + (won ? 1 : 0),
      losses: current.losses + (won ? 0 : 1),
      byDifficulty: {
        ...current.byDifficulty,
        [difficulty]: {
          ...bucket,
          games: bucket.games + 1,
          wins: bucket.wins + (won ? 1 : 0),
          losses: bucket.losses + (won ? 0 : 1),
        },
      },
    };
    localStorage.setItem(TRUCO_CPU_STATS_KEY, JSON.stringify(next));
    set({ stats: next });
  },
}));
