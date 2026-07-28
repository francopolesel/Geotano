import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useMultiplayerStore } from '../store/multiplayerStore';
import { useAuthStore } from '../store/authStore';
import type { UserProfile, QuizQuestion, MatchResult, PlayerStats } from '@geotano/shared';

// Mock api for authStore
vi.mock('../lib/api', () => ({
  api: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock the socket hook
vi.mock('../features/multiplayer/useMultiplayerSocket', () => ({
  useMultiplayerSocket: vi.fn(),
}));

// Mock the socket lib
vi.mock('../lib/socket', () => ({
  getSocket: vi.fn(() => null),
  submitMatchAnswer: vi.fn(),
}));

import { MultiplayerPage } from '../features/multiplayer/MultiplayerPage';

function renderWithRouter(element: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/multiplayer/match-1']}>
        <Routes>
          <Route path="/multiplayer/:matchId" element={element} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('MultiplayerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({
      matchId: null, screen: 'lobby', opponent: null, question: null,
      score: 0, streak: 0, opponentAnswered: false, remainingMs: 180_000,
      result: null, challengeNotification: null,
    });
    // Set authenticated user
    useAuthStore.setState({
      user: { id: 'user-1', username: 'current_user', email: 'test@test.com', language: 'en', joinCode: '', createdAt: '' },
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('lobby screen', () => {
    it('should show waiting text when in lobby with opponent', () => {
      const opponent: UserProfile = {
        id: 'user-2', username: 'alice', displayName: 'Alice',
        email: '', language: 'en', joinCode: '', createdAt: '',
      };
      useMultiplayerStore.setState({ screen: 'lobby', opponent });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/waiting/i)).toBeTruthy();
      expect(screen.getByText(/alice/i)).toBeTruthy();
    });

    it('should show default waiting text when no opponent', () => {
      useMultiplayerStore.setState({ screen: 'lobby', opponent: null });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/waiting/i)).toBeTruthy();
    });

    it('should show a cancel button in lobby', () => {
      const opponent: UserProfile = {
        id: 'user-2', username: 'bob',
        email: '', language: 'en', joinCode: '', createdAt: '',
      };
      useMultiplayerStore.setState({ screen: 'lobby', opponent });

      renderWithRouter(<MultiplayerPage />);

      const cancelBtn = screen.getByRole('button');
      expect(cancelBtn).toBeDefined();
    });
  });

  describe('playing screen', () => {
    const opponent: UserProfile = {
      id: 'user-2', username: 'charlie', displayName: 'Charlie',
      email: '', language: 'en', joinCode: '', createdAt: '',
    };
    const question: QuizQuestion = {
      id: 'q-1', countryId: 'c-1', questionType: 'free',
      questionText: 'What is the capital of France?',
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
      correctIndex: 0, timeLimitMs: 3000, questionNumber: 1,
    };

    beforeEach(() => {
      useMultiplayerStore.setState({
        screen: 'playing',
        matchId: 'match-1',
        opponent,
        question,
        score: 300,
        streak: 3,
        remainingMs: 120_000,
      });
    });

    it('should show the question text', () => {
      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText('What is the capital of France?')).toBeDefined();
    });

    it('should show the score', () => {
      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText('300')).toBeDefined();
    });

    it('should show the timer bar', () => {
      renderWithRouter(<MultiplayerPage />);

      // Timer bar should be present
      const timerContainer = document.querySelector('.overflow-hidden.rounded-full');
      expect(timerContainer).toBeDefined();
    });

    it('should show answer options', () => {
      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText('Paris')).toBeDefined();
      expect(screen.getByText('London')).toBeDefined();
      expect(screen.getByText('Berlin')).toBeDefined();
      expect(screen.getByText('Madrid')).toBeDefined();
    });

    it('should show opponent indicator when opponent answered', () => {
      useMultiplayerStore.setState({ opponentAnswered: true });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/opponent answered/i)).toBeDefined();
    });

    it('should not show opponent indicator when opponent has not answered', () => {
      useMultiplayerStore.setState({ opponentAnswered: false });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.queryByText(/opponent answered/i)).toBeNull();
    });

    it('should show streak fire when streak >= 5', () => {
      useMultiplayerStore.setState({ streak: 5 });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/streak/i)).toBeDefined();
    });
  });

  describe('ended screen', () => {
    const playerA: PlayerStats = {
      userId: 'user-1', username: 'current_user', displayName: 'You',
      score: 800, correctCount: 8, totalAnswered: 10, maxStreak: 5,
    };
    const playerB: PlayerStats = {
      userId: 'user-2', username: 'opponent_user', displayName: 'Opponent',
      score: 600, correctCount: 6, totalAnswered: 10, maxStreak: 4,
    };
    const opponent: UserProfile = {
      id: 'user-2', username: 'opponent_user', displayName: 'Opponent',
      email: '', language: 'en', joinCode: '', createdAt: '',
    };

    it('should show winner message when current user won', () => {
      const result: MatchResult = {
        matchId: 'match-1', winnerId: 'user-1',
        reason: 'timer_expired', players: [playerA, playerB],
      };
      useMultiplayerStore.setState({
        screen: 'ended', result, matchId: 'match-1', opponent,
      });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/won/i)).toBeDefined();
    });

    it('should show loser message when opponent won', () => {
      const result: MatchResult = {
        matchId: 'match-1', winnerId: 'user-2',
        reason: 'both_finished', players: [playerA, playerB],
      };
      useMultiplayerStore.setState({
        screen: 'ended', result, matchId: 'match-1', opponent,
      });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/lost/i)).toBeDefined();
    });

    it('should show tie message when winnerId is null', () => {
      const result: MatchResult = {
        matchId: 'match-1', winnerId: null,
        reason: 'both_finished', players: [playerA, playerB],
      };
      useMultiplayerStore.setState({
        screen: 'ended', result, matchId: 'match-1', opponent,
      });

      renderWithRouter(<MultiplayerPage />);

      expect(screen.getByText(/tie/i)).toBeDefined();
    });

    it('should show scores and stats for both players', () => {
      const result: MatchResult = {
        matchId: 'match-1', winnerId: 'user-1',
        reason: 'both_finished', players: [playerA, playerB],
      };
      useMultiplayerStore.setState({
        screen: 'ended', result, matchId: 'match-1', opponent,
      });

      renderWithRouter(<MultiplayerPage />);

      // Both scores should appear (exact match on numbers)
      expect(screen.getByText('800')).toBeDefined();
      expect(screen.getByText('600')).toBeDefined();
      // Correct count labels
      expect(screen.getByText('Correct: 8')).toBeDefined();
      expect(screen.getByText('Correct: 6')).toBeDefined();
    });

    it('should show back to home button', () => {
      const result: MatchResult = {
        matchId: 'match-1', winnerId: null,
        reason: 'opponent_disconnected', players: [playerA, playerB],
      };
      useMultiplayerStore.setState({
        screen: 'ended', result, matchId: 'match-1', opponent,
      });

      renderWithRouter(<MultiplayerPage />);

      // Using the exact text from i18n key
      expect(screen.getByText('Back to Home')).toBeDefined();
    });
  });
});
