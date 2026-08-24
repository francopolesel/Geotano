import { useTranslation } from 'react-i18next';

/**
 * Compact per-player scoreboard: big tabular number + thin progress bar
 * toward the match target, plus the MANO badge for whoever dealt.
 * Pure presentation — every value arrives via props from the redacted view.
 */
export interface ScoreboardProps {
  score: number;
  targetPoints: number;
  /** Whose panel this is — drives the fill color and test id. */
  tone: 'mine' | 'rival';
  isMano: boolean;
}

export function Scoreboard({ score, targetPoints, tone, isMano }: ScoreboardProps) {
  const { t } = useTranslation();
  const pct = Math.max(0, Math.min(100, (score / targetPoints) * 100));

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        data-testid={tone === 'mine' ? 'my-score' : 'rival-score'}
        className="text-xl font-bold leading-none tabular-nums text-[var(--color-foreground)]"
      >
        {score}
      </span>
      <div className="flex min-w-[4.5rem] flex-col gap-1">
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={targetPoints}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]"
        >
          <div
            className={[
              'h-full rounded-full transition-all duration-500',
              tone === 'mine' ? 'bg-emerald-500' : 'bg-red-400/80',
            ].join(' ')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {t('truco.score.goal', { target: targetPoints })}
        </span>
      </div>
      {isMano ? (
        <span
          data-testid={`mano-badge-${tone}`}
          title={t('truco.mano.badge')}
          className="shrink-0 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-amber-950"
        >
          {t('truco.mano.badge')}
        </span>
      ) : null}
    </div>
  );
}
