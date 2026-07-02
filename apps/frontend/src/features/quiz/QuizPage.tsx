import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useGameStore } from '../../store/gameStore';
import { useTimer } from '../../hooks/useTimer';
import logo from '../../assets/logo.png';
import type {
  QuizQuestion,
  QuizAnswerResponse,
  QuizSessionResult,
} from '@geotano/shared';

interface SessionResponse {
  sessionId: string;
  question: QuizQuestion;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnBase =
  'w-full min-h-[44px] rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all duration-200 outline-none';

function getOptionBtnStyle(
  index: number,
  selected: number | null,
  correctIndex: number | null,
  answerState: 'idle' | 'correct' | 'wrong',
): string {
  const isSelected = selected === index;
  const isCorrect = correctIndex === index;
  const isIdle = answerState === 'idle';

  if (isIdle) {
    const colors = [
      'border-sky-200 dark:border-sky-800 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30',
      'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
      'border-amber-200 dark:border-amber-800 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
      'border-rose-200 dark:border-rose-800 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30',
    ];
    return `${btnBase} ${colors[index]} bg-[var(--color-card)] text-[var(--color-card-foreground)] cursor-pointer`;
  }

  if (answerState === 'correct') {
    if (isCorrect || isSelected) {
      return `${btnBase} border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 cursor-default`;
    }
    return `${btnBase} border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] opacity-50 cursor-default`;
  }

  // answerState === 'wrong'
  if (isSelected && !isCorrect) {
    return `${btnBase} border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 cursor-default`;
  }
  if (isCorrect) {
    return `${btnBase} border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 cursor-default`;
  }
  return `${btnBase} border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] opacity-50 cursor-default`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function QuizPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') ?? 'flag-guess';

  const {
    sessionId,
    currentQuestion,
    score,
    lives,
    streak,
    isPlaying,
    startSession,
    setQuestion,
    updateScore,
    loseLife,
    incrementStreak,
    resetStreak,
    endGame,
    reset,
  } = useGameStore();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [feedbackText, setFeedbackText] = useState('');
  const [gameResult, setGameResult] = useState<QuizSessionResult | null>(null);

  // ── Start session mutation ────────────────────────────────────────────────
  const sessionMutation = useMutation({
    mutationFn: () =>
      api.get<SessionResponse>(`/quiz/session?mode=${mode}`),
    onSuccess: (data) => {
      startSession(data.sessionId);
      setQuestion(data.question);
    },
  });

  // ── Answer mutation ───────────────────────────────────────────────────────
  // The mutation is used for backend scoring/validation.
  // The frontend shows feedback IMMEDIATELY using correctIndex from the question.
  const answerMutation = useMutation({
    mutationFn: (params: { answer: string; timeMs: number }) =>
      api.post<QuizAnswerResponse>('/quiz/answer', {
        sessionId,
        questionId: currentQuestion?.id,
        answer: params.answer,
        timeMs: params.timeMs,
      }),
    onSuccess: (data) => {
      // Update score/lives from backend (authoritative)
      if (data.correct) {
        incrementStreak();
        updateScore(data.score);
      } else {
        resetStreak();
        loseLife();
      }

      if (data.result) {
        setGameResult(data.result);
        endGame();
      } else if (data.nextQuestion) {
        // Delay before showing next question
        setTimeout(() => {
          setQuestion(data.nextQuestion!);
          setSelectedIndex(null);
          setCorrectIndex(null);
          setAnswerState('idle');
          setFeedbackText('');
          timerReset();
          timerStart();
        }, 1500);
      }
    },
  });

  // ── Timer ─────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (answerState !== 'idle') return; // Already answered
    // Auto-submit wrong answer on timeout
    answerMutation.mutate({ answer: '', timeMs: currentQuestion?.timeLimitMs ?? 15000 });
  }, [answerState, answerMutation, currentQuestion]);

  const {
    fraction,
    remainingMs,
    expired,
    start: timerStart,
    pause: timerPause,
    reset: timerReset,
  } = useTimer({
    durationMs: currentQuestion?.timeLimitMs ?? 15000,
    onExpire: handleTimerExpire,
    stopOnExpire: true,
  });

  // ── Start game on mount / mode change ─────────────────────────────────────
  useEffect(() => {
    reset();
    sessionMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Start timer when question changes ─────────────────────────────────────
  useEffect(() => {
    if (currentQuestion && isPlaying && answerState === 'idle') {
      timerReset();
      timerStart();
    }
  }, [currentQuestion, isPlaying, answerState, timerReset, timerStart]);

  const handleAnswer = (index: number) => {
    if (answerState !== 'idle' || !currentQuestion) return;
    timerPause(); // Stop the timer bar — answer was selected
    setSelectedIndex(index);
    setCorrectIndex(currentQuestion.correctIndex);

    // Show feedback IMMEDIATELY — no backend round-trip
    const isCorrect = index === currentQuestion.correctIndex;
    if (isCorrect) {
      setAnswerState('correct');
      setFeedbackText(t('quiz.correct'));
    } else {
      setAnswerState('wrong');
      setFeedbackText(`${t('quiz.wrong')} — ${currentQuestion.options[currentQuestion.correctIndex]}`);
    }

    // Send answer to backend in background for scoring/validation
    const answerText = currentQuestion.options[index];
    const timeMs = currentQuestion.timeLimitMs - remainingMs;
    answerMutation.mutate({ answer: answerText, timeMs });
  };

  const handlePlayAgain = () => {
    setGameResult(null);
    setSelectedIndex(null);
    setCorrectIndex(null);
    setAnswerState('idle');
    setFeedbackText('');
    reset();
    sessionMutation.mutate();
  };

  const handleGoHome = () => {
    reset();
    navigate('/');
  };

  // ── Navigation blocker — prevents accidental leave during active game ────
  const blocker = useBlocker(isPlaying && gameResult === null);

  // Warn before closing tab
  useEffect(() => {
    if (!isPlaying || gameResult) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isPlaying, gameResult]);

  // ── Leave confirmation modal ──────────────────────────────────────────────
  function LeaveModal() {
    if (blocker.state !== 'blocked') return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lg">
          <h3 className="mb-2 text-lg font-semibold text-[var(--color-foreground)]">
            Leave game?
          </h3>
          <p className="mb-1 text-sm text-[var(--color-muted-foreground)]">
            You are in the middle of a game. If you leave now, your progress will be lost!
          </p>
          <div className="mb-4 flex items-center gap-4 rounded-lg bg-[var(--color-muted)] px-4 py-3 text-sm">
            <span className="font-medium text-[var(--color-foreground)]">
              Score: {score}
            </span>
            {streak >= 5 && (
              <span className="text-amber-600 dark:text-amber-400">
                🔥 {streak} streak
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => blocker.reset()}
              className="flex-1 min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
            >
              Stay — keep playing
            </button>
            <button
              onClick={() => blocker.proceed()}
              className="flex-1 min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
            >
              Leave anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Timer bar color ───────────────────────────────────────────────────────
  const timerColor =
    fraction > 0.5
      ? 'bg-emerald-500'
      : fraction > 0.25
        ? 'bg-amber-500'
        : 'bg-red-500';

  // ── Loading state ─────────────────────────────────────────────────────────
  // Show spinner while mutation is pending OR until we have a question.
  // This prevents a flash of empty content between mount and mutation start.
  if (sessionMutation.isPending || !currentQuestion) {
    return (
      <>
        <div className="flex items-center justify-center py-32">
          <img src={logo} alt="Geotano" className="h-72 w-72 animate-logo-spin" />
        </div>
        <LeaveModal />
      </>
    );
  }

  if (sessionMutation.isError) {
    return (
      <>
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-[var(--color-destructive)]">{t('common.error')}</p>
          <button
            onClick={() => sessionMutation.mutate()}
            className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
          >
            {t('common.retry')}
          </button>
        </div>
        <LeaveModal />
      </>
    );
  }

  // ── Game over screen ──────────────────────────────────────────────────────
  if (gameResult) {
    return (
      <>
        <div className="mx-auto max-w-md py-12">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
            <h2 className="text-3xl font-bold text-[var(--color-foreground)]">
              {t('quiz.gameOver')}
            </h2>

            <div className="my-8 space-y-3">
              <p className="text-5xl font-bold text-[var(--color-primary)]">
                {gameResult.totalScore}
              </p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t('quiz.result', { score: gameResult.totalScore })}
              </p>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="flex min-h-[64px] flex-col items-center justify-center rounded-lg bg-[var(--color-muted)] p-3">
                  <p className="text-lg font-bold text-[var(--color-foreground)]">
                    {gameResult.correctCount}/{gameResult.totalQuestions}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{t('quiz.correct')}</p>
                </div>
                <div className="flex min-h-[64px] flex-col items-center justify-center rounded-lg bg-[var(--color-muted)] p-3">
                  <p className="text-lg font-bold text-[var(--color-foreground)]">
                    {gameResult.streakMax}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{t('quiz.streak')}</p>
                </div>
                <div className="flex min-h-[64px] flex-col items-center justify-center rounded-lg bg-[var(--color-muted)] p-3">
                  <p className="text-lg font-bold text-[var(--color-foreground)]">
                    {gameResult.totalQuestions}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{t('quiz.question', { number: '' }).replace(/ \d*$/, '')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handlePlayAgain}
                className="w-full min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
              >
                {t('quiz.playAgain')}
              </button>
              <button
                onClick={handleGoHome}
                className="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
              >
                {t('quiz.backToHome')}
              </button>
            </div>
          </div>
        </div>
        <LeaveModal />
      </>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  return (
    <>
    <div className="mx-auto max-w-2xl py-4">
      {/* Top bar: score, lives, streak */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Lives */}
          <div className="flex gap-0.5">
            {Array.from({ length: 3 }, (_, i) => (
              <span
                key={i}
                className={`text-lg transition-opacity ${
                  i < lives ? 'opacity-100' : 'opacity-20'
                }`}
              >
                ♥
              </span>
            ))}
          </div>

          {/* Streak — show fire icon after 5 consecutive correct answers */}
          {streak >= 5 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              🔥 {t('quiz.streak')} {streak}
            </span>
          )}
        </div>

        {/* Score */}
        <span className="text-lg font-bold text-[var(--color-foreground)]">
          {t('quiz.score')}: {score}
        </span>
      </div>

      {/* Timer bar */}
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={`h-full rounded-full transition-all duration-100 ${timerColor}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      {/* Question number */}
      <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
        {t('quiz.question', { number: currentQuestion.questionNumber })}
      </p>

      {/* Question text */}
      <h2 className="mb-6 text-xl font-semibold text-[var(--color-foreground)] sm:text-2xl">
        {currentQuestion.questionText}
      </h2>

      {/* Flag image */}
      {currentQuestion.flagUrl && (
        <div className="mb-6 flex justify-center">
          <img
            src={currentQuestion.flagUrl}
            alt="Flag"
            className="h-32 rounded-lg border border-[var(--color-border)] object-cover shadow-sm sm:h-40"
          />
        </div>
      )}

      {/* Answer options */}
      <div className="grid gap-3 sm:grid-cols-2">
        {currentQuestion.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswer(index)}
            disabled={answerState !== 'idle'}
            className={getOptionBtnStyle(index, selectedIndex, correctIndex, answerState)}
          >
            <span className="mr-2 inline-block w-6 h-6 rounded-full bg-[var(--color-muted)] text-center text-xs leading-6 font-bold text-[var(--color-muted-foreground)]">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedbackText && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm font-medium ${
            answerState === 'correct'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {feedbackText}
        </div>
      )}


    </div>
    <LeaveModal />
    </>
  );
}
