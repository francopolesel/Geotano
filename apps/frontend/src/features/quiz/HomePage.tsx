import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import type { GameModeSlug } from '@geotano/shared';

interface HomeStats {
  totalScore: number;
  totalGames: number;
  bestScore: number;
  friends: number;
}

interface ModeCard {
  slug: GameModeSlug;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
}

const MODES: ModeCard[] = [
  {
    slug: 'flag-guess',
    icon: '🏁',
    titleKey: 'modes.flagGuess',
    descKey: 'modes.flagGuessDesc',
    color: 'from-blue-500 to-blue-600',
  },
  {
    slug: 'capital-guess',
    icon: '🏛️',
    titleKey: 'modes.capitalGuess',
    descKey: 'modes.capitalGuessDesc',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    slug: 'country-by-flag',
    icon: '🇺🇳',
    titleKey: 'modes.countryByFlag',
    descKey: 'modes.countryByFlagDesc',
    color: 'from-violet-500 to-violet-600',
  },
  {
    slug: 'continent',
    icon: '🌍',
    titleKey: 'modes.continent',
    descKey: 'modes.continentDesc',
    color: 'from-amber-500 to-amber-600',
  },
  {
    slug: 'free',
    icon: '🎲',
    titleKey: 'modes.free',
    descKey: 'modes.freeDesc',
    color: 'from-rose-500 to-rose-600',
  },
];

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setStatsLoading(true);
    api
      .get<{ stats: HomeStats }>(`/users/${user.id}/profile`)
      .then((data) => setStats(data.stats))
      .catch(() => {
        /* silently fail — non-critical */
      })
      .finally(() => setStatsLoading(false));
  }, [user?.id]);

  const handleStart = (mode: GameModeSlug) => {
    navigate(`/quiz?mode=${mode}`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)] sm:text-3xl">
          {t('home.greeting', { username: user?.displayName ?? user?.username ?? '' })}
        </h1>
        <p className="mt-1 text-[var(--color-muted-foreground)]">{t('home.subtitle')}</p>
      </div>

      {/* Mode cards grid */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
          {t('home.title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.slug}
              onClick={() => handleStart(mode.slug)}
              className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Color accent bar */}
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${mode.color}`}
              />

              <div className="flex flex-col gap-2">
                <span className="text-3xl">{mode.icon}</span>
                <h3 className="font-semibold text-[var(--color-card-foreground)]">
                  {t(mode.titleKey)}
                </h3>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t(mode.descKey)}
                </p>
              </div>

              {/* Start CTA */}
              <div className="mt-3 flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100">
                {t('home.start')}
                <span className="text-lg leading-none">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">
          {t('home.stats')}
        </h3>
        {statsLoading ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">{t('common.loading')}</p>
        ) : stats && stats.totalGames > 0 ? (
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-foreground)]">{stats.totalScore}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('profile.totalScore')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-foreground)]">{stats.totalGames}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('profile.totalGames')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-foreground)]">{stats.bestScore}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('profile.bestScore')}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--color-foreground)]">{stats.friends}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{t('profile.friends')}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-card-foreground)]">
            {t('home.noGamesYet')}
          </p>
        )}
      </div>
    </div>
  );
}
