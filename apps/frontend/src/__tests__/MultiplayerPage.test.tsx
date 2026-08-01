import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/api';

// Mock api — use vi.hoisted to avoid hoisting issues
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, patch: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    errorCode?: string;
    constructor(message: string, status: number, errorCode?: string) {
      super(message);
      this.status = status;
      this.errorCode = errorCode;
    }
  },
}));

// Mock socket — track connectSocket so we can assert the reconnect precondition
const { mockConnectSocket, mockSetNavigateFn } = vi.hoisted(() => ({
  mockConnectSocket: vi.fn(),
  mockSetNavigateFn: vi.fn(),
}));

vi.mock('../lib/socket', () => ({
  connectSocket: mockConnectSocket,
  setNavigateFn: mockSetNavigateFn,
}));

// Mock sounds — track calls so we can assert audio feedback
const sounds = vi.hoisted(() => ({
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  playGameWin: vi.fn(),
  playGameOver: vi.fn(),
  playClick: vi.fn(),
}));

vi.mock('../lib/sounds', () => sounds);

import { MultiplayerPage } from '../features/multiplayer/MultiplayerPage';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const MOCK_MATCH = {
  id: 'match-1',
  challengeId: 'ch-1',
  player1Id: 'user-1',
  player2Id: 'user-2',
  gameModeSlug: 'flag-guess',
  durationMinutes: 3,
  player1Score: 0,
  player2Score: 0,
  player1Finished: false,
  player2Finished: false,
  player1StartedAt: null,
  player2StartedAt: null,
  winnerId: null,
  status: 'pending' as const,
  createdAt: new Date().toISOString(),
  player1: { id: 'user-1', username: 'current_user', displayName: null, avatarUrl: null },
  player2: { id: 'user-2', username: 'opponent', displayName: 'Opponent', avatarUrl: null },
};

const MOCK_QUESTION = {
  id: 'q-1',
  questionText: 'What is the capital of France?',
  options: ['Paris', 'London', 'Berlin', 'Madrid'],
  correctIndex: 0,
  flagUrl: undefined,
};

const MOCK_ANSWER_OK = {
  correct: true,
  scoreEarned: 100,
  streak: 1,
  nextQuestion: {
    id: 'q-2',
    questionText: 'Second question?',
    options: ['A1', 'B2', 'C3', 'D4'],
    correctIndex: 2,
  },
  finished: false,
  matchEnded: false,
};

// ─── Helper ────────────────────────────────────────────────────────────────

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      {
        path: '/multiplayer/:matchId',
        element: <MultiplayerPage />,
      },
    ],
    { initialEntries: ['/multiplayer/match-1'] },
  );

  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  );
}

describe('MultiplayerPage (async)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  // ── Start screen ────────────────────────────────────────────────────────
  describe('start screen', () => {
    it('should show start screen when match is pending and user has not started', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);

      renderWithRouter();

      expect(await screen.findByText(/start playing/i)).toBeDefined();
      expect(screen.getByText(/opponent/i)).toBeDefined();
    });

    it('should show challenge from opponent name', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);

      renderWithRouter();

      expect(await screen.findByText(/opponent/i)).toBeDefined();
    });
  });

  // ── Playing screen ──────────────────────────────────────────────────────
  describe('playing screen', () => {
    it('should transition to playing when start is clicked', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 180_000 });

      renderWithRouter();

      // Wait for start screen
      const startBtn = await screen.findByText(/start playing/i);
      fireEvent.click(startBtn);

      // Should show question
      expect(await screen.findByText('What is the capital of France?')).toBeDefined();
      expect(screen.getByText('Paris')).toBeDefined();
      expect(screen.getByText('London')).toBeDefined();
      expect(screen.getByText('Berlin')).toBeDefined();
      expect(screen.getByText('Madrid')).toBeDefined();
    });

    it('should show score of 0 at start', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 180_000 });

      renderWithRouter();

      const startBtn = await screen.findByText(/start playing/i);
      fireEvent.click(startBtn);

      expect(await screen.findByText('0')).toBeDefined();
    });

    it('should show correct feedback on right answer', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 180_000 });
      mockPost.mockResolvedValueOnce(MOCK_ANSWER_OK);

      renderWithRouter();

      const startBtn = await screen.findByText(/start playing/i);
      fireEvent.click(startBtn);

      // Wait for question, then click correct answer (Paris = index 0)
      const parisBtn = await screen.findByText('Paris');
      fireEvent.click(parisBtn);

      expect(await screen.findByText(/correct!/i)).toBeDefined();
      // Audio feedback plays for correct answers (same as single-player)
      expect(sounds.playCorrect).toHaveBeenCalled();
      expect(sounds.playWrong).not.toHaveBeenCalled();
    });

    it('should resume from in-progress match on mount', async () => {
      const startedMatch = {
        ...MOCK_MATCH,
        player1StartedAt: new Date().toISOString(),
        status: 'in_progress' as const,
      };
      mockGet.mockResolvedValueOnce(startedMatch);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 150_000 });

      renderWithRouter();

      expect(await screen.findByText('What is the capital of France?')).toBeDefined();
    });
  });

  // ── Time expiry ──────────────────────────────────────────────────────────
  describe('time expiry', () => {
    it('should finish the match and show waiting screen when time runs out', async () => {
      // /play returns remainingMs: 0 → the timer expires immediately
      mockGet.mockResolvedValueOnce(MOCK_MATCH);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 0 });
      mockPost.mockResolvedValueOnce({ finished: true, matchEnded: false });

      renderWithRouter();

      const startBtn = await screen.findByText(/start playing/i);
      fireEvent.click(startBtn);

      // Should land on the waiting screen, NOT keep asking questions
      expect(await screen.findByText(/you finished!/i, {}, { timeout: 3000 })).toBeDefined();

      // Must call /finish; must never submit an answer for the timeout
      const finishCall = mockPost.mock.calls.find(([url]) => url === '/matches/match-1/finish');
      expect(finishCall).toBeDefined();
      const answerCall = mockPost.mock.calls.find(([url]) => url === '/matches/match-1/answer');
      expect(answerCall).toBeUndefined();
    });
  });

  // ── Finished waiting screen ─────────────────────────────────────────────
  describe('finished waiting screen', () => {
    it('should show waiting for opponent when user finished but match not ended', async () => {
      mockGet.mockResolvedValueOnce(MOCK_MATCH);
      mockPost.mockResolvedValueOnce({ question: MOCK_QUESTION, remainingMs: 180_000 });

      const finalAnswer = {
        correct: true,
        scoreEarned: 100,
        streak: 1,
        nextQuestion: null,
        finished: true,
        matchEnded: false,
      };
      mockPost.mockResolvedValueOnce(finalAnswer);

      renderWithRouter();

      const startBtn = await screen.findByText(/start playing/i);
      fireEvent.click(startBtn);

      const parisBtn = await screen.findByText('Paris');
      fireEvent.click(parisBtn);

      expect(await screen.findByText(/you finished!/i, {}, { timeout: 3000 })).toBeDefined();
    });
  });

  // ── Result screen ───────────────────────────────────────────────────────
  describe('result screen', () => {
    it('should show winner when match is complete and current user won', async () => {
      const completedMatch = {
        ...MOCK_MATCH,
        player1Score: 800,
        player2Score: 600,
        player1Finished: true,
        player2Finished: true,
        player1StartedAt: new Date().toISOString(),
        player2StartedAt: new Date().toISOString(),
        winnerId: 'user-1', // current user wins
        status: 'completed' as const,
      };
      mockGet.mockResolvedValueOnce(completedMatch);

      renderWithRouter();

      expect(await screen.findByText(/won/i)).toBeDefined();
      // Scores should appear
      expect(screen.getByText('800')).toBeDefined();
      expect(screen.getByText('600')).toBeDefined();
      // Win fanfare plays on the result screen
      expect(sounds.playGameWin).toHaveBeenCalled();
    });

    it('should show loser when opponent won', async () => {
      const completedMatch = {
        ...MOCK_MATCH,
        player1Score: 400,
        player2Score: 700,
        player1Finished: true,
        player2Finished: true,
        player1StartedAt: new Date().toISOString(),
        player2StartedAt: new Date().toISOString(),
        winnerId: 'user-2',
        status: 'completed' as const,
      };
      mockGet.mockResolvedValueOnce(completedMatch);

      renderWithRouter();

      expect(await screen.findByText(/lost/i)).toBeDefined();
    });

    it('should show tie when winnerId is null', async () => {
      const tieMatch = {
        ...MOCK_MATCH,
        player1Score: 500,
        player2Score: 500,
        player1Finished: true,
        player2Finished: true,
        player1StartedAt: new Date().toISOString(),
        player2StartedAt: new Date().toISOString(),
        winnerId: null,
        status: 'completed' as const,
      };
      mockGet.mockResolvedValueOnce(tieMatch);

      renderWithRouter();

      expect(await screen.findByText(/tie/i)).toBeDefined();
    });

    // ── Rematch ──────────────────────────────────────────────────────────
    describe('rematch', () => {
      const makeCompletedMatch = (winnerId: string | null, myScore = 800, oppScore = 600) => ({
        ...MOCK_MATCH,
        player1Score: myScore,
        player2Score: oppScore,
        player1Finished: true,
        player2Finished: true,
        player1StartedAt: new Date().toISOString(),
        player2StartedAt: new Date().toISOString(),
        winnerId,
        status: 'completed' as const,
      });
      const winMatch = makeCompletedMatch('user-1');

      const resultFixtures: Array<[string, ReturnType<typeof makeCompletedMatch>]> = [
        ['win', makeCompletedMatch('user-1', 800, 600)],
        ['lose', makeCompletedMatch('user-2', 400, 700)],
        ['tie', makeCompletedMatch(null, 500, 500)],
      ];

      it.each(resultFixtures)(
        'renders the Rematch button before Back to Home on a %s result',
        async (_outcome: string, match: ReturnType<typeof makeCompletedMatch>) => {
          mockGet.mockResolvedValueOnce(match);

          renderWithRouter();

          const rematchBtn = await screen.findByRole('button', { name: /rematch/i });
          expect(rematchBtn).toBeEnabled();

          const buttons = screen.getAllByRole('button');
          const labels = buttons.map((b) => b.textContent?.trim());
          expect(labels.indexOf('Rematch')).toBeGreaterThan(-1);
          expect(labels.indexOf('Back to Home')).toBeGreaterThan(labels.indexOf('Rematch'));
        },
      );

      it('does not render the Rematch button before a match completes', async () => {
        mockGet.mockResolvedValueOnce(MOCK_MATCH); // pending match → start screen

        renderWithRouter();

        expect(await screen.findByText(/start playing/i)).toBeDefined();
        expect(screen.queryByRole('button', { name: /rematch/i })).toBeNull();
      });

      it('reconnects the socket and posts the challenge payload when tapped', async () => {
        mockGet.mockResolvedValueOnce(winMatch);
        mockPost.mockResolvedValueOnce({ challengeId: 'ch-2' });

        renderWithRouter();

        const rematchBtn = await screen.findByRole('button', { name: /rematch/i });
        fireEvent.click(rematchBtn);

        expect(await screen.findByText(/waiting for response/i)).toBeDefined();
        expect(mockConnectSocket).toHaveBeenCalledWith('test-token');
        expect(mockPost).toHaveBeenCalledWith('/matches/challenge', {
          receiverId: 'user-2',
          gameModeSlug: 'flag-guess',
          durationMinutes: 3,
        });
      });

      it('disables the button while sending and sends exactly one challenge on double tap', async () => {
        mockGet.mockResolvedValueOnce(winMatch);
        mockPost.mockReturnValueOnce(new Promise(() => {})); // never settles

        renderWithRouter();

        const rematchBtn = await screen.findByRole('button', { name: /rematch/i });
        fireEvent.click(rematchBtn);
        fireEvent.click(rematchBtn);

        const waitingBtn = await screen.findByRole('button', { name: /waiting for response/i });
        expect(waitingBtn).toBeDisabled();
        const challengeCalls = mockPost.mock.calls.filter(([url]) => url === '/matches/challenge');
        expect(challengeCalls).toHaveLength(1);
      });

      it('maps NOT_FRIENDS to challengeNotFriends and re-enables the button for retry', async () => {
        mockGet.mockResolvedValueOnce(winMatch);
        mockPost.mockRejectedValueOnce(new ApiError('Not friends', 403, 'NOT_FRIENDS'));

        renderWithRouter();

        const rematchBtn = await screen.findByRole('button', { name: /rematch/i });
        fireEvent.click(rematchBtn);

        expect(await screen.findByRole('alert')).toHaveTextContent('You can only challenge friends.');
        expect(screen.getByRole('button', { name: /rematch/i })).toBeEnabled();
      });

      it('maps generic errors to challengeError and re-enables the button for retry', async () => {
        mockGet.mockResolvedValueOnce(winMatch);
        mockPost.mockRejectedValueOnce(new Error('network down'));

        renderWithRouter();

        const rematchBtn = await screen.findByRole('button', { name: /rematch/i });
        fireEvent.click(rematchBtn);

        expect(await screen.findByRole('alert')).toHaveTextContent(
          'Could not send the challenge. Try again.',
        );
        expect(screen.getByRole('button', { name: /rematch/i })).toBeEnabled();
      });
    });
  });

  // ── Error screen ────────────────────────────────────────────────────────
  describe('error screen', () => {
    it('should show error when match is not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'));

      renderWithRouter();

      expect(await screen.findByText(/match not found/i)).toBeDefined();
      expect(screen.getByText(/back to home/i)).toBeDefined();
    });
  });
});
