import { create } from 'zustand';
import type { GameModeSlug, QuizQuestion } from '@geotano/shared';

interface GameState {
  mode: GameModeSlug | null;
  sessionId: string | null;
  currentQuestion: QuizQuestion | null;
  score: number;
  lives: number;
  streak: number;
  isPlaying: boolean;

  setMode: (mode: GameModeSlug) => void;
  startSession: (sessionId: string) => void;
  setQuestion: (q: QuizQuestion) => void;
  updateScore: (points: number) => void;
  loseLife: () => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  endGame: () => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  mode: null,
  sessionId: null,
  currentQuestion: null,
  score: 0,
  lives: 3,
  streak: 0,
  isPlaying: false,

  setMode: (mode) => set({ mode }),
  startSession: (sessionId) => set({ sessionId, isPlaying: true }),
  setQuestion: (q) => set({ currentQuestion: q }),
  updateScore: (points) => set((s) => ({ score: s.score + points })),
  loseLife: () => set((s) => ({ lives: s.lives - 1 })),
  incrementStreak: () => set((s) => ({ streak: s.streak + 1 })),
  resetStreak: () => set({ streak: 0 }),
  endGame: () => set({ isPlaying: false, currentQuestion: null }),
  reset: () =>
    set({
      sessionId: null,
      currentQuestion: null,
      score: 0,
      lives: 3,
      streak: 0,
      isPlaying: false,
    }),
}));
