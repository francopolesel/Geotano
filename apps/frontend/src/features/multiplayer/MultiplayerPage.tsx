import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api, ApiError } from '../../lib/api';
import { playCorrect, playWrong, playGameWin, playGameOver, playClick } from '../../lib/sounds';
import { connectSocket } from '../../lib/socket';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PlayQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  flagUrl?: string;
}

interface MatchState {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  gameModeSlug: string;
  durationMinutes: number;
  player1Score: number;
  player2Score: number;
  player1Finished: boolean;
  player2Finished: boolean;
  player1StartedAt: string | null;
  player2StartedAt: string | null;
  winnerId: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  player1: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
  player2: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

interface PlayResponse {
  question: PlayQuestion;
  remainingMs: number;
}

interface AnswerResponse {
  correct: boolean;
  scoreEarned: number;
  streak: number;
  nextQuestion: PlayQuestion | null;
  finished: boolean;
  matchEnded: boolean;
}

type Screen = 'loading' | 'start' | 'playing' | 'my_finished' | 'result' | 'error';

// ─── Constants ──────────────────────────────────────────────────────────────

const FEEDBACK_DURATION_MS = 400;
const POLL_INTERVAL_MS = 10_000;

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

  if (answerState === 'idle') {
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
  const token = useAuthStore((s) => s.token);

  // ── State ───────────────────────────────────────────────────────────────
  const [screen, setScreen] = useState<Screen>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [question, setQuestion] = useState<PlayQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [remainingMs, setRemainingMs] = useState(180_000);
  const totalMs = (match?.durationMinutes ?? 3) * 60 * 1000;
  const [myFinished, setMyFinished] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    iWon: boolean;
    tie: boolean;
    myScore: number;
    opponentScore: number;
    myStats: { correctCount: number; totalAnswered: number; maxStreak: number };
    opponentStats: { correctCount: number; totalAnswered: number; maxStreak: number };
  } | null>(null);

  // Rematch state (result screen)
  const [rematchState, setRematchState] = useState<'idle' | 'sending' | 'waiting' | 'error'>('idle');
  const [rematchError, setRematchError] = useState<string | null>(null);

  // Answer feedback state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const isPlayer1 = match ? match.player1Id === currentUserId : false;
  const opponent = match
    ? (isPlayer1 ? match.player2 : match.player1)
    : null;
  const opponentName = opponent?.displayName ?? opponent?.username ?? t('multiplayer.opponent');
  const isMyTurn = match && !myFinished && !matchEnded;

  // ── Fetch match on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;

    api.get<MatchState>(`/matches/${matchId}`)
      .then((data) => {
        if (cancelled) return;
        setMatch(data);

        const myId = currentUserId;
        const p1 = data.player1Id === myId;
        const started = p1 ? data.player1StartedAt : data.player2StartedAt;
        const finished = p1 ? data.player1Finished : data.player2Finished;
        const ended = data.status === 'completed';

        if (ended) {
          // Match already complete — go straight to result
          setMyFinished(true);
          setMatchEnded(true);
          setScreen('result');
          buildResult(data);
          return;
        }

        if (finished) {
          // I already finished — waiting for opponent
          setMyFinished(true);
          setScore(p1 ? data.player1Score : data.player2Score);
          setScreen('my_finished');
          return;
        }

        if (started) {
          // Already started but not finished — resume playing
          resumePlay(data);
        } else {
          setScreen('start');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg(t('multiplayer.matchNotFound'));
          setScreen('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // ── Timer effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
      return;
    }

    timerInterval.current = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev <= 0) return 0;
        return prev - 1000;
      });
    }, 1000);

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [screen]);

  // ── Time up: stop the game, notify backend, wait for opponent ──────────
  const handleTimeUp = useCallback(() => {
    if (!matchId || myFinished || matchEnded) return;

    // Stop the game locally: no more questions, show "waiting" screen
    setMyFinished(true);
    setSelectedIndex(null);
    setAnswerState('idle');
    setScreen('my_finished');

    // Notify backend so it marks us finished (authoritative state).
    api.post<{ finished: boolean; matchEnded: boolean }>(`/matches/${matchId}/finish`, {})
      .then((data) => {
        if (data.matchEnded) {
          api.get<MatchState>(`/matches/${matchId}`).then((updated) => {
            setMatch(updated);
            buildResult(updated);
          });
        }
      })
      .catch(() => {
        // The poll effect on the my_finished screen picks up the completed
        // state when the opponent finishes; the backend time guard also
        // rejects any late answers, so no score is lost.
      });
  }, [matchId, myFinished, matchEnded]);

  // ── Timer expiry ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'playing' && remainingMs <= 0 && question) {
      // Timer expired — the match ends for this player
      handleTimeUp();
    }
  }, [remainingMs, screen, question, handleTimeUp]);

  // ── Poll for opponent finishing ─────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'my_finished') {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    pollTimer.current = setInterval(async () => {
      if (!matchId) return;
      try {
        const updated = await api.get<MatchState>(`/matches/${matchId}`);
        if (updated.status === 'completed') {
          setMatch(updated);
          setMatchEnded(true);
          setScreen('result');
          buildResult(updated);
          if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
          }
        }
      } catch {
        // Silently retry
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [screen, matchId]);

  // ── Helper: resume play ─────────────────────────────────────────────────
  const resumePlay = async (existingMatch?: MatchState) => {
    if (!matchId) return;
    try {
      const data = await api.post<PlayResponse>(`/matches/${matchId}/play`, {});
      if (existingMatch) {
        setMatch(existingMatch);
      }
      setQuestion(data.question);
      setRemainingMs(data.remainingMs);
      setScreen('playing');
    } catch {
      setErrorMsg(t('multiplayer.errorResume'));
      setScreen('error');
    }
  };

  // ── Helper: build result ────────────────────────────────────────────────
  const buildResult = (m: MatchState) => {
    const isP1 = m.player1Id === currentUserId;
    const myScore = isP1 ? m.player1Score : m.player2Score;
    const oppScore = isP1 ? m.player2Score : m.player1Score;
    const iWon = m.winnerId === currentUserId;
    const tie = m.winnerId === null;

    setMatchResult({
      iWon,
      tie,
      myScore,
      opponentScore: oppScore,
      myStats: { correctCount: 0, totalAnswered: 0, maxStreak: 0 },
      opponentStats: { correctCount: 0, totalAnswered: 0, maxStreak: 0 },
    });
  };

  // ── Result sound (same as single-player: win fanfare / lose tone) ──────
  useEffect(() => {
    if (screen === 'result' && matchResult) {
      if (matchResult.iWon) {
        playGameWin();
      } else if (matchResult.tie) {
        playClick();
      } else {
        playGameOver();
      }
    }
  }, [screen, matchResult]);

  // ── Handle answer (optimistic UI — same pattern as QuizPage) ────────────
  // Shows feedback IMMEDIATELY from local question.correctIndex.
  // Fire API in background; on error, reset to idle for retry.
  const submitAnswer = useCallback((optionIndex: number) => {
    if (!matchId || answerState !== 'idle' || !question) return;

    // ── Show feedback INSTANTLY using local question data ──
    setSelectedIndex(optionIndex);
    const wasCorrect = optionIndex === question.correctIndex;
    setAnswerState(wasCorrect ? 'correct' : 'wrong');
    (wasCorrect ? playCorrect : playWrong)();

    // Compute optimistic score locally (same formula as backend calculateRaceScore)
    const streakBefore = wasCorrect ? streak : 0;
    const optimisticEarned = wasCorrect
      ? (streakBefore >= 3 ? 150 : 100)
      : -50;
    const newStreakVal = wasCorrect ? streak + 1 : 0;
    setStreak(newStreakVal);
    setScore((prev) => prev + optimisticEarned);

    // ── Fire API in background (async, non-blocking) ──
    api.post<AnswerResponse>(`/matches/${matchId}/answer`, { optionIndex })
      .then((data) => {
        // Authoritative state from backend
        setStreak(data.streak);
        setMyFinished(data.finished);
        setMatchEnded(data.matchEnded);

        if (data.matchEnded) {
          api.get<MatchState>(`/matches/${matchId}`).then((updated) => {
            setMatch(updated);
            buildResult(updated);
          });
        }

        // Advance after a short time so user sees the feedback.
        // Feedback stays visible until this timer fires (no intermediate blank state).
        feedbackTimer.current = setTimeout(() => {
          if (data.matchEnded) {
            setScreen('result');
          } else if (data.finished) {
            setScreen('my_finished');
          } else if (data.nextQuestion) {
            setQuestion(data.nextQuestion);
          }
          // Reset answer state only when advancing away
          setSelectedIndex(null);
          setAnswerState('idle');
        }, FEEDBACK_DURATION_MS);
      })
      .catch(() => {
        // On error: reset so user can retry on the current question
        setSelectedIndex(null);
        setAnswerState('idle');
      });
  }, [matchId, answerState, question, streak]);

  // Cleanup feedback timer on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  // ── Navigation guard ────────────────────────────────────────────────────
  const shouldBlock = screen === 'playing';
  const blocker = useBlocker(shouldBlock);

  // Also warn about browser-level navigation (close tab, refresh)
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // ── Start playing ───────────────────────────────────────────────────────
  const handleStart = () => resumePlay();

  // ── Go home ─────────────────────────────────────────────────────────────
  const handleGoHome = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
    navigate('/');
  };

  // ── Rematch ─────────────────────────────────────────────────────────────
  // Re-establishes the socket BEFORE sending: the socket is dead on the
  // result screen (FriendsPage disconnects on unmount, NotificationBell never
  // re-runs, MultiplayerPage never connects), so without this the
  // `challenge:accepted` event never reaches the client and the rematch would
  // stay stuck in "waiting" (design Decision 4).
  const handleRematch = useCallback(async () => {
    if (rematchState === 'sending' || rematchState === 'waiting') return;
    if (!token || !opponent || !match) return;

    connectSocket(token);

    setRematchError(null);
    setRematchState('sending');
    try {
      await api.post('/matches/challenge', {
        receiverId: opponent.id,
        gameModeSlug: match.gameModeSlug,
        durationMinutes: match.durationMinutes,
      });
      setRematchState('waiting');
    } catch (err) {
      const errorCode = err instanceof ApiError ? err.errorCode : undefined;
      const known: Record<string, string> = {
        NOT_FRIENDS: t('multiplayer.challengeNotFriends'),
        CHALLENGE_IN_FLIGHT: t('multiplayer.challengeInFlight'),
        PENDING_CHALLENGE: t('multiplayer.challengePending'),
      };
      setRematchError((errorCode && known[errorCode]) || t('multiplayer.challengeError'));
      setRematchState('error');
    }
  }, [rematchState, opponent, match, token, t]);

  // ── Screen content ─────────────────────────────────────────────────────
  let content: React.ReactNode = null;

  if (screen === 'error') {
    content = (
      <div className="mx-auto max-w-md py-20">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          <p className="text-base text-[var(--color-muted-foreground)]">{errorMsg}</p>
          <button
            onClick={handleGoHome}
            className="mt-6 w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.backToHome')}
          </button>
        </div>
      </div>
    );
  } else if (screen === 'loading') {
    content = (
      <div className="flex items-center justify-center py-32">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
      </div>
    );
  } else if (screen === 'start') {
    content = (
      <div className="mx-auto max-w-md py-20">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          <h2 className="text-5xl">⚔️</h2>
          <p className="mt-4 text-base text-[var(--color-foreground)] font-medium">
            {t('multiplayer.challengeFrom', { username: opponentName })}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {t('multiplayer.youHave', { minutes: match?.durationMinutes ?? 3 })}
          </p>
          <button
            onClick={handleStart}
            className="mt-8 w-full min-h-[52px] rounded-lg bg-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {t('multiplayer.startPlaying')}
          </button>
          <button
            onClick={handleGoHome}
            className="mt-3 w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.backToHome')}
          </button>
        </div>
      </div>
    );
  } else if (screen === 'my_finished') {
    content = (
      <div className="mx-auto max-w-md py-20">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          <h2 className="text-5xl">🏁</h2>
          <p className="mt-4 text-xl font-bold text-[var(--color-foreground)]">
            {t('multiplayer.youFinished')}
          </p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-primary)]">
            {score}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('multiplayer.score', { score })}
          </p>
          <div className="mt-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
            {t('multiplayer.waitingOpponent')}
          </p>
          <button
            onClick={handleGoHome}
            className="mt-8 w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.backToHome')}
          </button>
        </div>
      </div>
    );
  } else if (screen === 'result' && matchResult) {
    content = (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center shadow-sm">
          {matchResult.tie ? (
            <h2 className="text-4xl font-bold text-[var(--color-foreground)]">
              {t('multiplayer.result.tie')}
            </h2>
          ) : matchResult.iWon ? (
            <h2 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
              {t('multiplayer.result.youWon')}
            </h2>
          ) : (
            <h2 className="text-4xl font-bold text-[var(--color-foreground)]">
              {t('multiplayer.result.youLost')}
            </h2>
          )}

          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {t('multiplayer.result.reason.finished')}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
                {t('multiplayer.you')}
              </p>
              <p className="text-3xl font-bold text-[var(--color-primary)]">
                {matchResult.myScore}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {t('multiplayer.score', { score: matchResult.myScore })}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
              <p className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
                {opponentName}
              </p>
              <p className="text-3xl font-bold text-[var(--color-foreground)]">
                {matchResult.opponentScore}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {t('multiplayer.score', { score: matchResult.opponentScore })}
              </p>
            </div>
          </div>

          <button
            onClick={handleRematch}
            disabled={rematchState === 'sending' || rematchState === 'waiting'}
            className="mt-8 w-full min-h-[52px] rounded-lg bg-[var(--color-primary)] px-4 py-3 text-base font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
          >
            {rematchState === 'sending' || rematchState === 'waiting'
              ? t('multiplayer.waitingResponse')
              : t('multiplayer.rematch')}
          </button>
          {rematchError && (
            <p role="alert" className="mt-2 text-xs text-[var(--color-destructive)]">
              {rematchError}
            </p>
          )}

          <button
            onClick={handleGoHome}
            className="mt-3 w-full min-h-[52px] rounded-lg border border-[var(--color-border)] px-4 py-3 text-base font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.backToHome')}
          </button>
        </div>
      </div>
    );
  } else if (screen === 'playing') {
    if (!question) {
      content = (
        <div className="flex items-center justify-center py-32">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      );
    } else {
      const timerFraction = Math.max(0, remainingMs / totalMs);
      const timerSeconds = Math.ceil(remainingMs / 1000);
      const timerColor =
        timerFraction > 0.5
          ? 'bg-emerald-500'
          : timerFraction > 0.25
            ? 'bg-amber-500'
            : 'bg-red-500';

      content = (
        <div className="mx-auto max-w-4xl px-4 py-3 sm:px-0 sm:py-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 sm:mb-6 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-sm font-medium text-[var(--color-muted-foreground)] sm:text-base">
                ⚔️ {opponentName}
              </span>
              {streak >= 5 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                  {t('multiplayer.streak', { count: streak })}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-[var(--color-foreground)] sm:text-2xl">
                {score}
              </span>
            </div>
          </div>

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

          <h2 className="mb-3.5 text-xl font-semibold text-[var(--color-foreground)] sm:mb-6 sm:text-3xl">
            {question.questionText}
          </h2>

          {question.flagUrl && (
            <div className="mb-3.5 flex justify-center sm:mb-6">
              <img
                src={question.flagUrl}
                alt=""
                className="h-28 max-h-[33vh] rounded-lg border border-[var(--color-border)] object-cover shadow-sm sm:h-52"
              />
            </div>
          )}

          <div key={question.id} className="grid gap-2.5 sm:gap-3 sm:grid-cols-2">
            {question.options.map((option: string, index: number) => (
              <button
                key={`${question.id}-${index}`}
                onClick={() => submitAnswer(index)}
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

          {answerState !== 'idle' && (
            <div
              className={`mt-2.5 rounded-lg px-3 py-2 text-sm font-medium sm:mt-4 sm:px-4 sm:py-3 sm:text-sm ${
                answerState === 'correct'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}
            >
              {answerState === 'correct' ? t('multiplayer.correct') : t('multiplayer.wrong')}
            </div>
          )}
        </div>
      );
    }
  }

  // ── Unified render with navigation guard modal ────────────────────────
  return (
    <>
      {content}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center shadow-lg">
            <p className="text-lg font-semibold text-[var(--color-foreground)]">
              {t('multiplayer.leaveTitle')}
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              {t('multiplayer.leaveWarning')}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
              >
                {t('multiplayer.leaveStay')}
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('multiplayer.leaveAnyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
