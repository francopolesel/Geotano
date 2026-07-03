import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserStats {
  totalScore: number;
  totalGames: number;
  bestScore: number;
  friends: number;
}

interface RecentGame {
  id: string;
  gameModeSlug: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

interface ProfileResponse {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  stats: UserStats;
  recentGames: RecentGame[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, string> = {
  'flag-guess': 'modes.flagGuess',
  'capital-guess': 'modes.capitalGuess',
  'country-by-flag': 'modes.countryByFlag',
  continent: 'modes.continent',
  free: 'modes.free',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();

  const { data, isLoading, error } = useQuery<ProfileResponse>({
    queryKey: ['profile', userId],
    queryFn: () => api.get<ProfileResponse>(`/users/${userId}/profile`),
    enabled: !!userId,
    staleTime: 15_000,
  });

  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        User ID is missing
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('common.loading')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-destructive)]">
        {t('common.error')}
      </div>
    );
  }

  const { user, stats, recentGames } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* User info header */}
      <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <UserAvatar
          avatarUrl={user.avatarUrl}
          username={user.username}
          displayName={user.displayName}
          className="h-16 w-16 text-2xl"
        />
        <div>
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">
            {user.displayName ?? user.username}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            @{user.username}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.stats')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t('profile.totalScore')} value={stats.totalScore.toLocaleString()} />
          <StatCard label={t('profile.totalGames')} value={stats.totalGames.toLocaleString()} />
          <StatCard label={t('profile.bestScore')} value={stats.bestScore.toLocaleString()} />
          <StatCard label={t('profile.friends')} value={stats.friends.toLocaleString()} />
        </div>
      </section>

      {/* Recent games */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.recentGames')}
        </h2>
        {recentGames.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('profile.noGames')}
          </p>
        ) : (
          <div className="space-y-2">
            {recentGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    {t(MODE_LABELS[game.gameModeSlug] ?? game.gameModeSlug)}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {game.correctCount}/{game.totalQuestions} &middot; {formatDate(game.completedAt)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-[var(--color-primary)]">
                  {game.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-center">
      <p className="text-lg font-bold text-[var(--color-foreground)]">{value}</p>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}
