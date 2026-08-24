import { create } from 'zustand';
// Single source of truth for safe persona indexing lives with the roster
// (remediation #8): the store never persists or exposes an unsafe index.
import { normalizePersonaIndex } from '../features/truco/ai';

export type TrucoDifficulty = 'easy' | 'medium' | 'hard';
export type TrucoTargetPoints = 15 | 30;

interface TrucoPrefs {
  difficulty: TrucoDifficulty;
  targetPoints: TrucoTargetPoints;
  personaIndex: number;
}

interface TrucoPrefsState extends TrucoPrefs {
  hydrate: () => void;
  setDifficulty: (difficulty: TrucoDifficulty) => void;
  setTargetPoints: (targetPoints: TrucoTargetPoints) => void;
  setPersonaIndex: (personaIndex: number) => void;
}

export const TRUCO_PREFS_KEY = 'truco-prefs-v1';

/** Single source of the difficulty list (remediation #16): validation,
 * stats buckets and menu pickers all read THIS array. */
export const TRUCO_DIFFICULTIES: readonly TrucoDifficulty[] = ['easy', 'medium', 'hard'];

const DEFAULT_PREFS: TrucoPrefs = {
  difficulty: 'easy',
  targetPoints: 30,
  personaIndex: 0,
};

function isDifficulty(value: unknown): value is TrucoDifficulty {
  return typeof value === 'string' && (TRUCO_DIFFICULTIES as readonly string[]).includes(value);
}

function isTargetPoints(value: unknown): value is TrucoTargetPoints {
  return value === 15 || value === 30;
}

function persist(prefs: TrucoPrefs) {
  localStorage.setItem(TRUCO_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Last-used Truco preferences (difficulty / target / persona), namespaced
 * under `truco-*` per the store-owned persistence spec. Hydrated on boot in
 * main.tsx following the theme/auth store pattern.
 */
export const useTrucoPrefsStore = create<TrucoPrefsState>((set, get) => ({
  ...DEFAULT_PREFS,

  hydrate: () => {
    const raw = localStorage.getItem(TRUCO_PREFS_KEY);
    if (raw === null) return;
    try {
      const parsed = JSON.parse(raw) as Partial<TrucoPrefs>;
      set({
        difficulty: isDifficulty(parsed.difficulty) ? parsed.difficulty : get().difficulty,
        targetPoints: isTargetPoints(parsed.targetPoints)
          ? parsed.targetPoints
          : get().targetPoints,
        personaIndex:
          typeof parsed.personaIndex === 'number' && Number.isFinite(parsed.personaIndex)
            ? normalizePersonaIndex(parsed.personaIndex)
            : get().personaIndex,
      });
    } catch {
      // Corrupted payload — drop it and reset to defaults (authStore pattern)
      localStorage.removeItem(TRUCO_PREFS_KEY);
      set({ ...DEFAULT_PREFS });
    }
  },

  setDifficulty: (difficulty) => {
    const prefs = { ...get(), difficulty };
    persist(prefs);
    set(prefs);
  },

  setTargetPoints: (targetPoints) => {
    const prefs = { ...get(), targetPoints };
    persist(prefs);
    set(prefs);
  },

  setPersonaIndex: (personaIndex) => {
    const prefs = { ...get(), personaIndex: normalizePersonaIndex(personaIndex) };
    persist(prefs);
    set(prefs);
  },
}));
