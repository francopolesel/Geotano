import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { UserAvatar } from '../../components/ui/UserAvatar';
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

const MODE_SLUG_TO_KEY: Record<string, string> = Object.fromEntries(
  MODE_SLUGS.map((m) => [m.slug, m.key]),
);

type Variant = 'hardcore' | 'unlimited' | 'express';

function parseModeSlug(slug: string): { base: string; variant?: Variant } {
  const match = slug.match(/^(.+)-(hardcore|unlimited|express)$/);
  if (match) return { base: match[1], variant: match[2] as Variant };
  return { base: slug };
}

const VARIANT_LABEL_KEY: Record<Variant, string> = {
  hardcore: 'modes.variantHardcore',
  unlimited: 'modes.variantUnlimited',
  express: 'modes.variantExpress',
};

export async function fetchRankings(
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
  const navigate = useNavigate();
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

      {/* Filters row: scope + period pills */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-[var(--color-border)] p-1">
          <button
            onClick={() => setScope('global')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              scope === 'global'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('rankings.global')}
          </button>
          <button
            onClick={() => setScope('friends')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              scope === 'friends'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('rankings.friends')}
          </button>
        </div>
        <div className="flex rounded-lg border border-[var(--color-border)] p-1">
          <button
            onClick={() => setPeriod('forever')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              period === 'forever'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('rankings.forever')}
          </button>
          <button
            onClick={() => setPeriod('daily')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
              period === 'daily'
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {t('rankings.daily')}
          </button>
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
          <img src="/error_image.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-xl" />
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
            <div className="-mx-4 sm:mx-0 overflow-x-auto rounded-none sm:rounded-lg border-x-0 sm:border-x border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/50">
                    <th className="px-3 sm:px-4 py-2.5 text-left text-xs font-medium uppercase text-[var(--color-muted-foreground)] w-8 sm:w-auto">
                      #
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 text-left text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
                      {t('rankings.player')}
                    </th>
                    <th className="px-3 sm:px-4 py-2.5 text-right text-xs font-medium uppercase text-[var(--color-muted-foreground)] whitespace-nowrap">
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
                        onClick={() => navigate(`/profile/${entry.userId}`)}
                        className={`cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 ${
                          isCurrentUser
                            ? 'bg-[var(--color-primary)]/5'
                            : 'hover:bg-[var(--color-muted)]/30'
                        }`}
                      >
                        <td className="px-3 sm:px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                          {entry.rank}
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              avatarUrl={entry.avatarUrl}
                              username={entry.username}
                              className="h-8 w-8 text-xs"
                            />
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
                        <td className="px-3 sm:px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                            <span className="font-mono text-sm font-semibold text-[var(--color-foreground)]">
                              {entry.score.toLocaleString()}
                            </span>
                            {!mode && entry.gameModeSlug && (() => {
                              const { base, variant } = parseModeSlug(entry.gameModeSlug!);
                              const baseKey = MODE_SLUG_TO_KEY[base];
                              if (!baseKey) {
                                return (
                                  <span className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-[9px] font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">
                                    {entry.gameModeSlug}
                                  </span>
                                );
                              }
                              return (
                                <div className="flex items-center gap-0.5 sm:gap-1">
                                  <span className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-[9px] sm:text-[10px] font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">
                                    {t(baseKey)}
                                  </span>
                                  {variant === 'hardcore' && (
                                    <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] sm:text-[10px] font-medium text-white whitespace-nowrap">
                                      🔥{t('modes.variantHardcore')}
                                    </span>
                                  )}
                                  {variant === 'unlimited' && (
                                    <span className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-[9px] sm:text-[10px] font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">
                                      {t('modes.variantUnlimited')}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
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
                  <UserAvatar
                    avatarUrl={data.userRank.avatarUrl}
                    username={data.userRank.username}
                    className="h-8 w-8 text-xs"
                  />
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
