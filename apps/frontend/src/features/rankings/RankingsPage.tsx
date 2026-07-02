import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import type { RankingsResponse } from '@geotano/shared';
import type { GameModeSlug } from '@geotano/shared';

type Scope = 'global' | 'friends';
type Period = 'forever' | 'daily';

const MODE_SLUGS: { slug: GameModeSlug; key: string }[] = [
  { slug: 'flag-guess', key: 'modes.flagGuess' },
  { slug: 'capital-guess', key: 'modes.capitalGuess' },
  { slug: 'country-by-flag', key: 'modes.countryByFlag' },
  { slug: 'continent', key: 'modes.continent' },
  { slug: 'free', key: 'modes.free' },
];

async function fetchRankings(
  scope: Scope,
  period: Period,
  mode: GameModeSlug | undefined,
): Promise<RankingsResponse> {
  const params = new URLSearchParams({ scope, period });
  if (mode) params.set('mode', mode);
  return api.get<RankingsResponse>(`/rankings?${params}`);
}

export function RankingsPage() {
  const { t } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);

  const [scope, setScope] = useState<Scope>('global');
  const [period, setPeriod] = useState<Period>('forever');
  const [mode, setMode] = useState<GameModeSlug | undefined>(undefined);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rankings', scope, period, mode],
    queryFn: () => fetchRankings(scope, period, mode),
    staleTime: 15_000,
  });

  const handleModeChange = useCallback((slug: GameModeSlug | undefined) => {
    setMode(slug);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('rankings.title')}
      </h1>

      {/* Mode selector tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] p-1">
        <button
          onClick={() => handleModeChange(undefined)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
            mode === undefined
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
          }`}
        >
          {t('common.all')}
        </button>
        {MODE_SLUGS.map((m) => (
          <button
            key={m.slug}
            onClick={() => handleModeChange(m.slug)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              mode === m.slug
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t(m.key)}
          </button>
        ))}
      </div>

      {/* Filters row: scope + period toggles */}
      <div className="mb-6 flex items-center gap-4">
        {/* Scope toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {t('rankings.global')}
          </span>
          <button
            onClick={() => setScope(scope === 'global' ? 'friends' : 'global')}
            className={`relative inline-flex h-6 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors ${
              scope === 'friends'
                ? 'bg-[var(--color-primary)]'
                : 'bg-[var(--color-border)]'
            }`}
            aria-label={`Switch to ${scope === 'global' ? 'friends' : 'global'} rankings`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                scope === 'friends' ? 'translate-x-[18px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {t('rankings.friends')}
          </span>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {t('rankings.forever')}
          </span>
          <button
            onClick={() => setPeriod(period === 'forever' ? 'daily' : 'forever')}
            className={`relative inline-flex h-6 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors ${
              period === 'daily'
                ? 'bg-[var(--color-primary)]'
                : 'bg-[var(--color-border)]'
            }`}
            aria-label={`Switch to ${period === 'forever' ? 'daily' : 'forever'} period`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                period === 'daily' ? 'translate-x-[18px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {t('rankings.daily')}
          </span>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('common.loading')}
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="py-12 text-center">
          <p className="mb-3 text-sm text-[var(--color-destructive)]">
            {t('common.error')}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {data && !isLoading && (
        <>
          {/* Player count */}
          <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
            {t('rankings.players', { count: data.totalPlayers })}
          </p>

          {/* Table */}
          {data.entries.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('rankings.noData')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                      #
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                      {t('rankings.player')}
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                      {t('rankings.score')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => {
                    const isCurrentUser = entry.userId === userId;
                    return (
                      <tr
                        key={entry.userId}
                        className={`border-b border-[var(--color-border)] transition-colors last:border-0 ${
                          isCurrentUser
                            ? 'bg-[var(--color-primary)]/5'
                            : 'hover:bg-[var(--color-muted)]/30'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                          {entry.rank}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                              {entry.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span
                                className={`text-sm font-medium ${
                                  isCurrentUser
                                    ? 'text-[var(--color-primary)]'
                                    : 'text-[var(--color-foreground)]'
                                }`}
                              >
                                {entry.username}
                              </span>
                              {isCurrentUser && (
                                <span className="ml-2 rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
                                  {t('rankings.you')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-[var(--color-foreground)]">
                          {entry.score.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* User's rank outside top 100 */}
          {data.userRank && !data.entries.find((e) => e.userId === userId) && (
            <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                {t('rankings.yourRank')}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-[var(--color-foreground)]">
                    #{data.userRank.rank}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-bold text-[var(--color-primary)]">
                    {data.userRank.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-[var(--color-foreground)]">
                    {data.userRank.username}
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold text-[var(--color-foreground)]">
                  {data.userRank.score.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
