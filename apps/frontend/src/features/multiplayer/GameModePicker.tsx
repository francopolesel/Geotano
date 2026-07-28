import { useTranslation } from 'react-i18next';
import type { GameModeSlug } from '@geotano/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ModeOption {
  slug: GameModeSlug;
  icon: string;
  titleKey: string;
  descKey: string;
  color: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODES: ModeOption[] = [
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
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
            {t('multiplayer.selectMode')}
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {t('multiplayer.modePickerHint')}
          </p>
        </div>

        {/* Mode cards */}
        <div className="overflow-y-auto p-6">
          <div className="flex flex-col gap-3">
            {MODES.map((mode) => (
              <button
                key={mode.slug}
                onClick={() => handleSelect(mode.slug)}
                className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${mode.color}`}
                />

                <span className="shrink-0 text-2xl">{mode.icon}</span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--color-card-foreground)]">
                    {t(mode.titleKey)}
                  </h3>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {t(mode.descKey)}
                  </p>
                </div>

                <span className="shrink-0 text-[var(--color-muted-foreground)]">→</span>
              </button>
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
