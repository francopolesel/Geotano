import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Opponent {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isVerified?: boolean;
}

interface MatchSummary {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  gameModeSlug: string;
  player1Score: number;
  player2Score: number;
  player1Finished: boolean;
  player2Finished: boolean;
  player1StartedAt: string | null;
  player2StartedAt: string | null;
  winnerId: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  opponent: Opponent;
}

interface HistoryResponse {
  matches: MatchSummary[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<HistoryResponse>('/matches/history');
        if (!cancelled) {
          setMatches(data.matches ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load match history');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchHistory();
    return () => { cancelled = true; };
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
          {t('multiplayer.matchHistory')}
        </h1>
        <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
          {t('multiplayer.matchHistory')}
        </h1>
        <div className="rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 p-4 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
          {t('multiplayer.matchHistory')}
        </h1>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('multiplayer.noMatches')}
          </p>
          <button
            onClick={() => navigate('/friends')}
            className="mt-4 rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {t('friends.findFriends')}
          </button>
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('multiplayer.matchHistory')}
      </h1>

      <div className="space-y-2">
        {matches.map((match) => {
          const isMe = currentUserId === match.player1Id;
          const myScore = isMe ? match.player1Score : match.player2Score;
          const opponentScore = isMe ? match.player2Score : match.player1Score;
          const winner = match.winnerId;

          let resultBadge: { label: string; variant: string } | null = null;
          if (match.status === 'completed') {
            if (winner === null) {
              resultBadge = { label: t('multiplayer.result.tie'), variant: 'neutral' };
            } else if (winner === currentUserId) {
              resultBadge = { label: t('multiplayer.result.youWon'), variant: 'win' };
            } else {
              resultBadge = { label: t('multiplayer.result.youLost'), variant: 'loss' };
            }
          }

          return (
            <button
              key={match.id}
              onClick={() => navigate(`/multiplayer/${match.id}`)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
            >
              <div className="flex items-center gap-3">
                {/* Opponent avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                  {(match.opponent.displayName ?? match.opponent.username).charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Opponent name + game mode */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-foreground)]">
                      {match.opponent.displayName ?? match.opponent.username}
                      {match.opponent.isVerified && <VerifiedBadge className="ml-1" />}
                    </span>
                    {resultBadge && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          resultBadge.variant === 'win'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : resultBadge.variant === 'loss'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {resultBadge.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
                    <span>{t(`modes.${match.gameModeSlug}` as const) || match.gameModeSlug}</span>
                    <span className="font-medium">
                      {myScore} – {opponentScore}
                    </span>
                    {match.status === 'in_progress' && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {t('multiplayer.inProgress')}
                      </span>
                    )}
                    {match.status === 'pending' && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        {t('multiplayer.pending')}
                      </span>
                    )}
                    <span className="ml-auto">{formatDate(match.createdAt)}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
