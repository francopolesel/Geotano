import { useTranslation } from 'react-i18next';

/**
 * Prominent per-player scoreboard: huge tabular number + thick progress bar
 * toward the match target, plus the MANO badge for whoever dealt.
 * Pure presentation — every value arrives via props from the redacted view.
 */
export interface ScoreboardProps {
  score: number;
  targetPoints: number;
  /** Whose panel this is — drives the fill color, label, and test id. */
  tone: 'mine' | 'rival';
  isMano: boolean;
}

export function Scoreboard({ score, targetPoints, tone, isMano }: ScoreboardProps) {
  const { t } = useTranslation();
  const pct = Math.max(0, Math.min(100, (score / targetPoints) * 100));
  const isMine = tone === 'mine';

  return (
    <div className="flex min-w-[6rem] flex-col items-center gap-0.5">
      {/* Label: VOS / RIVAL — always visible above the score */}
      <span className="text-xs uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {isMine ? t('truco.you') : t('truco.rival')}
      </span>

      {/* Score: huge, tabular, font-black */}
      <span
        data-testid={isMine ? 'my-score' : 'rival-score'}
        className="text-3xl sm:text-4xl font-black leading-none tabular-nums text-[var(--color-foreground)]"
      >
        {score}
      </span>

      {/* Progress bar: thinner (h-1.5), rounded-full, with subtle glow */}
      <div
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={targetPoints}
        aria-label={t('truco.score.progress', { current: score, target: targetPoints })}
        className="w-full h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]"
      >
        <div
          className={[
            'h-full rounded-full transition-all duration-500',
            isMine
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
              : 'bg-red-400/90 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Goal label (kept for context) */}
      <span className="text-[8px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
        {t('truco.score.goal', { target: targetPoints })}
      </span>

      {/* MANO badge: larger, more prominent with amber ring */}
      {isMano ? (
        <span
          data-testid={`mano-badge-${tone}`}
          title={t('truco.mano.badge')}
          className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-full border-2 border-amber-400 bg-amber-50/50 px-2 py-0.5 text-[9px] font-black tracking-widest text-amber-700 dark:text-amber-300 dark:bg-amber-900/30"
        >
          {t('truco.mano.badge')}
        </span>
      ) : null}
    </div>
  );
}
