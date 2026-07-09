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
  globalRank?: number;
}

interface ModeVariant {
  slug: GameModeSlug;
  labelKey: string;
}

interface ModeGroup {
  baseSlug: GameModeSlug;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
  variants: ModeVariant[];
}

const MODE_GROUPS: ModeGroup[] = [
  {
    baseSlug: 'flag-guess',
    icon: '🏁',
    titleKey: 'modes.flagGuess',
    descKey: 'modes.flagGuessDesc',
    color: 'from-blue-500 to-blue-600',
    variants: [
      { slug: 'flag-guess', labelKey: 'modes.variantStandard' },
      { slug: 'flag-guess-unlimited', labelKey: 'modes.variantUnlimited' },
      { slug: 'flag-guess-hardcore', labelKey: 'modes.variantHardcore' },
    ],
  },
  {
    baseSlug: 'capital-guess',
    icon: '🏛️',
    titleKey: 'modes.capitalGuess',
    descKey: 'modes.capitalGuessDesc',
    color: 'from-emerald-500 to-emerald-600',
    variants: [
      { slug: 'capital-guess', labelKey: 'modes.variantStandard' },
      { slug: 'capital-guess-unlimited', labelKey: 'modes.variantUnlimited' },
      { slug: 'capital-guess-hardcore', labelKey: 'modes.variantHardcore' },
    ],
  },
  {
    baseSlug: 'country-by-flag',
    icon: '🇺🇳',
    titleKey: 'modes.countryByFlag',
    descKey: 'modes.countryByFlagDesc',
    color: 'from-violet-500 to-violet-600',
    variants: [
      { slug: 'country-by-flag', labelKey: 'modes.variantStandard' },
      { slug: 'country-by-flag-unlimited', labelKey: 'modes.variantUnlimited' },
      { slug: 'country-by-flag-hardcore', labelKey: 'modes.variantHardcore' },
    ],
  },
  {
    baseSlug: 'continent',
    icon: '🌍',
    titleKey: 'modes.continent',
    descKey: 'modes.continentDesc',
    color: 'from-amber-500 to-amber-600',
    variants: [
      { slug: 'continent', labelKey: 'modes.variantStandard' },
      { slug: 'continent-unlimited', labelKey: 'modes.variantUnlimited' },
      { slug: 'continent-hardcore', labelKey: 'modes.variantHardcore' },
    ],
  },
  {
    baseSlug: 'free',
    icon: '🎲',
    titleKey: 'modes.free',
    descKey: 'modes.freeDesc',
    color: 'from-rose-500 to-rose-600',
    variants: [
      { slug: 'free', labelKey: 'modes.variantStandard' },
      { slug: 'free-unlimited', labelKey: 'modes.variantUnlimited' },
      { slug: 'free-hardcore', labelKey: 'modes.variantHardcore' },
    ],
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
          {MODE_GROUPS.map((group) => (
            <div
              key={group.baseSlug}
              className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-left shadow-sm transition-all hover:shadow-md"
            >
              {/* Color accent bar */}
              <div
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${group.color}`}
              />

              <div className="flex flex-col gap-2">
                <span className="text-3xl">{group.icon}</span>
                <h3 className="font-semibold text-[var(--color-card-foreground)]">
                  {t(group.titleKey)}
                </h3>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t(group.descKey)}
                </p>
              </div>

              {/* Mode buttons — clickable to play */}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                {group.variants.map((variant) => (
                  <button
                    key={variant.slug}
                    onClick={() => handleStart(variant.slug)}
                    className={`min-h-[48px] w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm ${
                      variant.slug.endsWith('-hardcore')
                        ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20 hover:border-red-500 hover:bg-red-100 dark:hover:bg-red-950/40'
                        : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-primary)] font-semibold uppercase tracking-wider">
                        {variant.slug.endsWith('-hardcore') ? `🔥 ${t(variant.labelKey)}` : t(variant.labelKey)}
                      </span>
                      <svg
                        className="ml-auto h-4 w-4 text-[var(--color-muted-foreground)] shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
          <>
            {/* Best Player rank — only for global top 3 */}
            {(stats as any).globalRank !== undefined && (stats as any).globalRank <= 3 && (
              <div className={`mb-4 rounded-lg border-2 px-4 py-3 text-center ${
                (stats as any).globalRank === 1
                  ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                  : (stats as any).globalRank === 2
                    ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/20'
                    : 'border-amber-700/50 bg-amber-50/50 dark:border-amber-600/50 dark:bg-amber-950/20'
              }`}>
                <p className={`font-bold text-xl ${
                  (stats as any).globalRank === 1
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : (stats as any).globalRank === 2
                      ? 'text-gray-400 dark:text-gray-300'
                      : 'text-amber-700 dark:text-amber-500'
                }`}>
                  {(stats as any).globalRank === 1 ? '👑 ' : ''}{t('profile.bestPlayer', { position: (stats as any).globalRank })}
                </p>
              </div>
            )}
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
          </>
        ) : (
          <p className="text-sm text-[var(--color-card-foreground)]">
            {t('home.noGamesYet')}
          </p>
        )}
      </div>
    </div>
  );
}
