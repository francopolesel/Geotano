import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { useMultiplayerSocket } from './useMultiplayerSocket';
import { useAuthStore } from '../../store/authStore';
import { submitMatchAnswer } from '../../lib/socket';

// ─── Styles ─────────────────────────────────────────────────────────────────

const btnBase =
  'w-full min-h-[48px] rounded-xl border-2 px-3 py-2.5 text-left text-base font-medium transition-all duration-200 outline-none sm:min-h-[52px] sm:px-4 sm:py-4 sm:text-base';

function getOptionBtnStyle(
  optionIndex: number,
  selected: number | null,
  correctIndex: number | null,
  answerState: 'idle' | 'correct' | 'wrong',
): string {
  const isSelected = selected === optionIndex;
  const isCorrect = correctIndex === optionIndex;
  const isIdle = answerState === 'idle';

  if (isIdle) {
    const colors = [
      'border-sky-200 dark:border-sky-800 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30',
      'border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
      'border-amber-200 dark:border-amber-800 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
      'border-rose-200 dark:border-rose-800 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30',
    ];
    return `${btnBase} ${colors[optionIndex]} bg-[var(--color-card)] text-[var(--color-card-foreground)] cursor-pointer`;
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

export function MultiplayerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { matchId } = useParams<{ matchId: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const {
    screen,
    opponent,
    question,
    score,
    streak,
    opponentAnswered,
    remainingMs,
    result,
    reset,
  } = useMultiplayerStore();

  useMultiplayerSocket(matchId ?? '');

  // Local answer state (per question)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [feedbackText, setFeedbackText] = useState('');
  const prevQuestionId = useRef<string | null>(null);

  // Reset local state when question changes
  useEffect(() => {
    if (question && question.id !== prevQuestionId.current) {
      prevQuestionId.current = question.id;
      setSelectedIndex(null);
      setAnswerState('idle');
      setFeedbackText('');
    }
  }, [question]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      if (answerState !== 'idle' || !question || !matchId) return;

      const isCorrect = optionIndex === question.correctIndex;
      setSelectedIndex(optionIndex);
      setAnswerState(isCorrect ? 'correct' : 'wrong');
      setFeedbackText(t(isCorrect ? 'multiplayer.correct' : 'multiplayer.wrong'));

      // Emit answer via socket
      submitMatchAnswer(matchId, optionIndex);
    },
    [answerState, question, matchId, t],
  );

  const handleGoHome = () => {
    reset();
    navigate('/');
  };

  // ── Ended screen ──────────────────────────────────────────────────────────
  if (screen === 'ended' && result) {
    const isWinner = currentUserId === result.winnerId;
    const isTie = result.winnerId === null;

    // When currentUserId is unknown (e.g. guest), default to showing first player as "you"
    const you = result.players.find((p) => p.userId === currentUserId) ?? result.players[0];
    const them = result.players.find((p) => p.userId !== currentUserId) ?? result.players[1];

    const reasonLabel =
      result.reason === 'timer_expired'
        ? t('multiplayer.result.reason.timer')
        : result.reason === 'both_finished'
          ? t('multiplayer.result.reason.finished')
          : t('multiplayer.result.reason.disconnected');

    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          {isTie ? (
            <h2 className="text-4xl font-bold text-[var(--color-foreground)]">
              {t('multiplayer.result.tie')}
            </h2>
          ) : isWinner ? (
            <h2 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
              {t('multiplayer.result.youWon')}
            </h2>
          ) : (
            <h2 className="text-4xl font-bold text-[var(--color-foreground)]">
              {t('multiplayer.result.youLost')}
            </h2>
          )}

          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {reasonLabel}
          </p>

          {/* Side-by-side stats */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            {/* Player (You) */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
                {t('multiplayer.you')}
              </p>
              <p className="text-3xl font-bold text-[var(--color-primary)]">
                {you?.score ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {t('multiplayer.score', { score: you?.score ?? 0 })}
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p className="text-[var(--color-foreground)]">
                  {t('multiplayer.correctCount', { count: you?.correctCount ?? 0 })}
                </p>
                <p className="text-[var(--color-foreground)]">
                  {t('multiplayer.maxStreak', { count: you?.maxStreak ?? 0 })}
                </p>
              </div>
            </div>

            {/* Opponent */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
                {them?.displayName ?? them?.username ?? t('multiplayer.opponent')}
              </p>
              <p className="text-3xl font-bold text-[var(--color-foreground)]">
                {them?.score ?? 0}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {t('multiplayer.score', { score: them?.score ?? 0 })}
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p className="text-[var(--color-foreground)]">
                  {t('multiplayer.correctCount', { count: them?.correctCount ?? 0 })}
                </p>
                <p className="text-[var(--color-foreground)]">
                  {t('multiplayer.maxStreak', { count: them?.maxStreak ?? 0 })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleGoHome}
              className="w-full min-h-[52px] rounded-lg border border-[var(--color-border)] px-4 py-3 text-base font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            >
              {t('multiplayer.backToHome')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Lobby screen ──────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <div className="mx-auto max-w-md py-20">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          <h2 className="text-4xl">⚔️</h2>
          <p className="mt-4 text-base text-[var(--color-muted-foreground)]">
            {opponent
              ? t('multiplayer.waiting', { username: opponent.displayName ?? opponent.username })
              : t('multiplayer.waiting', { username: '' })}
          </p>
          <div className="mt-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
          <div className="mt-8">
            <button
              onClick={handleGoHome}
              className="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
            >
              {t('multiplayer.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  if (!question) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
    );
  }

  const timerFraction = Math.max(0, remainingMs / 180_000);
  const timerSeconds = Math.ceil(remainingMs / 1000);
  const timerColor =
    timerFraction > 0.5
      ? 'bg-emerald-500'
      : timerFraction > 0.25
        ? 'bg-amber-500'
        : 'bg-red-500';

  const opponentName = opponent?.displayName ?? opponent?.username ?? '';

  return (
    <div className="mx-auto max-w-4xl px-4 py-3 sm:px-0 sm:py-4">
      {/* Top bar: opponent name, streak, score */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 sm:mb-6 sm:gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Opponent name + indicator */}
          <span className="text-sm font-medium text-[var(--color-muted-foreground)] sm:text-base">
            ⚔️ {opponentName}
          </span>

          {/* Streak — show fire icon after 5 consecutive */}
          {streak >= 5 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 sm:px-2.5 sm:text-sm">
              {t('multiplayer.streak', { count: streak })}
            </span>
          )}

          {/* Opponent answered indicator */}
          {opponentAnswered && (
            <span className="animate-pulse rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              {t('multiplayer.opponentAnswered')}
            </span>
          )}
        </div>

        {/* Score */}
        <div className="text-right">
          <span className="text-lg font-bold text-[var(--color-foreground)] sm:text-2xl">
            {score}
          </span>
        </div>
      </div>

      {/* Shared timer bar */}
      <div className="mb-2.5 flex items-center gap-3 sm:mb-6">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)] sm:h-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${timerColor}`}
            style={{ width: `${timerFraction * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
          {t('multiplayer.timeLeft', { seconds: timerSeconds })}
        </span>
      </div>

      {/* Question text */}
      <h2 className="mb-3.5 text-xl font-semibold text-[var(--color-foreground)] sm:mb-6 sm:text-3xl">
        {question.questionText}
      </h2>

      {/* Flag image */}
      {question.flagUrl && (
        <div className="mb-3.5 flex justify-center sm:mb-6">
          <img
            src={question.flagUrl}
            alt=""
            className="h-28 max-h-[33vh] rounded-lg border border-[var(--color-border)] object-cover shadow-sm sm:h-52"
          />
        </div>
      )}

      {/* Answer options */}
      <div
        key={question.id}
        className="grid gap-2.5 sm:gap-3 sm:grid-cols-2"
      >
        {question.options.map((option, index) => (
          <button
            key={`${question.id}-${index}`}
            onClick={() => handleAnswer(index)}
            disabled={answerState !== 'idle'}
            className={getOptionBtnStyle(
              index,
              selectedIndex,
              answerState !== 'idle' ? question.correctIndex : null,
              answerState,
            )}
          >
            <span className="mr-1.5 inline-block h-[22px] w-[22px] rounded-full bg-[var(--color-muted)] text-center text-[11px] leading-[22px] font-bold text-[var(--color-muted-foreground)] sm:mr-2 sm:h-6 sm:w-6 sm:text-xs sm:leading-6">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedbackText && (
        <div
          className={`mt-2.5 rounded-lg px-3 py-2 text-sm font-medium sm:mt-4 sm:px-4 sm:py-3 sm:text-sm ${
            answerState === 'correct'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
        >
          {feedbackText}
        </div>
      )}
    </div>
  );
}
