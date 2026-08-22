import { useTranslation } from 'react-i18next';

/** TOP zone: opponent avatar, nickname, score/target, face-down count, turn indicator. */
export interface RivalZoneProps {
  name: string;
  score: number;
  targetPoints: number;
  handCount: number;
  isTurn: boolean;
}

export function RivalZone({ name, score, targetPoints, handCount, isTurn }: RivalZoneProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="truco-rival-zone"
      className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Avatar: deterministic monogram (CPU personas supply initials) */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p data-testid="rival-name" className="truncate text-sm font-semibold">
            {name}
          </p>
          <p data-testid="rival-score" className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
            {score} / {targetPoints}
          </p>
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
        {isTurn ? (
          <span
            data-testid="rival-turn-indicator"
            className="animate-pulse rounded-full bg-[var(--color-primary)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white transition-opacity"
          >
            {t('truco.turn.opponent')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
