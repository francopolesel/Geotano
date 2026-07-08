import { create } from 'zustand';
import type { GameModeSlug, QuizQuestion } from '@geotano/shared';

interface GameState {
  mode: GameModeSlug | null;
  sessionId: string | null;
  currentQuestion: QuizQuestion | null;
  score: number;
  lives: number;
  maxLives: number;
  streak: number;
  isPlaying: boolean;
  totalQuestions: number | null;

  setMode: (mode: GameModeSlug) => void;
  startSession: (sessionId: string, maxLives?: number) => void;
  setQuestion: (q: QuizQuestion) => void;
  setTotalQuestions: (n: number | null) => void;
  updateScore: (points: number) => void;
  updateLives: (n: number) => void;
  loseLife: () => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  endGame: () => void;
  reset: (maxLives?: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  mode: null,
  sessionId: null,
  currentQuestion: null,
  score: 0,
  lives: 3,
  maxLives: 3,
  streak: 0,
  isPlaying: false,
  totalQuestions: null,

  setMode: (mode) => set({ mode }),
  startSession: (sessionId, maxLives) =>
    set({
      sessionId,
      isPlaying: true,
      ...(maxLives !== undefined ? { maxLives, lives: maxLives } : {}),
    }),
  setQuestion: (q) => set({ currentQuestion: q }),
  setTotalQuestions: (n) => set({ totalQuestions: n }),
  updateScore: (points) => set((s) => ({ score: s.score + points })),
  updateLives: (n) => set({ lives: n }),
  loseLife: () => set((s) => ({ lives: s.lives - 1 })),
  incrementStreak: () => set((s) => ({ streak: s.streak + 1 })),
  resetStreak: () => set({ streak: 0 }),
  endGame: () => set({ isPlaying: false, currentQuestion: null }),
  reset: (maxLives) =>
    set({
      sessionId: null,
      currentQuestion: null,
      score: 0,
      lives: maxLives ?? 3,
      maxLives: maxLives ?? 3,
      streak: 0,
      isPlaying: false,
      totalQuestions: null,
    }),
}));
