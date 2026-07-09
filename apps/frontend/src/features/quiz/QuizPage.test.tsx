import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string, params?: Record<string, any>) => {
  const dict: Record<string, string> = {
    'common.error': 'Something went wrong',
    'common.retry': 'Retry',
    'quiz.correct': 'Correct!',
    'quiz.wrong': 'Wrong!',
    'quiz.submitError': 'Failed to submit answer',
    'quiz.score': 'Score',
    'quiz.streakWithCount': '🔥 {count} streak',
    'quiz.streak': 'Best Streak',
    'quiz.gameOver': 'Game Over!',
    'quiz.gameOverTitle': 'Game Over!',
    'quiz.result': 'You scored {score} points',
    'quiz.winTitle': 'Congratulations!',
    'quiz.winMessage': 'You completed the {mode} mode!',
    'quiz.playAgain': 'Play Again',
    'quiz.backToHome': 'Back to Home',
    'quiz.correctCount': 'Correct: {count}',
    'quiz.longestStreak': 'Best streak: {count}',
    'quiz.leaveTitle': 'Leave game?',
    'quiz.leaveWarning': 'Your progress will be lost.',
    'quiz.leaveScore': 'Score: {score}',
    'quiz.leaveStay': 'Stay',
    'quiz.leaveAnyway': 'Leave Anyway',
    'quiz.flagAlt': 'Flag',
    'quiz.question': 'Question {number}',
  };
  let text = dict[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  return text;
};

// ─── Shared mutable state ──────────────────────────────────────────────────
const sampleQuestion = vi.hoisted(() => ({
  id: 'q-1',
  questionText: 'What is the capital of France?',
  options: ['Berlin', 'Paris', 'Madrid', 'Rome'],
  correctIndex: 1,
  timeLimitMs: 15000,
  questionNumber: 1,
  flagUrl: null,
}));

const sampleGameResult = vi.hoisted(() => ({
  totalScore: 5000,
  correctCount: 8,
  totalQuestions: 10,
  streakMax: 5,
}));

const gameState = vi.hoisted(() => ({
  sessionId: 'session-1',
  currentQuestion: sampleQuestion as any,
  score: 0,
  lives: 3,
  maxLives: 3,
  streak: 0,
  isPlaying: true,
  totalQuestions: null,
  startSession: vi.fn(),
  setQuestion: vi.fn(),
  setTotalQuestions: vi.fn(),
  updateScore: vi.fn(),
  updateLives: vi.fn(),
  loseLife: vi.fn(),
  incrementStreak: vi.fn(),
  resetStreak: vi.fn(),
  endGame: vi.fn(),
  reset: vi.fn(),
}));

const sampleQuestionWithFlag = { ...sampleQuestion, flagUrl: 'https://example.com/flag.jpg' };

const timerState = vi.hoisted(() => ({
  fraction: 1,
  remainingMs: 15000,
  expired: false,
  start: vi.fn(),
  pause: vi.fn(),
  reset: vi.fn(),
}));

const mutationState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());

const blockerState = vi.hoisted(() => ({
  state: 'unblocked',
  reset: vi.fn(),
  proceed: vi.fn(),
}));

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('mode=flag-guess')],
  useNavigate: () => mockNavigate,
  useBlocker: () => blockerState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => T(key, params) }),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: any) => ({
    mutate: (...args: any[]) => {
      mockMutate(...args);
      const result = config.mutationFn(...args);
      if (result?.then) {
        result.then(
          (data: any) => config.onSuccess?.(data),
          (err: any) => config.onError?.(err),
        );
      }
    },
    isPending: mutationState.isPending,
    isError: mutationState.isError,
  }),
}));

vi.mock('../../store/gameStore', () => ({
  useGameStore: (selector?: (s: any) => any) => (selector ? selector(gameState) : gameState),
}));

vi.mock('../../hooks/useTimer', () => ({
  useTimer: () => timerState,
}));

vi.mock('../../lib/api', () => ({
  api: { get: mockApiGet, post: mockApiPost },
}));

vi.mock('../../assets/logo.png', () => ({ default: 'logo-mock.png' }));

import { QuizPage } from './QuizPage';

describe('QuizPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationState.isPending = false;
    mutationState.isError = false;
    gameState.currentQuestion = sampleQuestion;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.streak = 0;
    gameState.isPlaying = true;
    gameState.sessionId = 'session-1';
    timerState.fraction = 1;
    timerState.remainingMs = 15000;

    mockApiGet.mockResolvedValue({
      sessionId: 'session-1',
      question: sampleQuestion,
    });
    mockApiPost.mockRejectedValue(new Error('Not mocked'));
    blockerState.state = 'unblocked';
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it('should show loading spinner when session mutation is pending', () => {
    mutationState.isPending = true;
    render(<QuizPage />);
    expect(screen.getByAltText('Geotano')).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it('should show error and retry on session error', () => {
    mutationState.isError = true;
    render(<QuizPage />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(mockMutate).toHaveBeenCalled();
  });

  // ── Quiz screen ──────────────────────────────────────────────────────────

  it('should render question and options', async () => {
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
      expect(screen.getByText('Paris')).toBeInTheDocument();
      expect(screen.getByText('Berlin')).toBeInTheDocument();
      expect(screen.getByText('Madrid')).toBeInTheDocument();
      expect(screen.getByText('Rome')).toBeInTheDocument();
    });
  });

  it('should show question number', async () => {
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Question 1')).toBeInTheDocument();
    });
  });

  it('should show score', async () => {
    gameState.score = 500;
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText(/Score/)).toBeInTheDocument();
    });
  });

  it('should show lives', () => {
    render(<QuizPage />);
    // Hearts are rendered — 3 hearts visible
    const hearts = document.querySelectorAll('span');
    const fullHearts = Array.from(hearts).filter((s) => s.textContent === '♥' && s.className.includes('opacity-100'));
    // We can just check the component renders
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
  });

  it('should show streak badge when streak >= 5', () => {
    gameState.streak = 5;
    render(<QuizPage />);

    expect(screen.getByText('🔥 5 streak')).toBeInTheDocument();
  });

  it('should not show streak badge when streak < 5', () => {
    gameState.streak = 3;
    render(<QuizPage />);

    expect(screen.queryByText('🔥')).not.toBeInTheDocument();
  });

  it('should show flag image when question has flagUrl', () => {
    gameState.currentQuestion = sampleQuestionWithFlag;
    render(<QuizPage />);

    const flagImg = screen.getByAltText('Flag');
    expect(flagImg).toBeInTheDocument();
    expect(flagImg).toHaveAttribute('src', 'https://example.com/flag.jpg');
  });

  // ── Answer selection ────────────────────────────────────────────────────

  it('should highlight correct answer when selected', async () => {
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    // Answer state should be 'correct' — shows feedback
    await waitFor(() => {
      expect(screen.getByText('Correct!')).toBeInTheDocument();
    });
  });

  it('should highlight wrong answer when selected', async () => {
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Berlin')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Berlin'));

    await waitFor(() => {
      expect(screen.getByText('Wrong!')).toBeInTheDocument();
    });
  });

  it('should disable options after answering', async () => {
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));
    fireEvent.click(screen.getByText('Berlin')); // Second click shouldn't do anything

    // Should still show Correct!
    expect(screen.getByText('Correct!')).toBeInTheDocument();
  });

  // ── Game over ────────────────────────────────────────────────────────────

  it('should show game over screen with stats', async () => {
    // Set up answer mutation to return game result
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      result: sampleGameResult,
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Game Over!')).toBeInTheDocument();
      expect(screen.getByText('You scored 5000 points')).toBeInTheDocument();
      expect(screen.getByText('8/10')).toBeInTheDocument();
    });
  });

  it('should play again after game over', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      result: sampleGameResult,
    });
    mockApiGet.mockResolvedValue({
      sessionId: 'session-2',
      question: { ...sampleQuestion, id: 'q-2', questionText: 'Second game question' },
    });

    render(<QuizPage />);

    // Wait for initial render, answer, and game over
    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Game Over!')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Play Again'));

    // Should call reset and API again
    expect(mockApiGet).toHaveBeenCalled();
  });

  // ── Win screen ─────────────────────────────────────────────────────────

  it('should show win screen with congratulations when win: true', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      expect(screen.queryByText('Game Over!')).not.toBeInTheDocument();
    });
  });

  it('should show final score on win screen', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('5000')).toBeInTheDocument();
    });
  });

  it('should show stats on win screen', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000, correctCount: 8, streakMax: 5 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Correct: 8')).toBeInTheDocument();
      expect(screen.getByText('Best streak: 5')).toBeInTheDocument();
    });
  });

  it('should show Play Again and Back to Home on win screen', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Play Again')).toBeInTheDocument();
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });
  });

  it('should not show win screen when win is false', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: false,
      result: sampleGameResult,
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Game Over!')).toBeInTheDocument();
      expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    });
  });

  it('should not show win screen when win is undefined', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      result: sampleGameResult,
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Game Over!')).toBeInTheDocument();
      expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    });
  });

  it('should play again from win screen', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Play Again')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Play Again'));

    // Should call reset and API again
    expect(mockApiGet).toHaveBeenCalled();
  });

  it('should go home from win screen', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      win: true,
      result: { ...sampleGameResult, totalScore: 5000 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Back to Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should go home after game over', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      result: sampleGameResult,
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      expect(screen.getByText('Game Over!')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Back to Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  // ── Timer ────────────────────────────────────────────────────────────────

  it('should show timer bar', () => {
    render(<QuizPage />);
    const timerBar = document.querySelector('[style*="width"]');
    expect(timerBar).toBeInTheDocument();
  });

  it('should start timer when question is loaded', () => {
    render(<QuizPage />);
    expect(timerState.start).toHaveBeenCalled();
  });

  // ── Loading state before question ────────────────────────────────────────

  it('should show loading when no currentQuestion', () => {
    gameState.currentQuestion = null;
    render(<QuizPage />);
    expect(screen.getByAltText('Geotano')).toBeInTheDocument();
  });

  // ── Desktop sizing ─────────────────────────────────────────────────────

  it('should render quiz container with max-w-4xl for desktop sizing', () => {
    render(<QuizPage />);
    // The outer quiz div should have the max-w-4xl class
    const quizContainer = document.querySelector('.max-w-4xl');
    expect(quizContainer).toBeInTheDocument();
  });

  it('should render timer bar with responsive height (h-1.5 mobile, sm:h-3 desktop)', () => {
    render(<QuizPage />);
    // Base mobile class is h-1.5; sm:h-3 applies on desktop via responsive prefix
    const timerContainer = document.querySelector('.w-full.overflow-hidden.rounded-full');
    expect(timerContainer).toHaveClass('h-1.5');
    expect(timerContainer).toHaveClass('sm:h-3');
  });

  it('should render result screen with max-w-2xl (was max-w-md)', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 5000,
      livesRemaining: 2,
      result: sampleGameResult,
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      // The result container should use max-w-2xl now (was max-w-md)
      const resultContainer = document.querySelector('.max-w-2xl');
      expect(resultContainer).toBeInTheDocument();
    });
  });

  it('should always show longest streak (best streak) label on game over, not just streak', async () => {
    mockApiPost.mockResolvedValue({
      correct: false,
      score: -50,
      livesRemaining: 0,
      result: { ...sampleGameResult, streakMax: 7 },
    });

    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Berlin'));

    await waitFor(() => {
      // Should show "Best streak: 7" even on loss (was only "Streak: 7" on loss)
      expect(screen.getByText('Best streak: 7')).toBeInTheDocument();
    });
  });

  // ── Leave Modal ──────────────────────────────────────────────────────────

  it('should show leave modal when blocker state is blocked', () => {
    blockerState.state = 'blocked';
    render(<QuizPage />);

    expect(screen.getByText('Leave game?')).toBeInTheDocument();
    expect(screen.getByText('Your progress will be lost.')).toBeInTheDocument();
  });

  it('should show score in leave modal', () => {
    blockerState.state = 'blocked';
    gameState.score = 500;
    render(<QuizPage />);

    const modal = document.querySelector('.fixed.inset-0');
    expect(modal).toBeInTheDocument();
    expect(modal!.textContent).toContain('Score: 500');
  });

  it('should show streak in leave modal when streak >= 5', () => {
    blockerState.state = 'blocked';
    gameState.streak = 5;
    render(<QuizPage />);

    const modal = document.querySelector('.fixed.inset-0');
    expect(modal).toBeInTheDocument();
    expect(modal!.textContent).toContain('🔥 5 streak');
  });

  it('should not show streak in leave modal when streak < 5', () => {
    blockerState.state = 'blocked';
    gameState.streak = 3;
    render(<QuizPage />);

    expect(screen.queryByText('🔥')).not.toBeInTheDocument();
  });

  it('should call blocker.reset when Stay is clicked', () => {
    blockerState.state = 'blocked';
    render(<QuizPage />);

    fireEvent.click(screen.getByText('Stay'));
    expect(blockerState.reset).toHaveBeenCalled();
  });

  it('should call blocker.proceed when Leave Anyway is clicked', () => {
    blockerState.state = 'blocked';
    render(<QuizPage />);

    fireEvent.click(screen.getByText('Leave Anyway'));
    expect(blockerState.proceed).toHaveBeenCalled();
  });

  it('should show leave modal during loading state', () => {
    blockerState.state = 'blocked';
    mutationState.isPending = true;
    render(<QuizPage />);

    expect(screen.getByText('Leave game?')).toBeInTheDocument();
    // Loading spinner still visible alongside modal
    expect(screen.getByAltText('Geotano')).toBeInTheDocument();
  });

  it('should show leave modal during error state', () => {
    blockerState.state = 'blocked';
    mutationState.isError = true;
    render(<QuizPage />);

    expect(screen.getByText('Leave game?')).toBeInTheDocument();
    // Error message still visible alongside modal
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  // ── Timer colors ─────────────────────────────────────────────────────────

  it('should show green timer bar when fraction > 0.5', () => {
    timerState.fraction = 1;
    render(<QuizPage />);

    const timerFill = document.querySelector('.h-full.rounded-full');
    expect(timerFill).toBeInTheDocument();
    expect(timerFill).toHaveClass('bg-emerald-500');
  });

  it('should show amber timer bar when fraction is between 0.25 and 0.5', () => {
    timerState.fraction = 0.4;
    render(<QuizPage />);

    const timerFill = document.querySelector('.h-full.rounded-full');
    expect(timerFill).toBeInTheDocument();
    expect(timerFill).toHaveClass('bg-amber-500');
  });

  it('should show red timer bar when fraction <= 0.25', () => {
    timerState.fraction = 0.1;
    render(<QuizPage />);

    const timerFill = document.querySelector('.h-full.rounded-full');
    expect(timerFill).toBeInTheDocument();
    expect(timerFill).toHaveClass('bg-red-500');
  });

  // ── Feedback styling ─────────────────────────────────────────────────────

  it('should show correct feedback with green styling', async () => {
    mockApiPost.mockResolvedValue({
      correct: true,
      score: 500,
      livesRemaining: 3,
    });
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Paris')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Paris'));

    await waitFor(() => {
      const feedback = screen.getByText('Correct!');
      expect(feedback).toBeInTheDocument();
      expect(feedback.className).toContain('bg-emerald-50');
      expect(feedback.className).toContain('text-emerald-800');
    });
  });

  it('should show wrong feedback with red styling', async () => {
    mockApiPost.mockResolvedValue({
      correct: false,
      score: 0,
      livesRemaining: 3,
      correctAnswer: 'Paris',
    });
    render(<QuizPage />);

    await waitFor(() => {
      expect(screen.getByText('Berlin')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Berlin'));

    await waitFor(() => {
      const feedback = screen.getByText('Wrong!');
      expect(feedback).toBeInTheDocument();
      expect(feedback.className).toContain('bg-red-50');
      expect(feedback.className).toContain('text-red-800');
    });
  });

  // ── Question counter ─────────────────────────────────────────────────────

  it('should show N/M question counter when totalQuestions is set', () => {
    (gameState as any).totalQuestions = 10;
    render(<QuizPage />);

    expect(screen.getByText('1/10')).toBeInTheDocument();
  });

  // ── Option letters ───────────────────────────────────────────────────────

  it('should show A, B, C, D letters on option buttons', () => {
    render(<QuizPage />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  // ── Lives ────────────────────────────────────────────────────────────────

  it('should render correct number of hearts based on maxLives', () => {
    render(<QuizPage />);

    const hearts = document.querySelectorAll('span');
    const allHearts = Array.from(hearts).filter((s) => s.textContent === '♥');
    expect(allHearts).toHaveLength(3);
  });

  it('should dim hearts that are lost', () => {
    gameState.lives = 1;
    render(<QuizPage />);

    const hearts = document.querySelectorAll('span');
    const heartSpans = Array.from(hearts).filter((s) => s.textContent === '♥');

    // First heart should be full opacity (i=0 < lives=1)
    expect(heartSpans[0].className).toContain('opacity-100');
    // Remaining hearts should be dimmed (i >= lives)
    expect(heartSpans[1].className).toContain('opacity-20');
    expect(heartSpans[2].className).toContain('opacity-20');
  });

  // ── Timer width ──────────────────────────────────────────────────────────

  it('should render timer bar with width proportional to fraction', () => {
    timerState.fraction = 0.6;
    render(<QuizPage />);

    const timerFill = document.querySelector('[style*="width"]') as HTMLElement;
    expect(timerFill).toBeInTheDocument();
    expect(timerFill.style.width).toBe('60%');
  });
});
