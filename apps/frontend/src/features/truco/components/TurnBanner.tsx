import { useTranslation } from 'react-i18next';
import { HourglassIcon, PlayIcon } from './icons';

/**
 * Prominent turn banner rendered between the table center and my hand.
 * Exactly one variant mounts at a time (or none outside the playing phase /
 * while a bet panel supersedes it). Test ids `my-turn-indicator` and
 * `rival-turn-indicator` live HERE since the redesign moved them out of the
 * player panels (panels now carry an ambient glow ring instead).
 */
export interface TurnBannerProps {
  myTurn: boolean;
  rivalTurn: boolean;
}

export function TurnBanner({ myTurn, rivalTurn }: TurnBannerProps) {
  const { t } = useTranslation();
  if (!myTurn && !rivalTurn) return null;

  if (myTurn) {
    return (
      <div className="flex min-w-0 justify-center">
        <span
          data-testid="my-turn-indicator"
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-600/40 animate-pulse"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {t('truco.turn.you')}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 justify-center">
      <span
        data-testid="rival-turn-indicator"
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      >
        <HourglassIcon className="h-3.5 w-3.5" />
        {t('truco.turn.rivalPending')}
      </span>
    </div>
  );
}
