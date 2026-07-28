import { useTranslation } from 'react-i18next';
import type { GameModeSlug } from '@geotano/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Constants ──────────────────────────────────────────────────────────────

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

// ─── Props ──────────────────────────────────────────────────────────────────

interface GameModePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (slug: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GameModePicker({ open, onClose, onSelect }: GameModePickerProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const handleSelect = (slug: string) => {
    onSelect(slug);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
            {t('multiplayer.selectMode')}
          </h2>
        </div>

        {/* Groups */}
        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {MODE_GROUPS.map((group) => (
              <div
                key={group.baseSlug}
                className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${group.color}`}
                />

                <div className="flex flex-col gap-1">
                  <span className="text-2xl">{group.icon}</span>
                  <h3 className="font-semibold text-[var(--color-card-foreground)]">
                    {t(group.titleKey)}
                  </h3>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {t(group.descKey)}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-1.5 pt-3">
                  {group.variants.map((variant) => (
                    <button
                      key={variant.slug}
                      onClick={() => handleSelect(variant.slug)}
                      className={`min-h-[40px] w-full rounded-lg border px-3 py-2 text-left text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm ${
                        variant.slug.endsWith('-hardcore')
                          ? 'border-red-500/50 bg-red-50 dark:bg-red-950/20 hover:border-red-500 hover:bg-red-100 dark:hover:bg-red-950/40'
                          : 'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${
                            variant.slug.endsWith('-hardcore')
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-[var(--color-primary)]'
                          }`}
                        >
                          {variant.slug.endsWith('-hardcore')
                            ? `🔥 ${t(variant.labelKey)}`
                            : t(variant.labelKey)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-6 py-3">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
