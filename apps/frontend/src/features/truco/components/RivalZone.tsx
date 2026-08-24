import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Scoreboard } from './Scoreboard';

/**
 * TOP zone: opponent avatar, nickname, scoreboard with progress toward the
 * target, face-down hand count. Turn presence is shown via an ambient glow
 * ring on this panel — the explicit pill moved to the shared TurnBanner.
 */
export interface RivalZoneProps {
  name: string;
  score: number;
  targetPoints: number;
  handCount: number;
  isTurn: boolean;
  isMano: boolean;
  /** Custom avatar node (CPU persona emoji); monogram initial when absent. */
  avatar?: ReactNode;
}

export function RivalZone({
  name,
  score,
  targetPoints,
  handCount,
  isTurn,
  isMano,
  avatar,
}: RivalZoneProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="truco-rival-zone"
      className={[
        'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-shadow',
        isTurn
          ? 'border-emerald-400/60 bg-[var(--color-card)] truco-turn-glow'
          : 'border-[var(--color-border)] bg-[var(--color-card)]',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Avatar: custom node when supplied (CPU personas), else the
            deterministic monogram initial (multiplayer nicknames). */}
        <div
          data-testid="truco-rival-avatar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white"
        >
          {avatar ?? name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p data-testid="rival-name" className="truncate text-sm font-semibold">
            {name}
          </p>
          <Scoreboard
            score={score}
            targetPoints={targetPoints}
            tone="rival"
            isMano={isMano}
          />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span
          data-testid="rival-hand-count"
          title={t('truco.card.back')}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-1 text-xs font-semibold tabular-nums"
        >
          🂠 ×{handCount}
        </span>
      </div>
    </div>
  );
}
