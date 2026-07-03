import { useTranslation } from 'react-i18next';
import type { Achievement } from '@geotano/shared';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AchievementBadgeProps {
  achievement: Achievement;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AchievementBadge({ achievement }: AchievementBadgeProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith('es') ? 'es' : 'en';

  const name = locale === 'es' ? achievement.nameEs : achievement.nameEn;
  const description =
    locale === 'es' ? achievement.descriptionEs : achievement.descriptionEn;
  const earned = !!achievement.earnedAt;

  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
        earned
          ? 'border-[var(--color-border)] bg-[var(--color-card)]'
          : 'border-dashed border-[var(--color-border)] opacity-40'
      }`}
      title={description}
    >
      <span className="text-2xl">{achievement.icon}</span>
      <span
        className={`text-xs font-medium leading-tight ${
          earned
            ? 'text-[var(--color-foreground)]'
            : 'text-[var(--color-muted-foreground)]'
        }`}
      >
        {name}
      </span>
      {achievement.tier && (
        <span
          className={`text-[10px] font-semibold ${
            achievement.tier === 3
              ? 'text-yellow-500'
              : achievement.tier === 2
                ? 'text-gray-400'
                : 'text-amber-700'
          }`}
        >
          {achievement.tier === 3
            ? t('achievements.tierGold')
            : achievement.tier === 2
              ? t('achievements.tierSilver')
              : t('achievements.tierBronze')}
        </span>
      )}
    </div>
  );
}
