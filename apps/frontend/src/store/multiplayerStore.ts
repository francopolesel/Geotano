import { create } from 'zustand';
import type {
  ChallengeInvitePayload,
  MatchStartPayload,
  MatchResult,
  QuizQuestion,
  UserProfile,
} from '@geotano/shared';

type Screen = 'lobby' | 'playing' | 'ended';

interface MultiplayerState {
  matchId: string | null;
  screen: Screen;
  opponent: UserProfile | null;
  question: QuizQuestion | null;
  score: number;
  streak: number;
  opponentAnswered: boolean;
  remainingMs: number;
  result: MatchResult | null;
  challengeNotification: ChallengeInvitePayload | null;

  setLobby: (opponent: UserProfile) => void;
  startMatch: (payload: MatchStartPayload) => void;
  setQuestion: (q: QuizQuestion) => void;
  updateScore: (points: number) => void;
  setStreak: (n: number) => void;
  showOpponentAnswered: (shown: boolean) => void;
  updateTimer: (remainingMs: number) => void;
  endMatch: (result: MatchResult) => void;
  showChallengeNotification: (payload: ChallengeInvitePayload) => void;
  dismissChallengeNotification: () => void;
  reset: () => void;
}

const initialState = {
  matchId: null as string | null,
  screen: 'lobby' as Screen,
  opponent: null as UserProfile | null,
  question: null as QuizQuestion | null,
  score: 0,
  streak: 0,
  opponentAnswered: false,
  remainingMs: 180_000,
  result: null as MatchResult | null,
  challengeNotification: null as ChallengeInvitePayload | null,
};

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  ...initialState,

  setLobby: (opponent) => set({ screen: 'lobby', opponent }),

  startMatch: (payload) =>
    set({
      screen: 'playing',
      matchId: payload.matchId,
      opponent: payload.opponent,
      question: payload.question,
      remainingMs: payload.timeLimitMs,
      score: 0,
      streak: 0,
      opponentAnswered: false,
      result: null,
    }),

  setQuestion: (q) => set({ question: q }),

  updateScore: (points) => set((s) => ({ score: s.score + points })),

  setStreak: (n) => set({ streak: n }),

  showOpponentAnswered: (shown) => set({ opponentAnswered: shown }),

  updateTimer: (remainingMs) => set({ remainingMs }),

  endMatch: (result) => set({ screen: 'ended', result, question: null }),

  showChallengeNotification: (payload) =>
    set({ challengeNotification: payload }),

  dismissChallengeNotification: () =>
    set({ challengeNotification: null }),

  reset: () => set({ ...initialState }),
}));
