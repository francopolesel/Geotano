import type { PlayerSlot } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { TrophyIcon } from './icons';

/**
 * Match-end panel (batch 3 celebration pass): result title, prominent final
 * score against the target and the navigation actions.
 *
 * Victory gets a warm celebratory treatment — trophy, golden accents and a
 * one-shot (~1s) confetti burst. Defeat stays deliberately muted and
 * respectful: no harsh red wash. The draw label exists for shared-pattern
 * parity but is unreachable in truco v1 (the mano rule decides every hand).
 */
export interface EndScreenProps {
  /** Null = draw (unreachable in v1, kept conditionally). */
  winner: PlayerSlot | null;
  mySlot: PlayerSlot;
  scores: Record<PlayerSlot, number>;
  targetPoints: number;
  myName: string;
  opponentName: string;
  onPlayAgain: () => void;
  onChangeMode: () => void;
  onBack: () => void;
  onGeotano: () => void;
}

/** Confetti palette — warm golds/greens matching the game identity. */
const CONFETTI_COLORS = ['#f5c542', '#e8a020', '#34d399', '#fbbf24', '#a3e635'];

/**
 * One-shot confetti burst: ~1s CSS animation, `both` fill so it plays exactly
 * once per mount and then rests invisible. Purely decorative.
 */
function ConfettiBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      {CONFETTI_COLORS.flatMap((color, colorIndex) =>
        [0, 1].map((lane) => {
          const index = colorIndex * 2 + lane;
          const style = {
            left: `${8 + index * 10}%`,
            backgroundColor: color,
            animationDelay: `${index * 40}ms`,
            '--drift': `${(index % 2 === 0 ? 1 : -1) * (12 + index * 3)}px`,
          } as React.CSSProperties;
          return (
            <span
              key={index}
              className="animate-truco-confetti absolute top-0 block h-1.5 w-1.5 rounded-[1px]"
              style={style}
            />
          );
        }),
      )}
    </div>
  );
}

export function EndScreen({
  winner,
  mySlot,
  scores,
  targetPoints,
  myName,
  opponentName,
  onPlayAgain,
  onChangeMode,
  onBack,
  onGeotano,
}: EndScreenProps) {
  const { t } = useTranslation();

  const won = winner === mySlot;
  const lost = winner !== null && !won;
  const titleKey =
    winner === null ? 'truco.end.draw' : won ? 'truco.end.win' : 'truco.end.lose';

  const opponentSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  const rows: Array<{ name: string; score: number; mine: boolean }> = [
    { name: myName, score: scores[mySlot], mine: true },
    { name: opponentName, score: scores[opponentSlot], mine: false },
  ];

  return (
    <div
      data-testid="truco-end-screen"
      className={[
        'relative mx-auto flex w-full max-w-sm min-w-0 flex-col items-center gap-4 overflow-hidden rounded-xl border bg-[var(--color-card)] p-6 shadow-lg',
        won
          ? 'border-amber-300/70 dark:border-amber-500/50'
          : 'border-[var(--color-border)]',
      ].join(' ')}
    >
      {/* Victory-only one-shot confetti (~1s) */}
      {won ? <ConfettiBurst /> : null}

      {won ? (
        <span
          aria-hidden
          data-testid="truco-end-trophy"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-900/40 dark:text-amber-400"
        >
          <TrophyIcon className="h-9 w-9" />
        </span>
      ) : (
        // Defeat keeps a quiet neutral mark instead of a red wash.
        <span
          aria-hidden
          data-testid="truco-end-trophy"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9">
            <path
              d="M6 4h12v7a6 6 0 0 1-12 0V4ZM12 17v3M8.5 20h7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
          </svg>
        </span>
      )}

      <h2
        data-testid="truco-end-title"
        className={[
          'text-3xl font-extrabold tracking-tight transition-colors',
          won
            ? 'text-emerald-600 dark:text-emerald-400'
            : lost
              ? 'text-[var(--color-muted-foreground)]'
              : '',
        ].join(' ')}
      >
        {t(titleKey)}
      </h2>

      <div data-testid="truco-end-scores" className="w-full min-w-0 text-center">
        {/* Headline score first: the result is the hero of this screen */}
        <p className="mb-2 text-5xl font-black tabular-nums tracking-tight text-[var(--color-foreground)]">
          {scores[mySlot]} – {scores[opponentSlot]}
        </p>
        {rows.map((row) => (
          <div
            key={row.name}
            className={[
              'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md px-3 py-1 text-sm',
              row.mine ? 'font-bold' : 'text-[var(--color-muted-foreground)]',
            ].join(' ')}
          >
            <span className="min-w-0 truncate">{row.name}</span>
            <span className="tabular-nums">{row.score}</span>
          </div>
        ))}
      </div>

      <p data-testid="truco-end-target" className="text-xs text-[var(--color-muted-foreground)]">
        {t('truco.target')}: <span className="tabular-nums font-semibold">{targetPoints}</span>
      </p>

      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Primary action leads; everything else is clearly secondary */}
        <button
          type="button"
          data-testid="truco-end-play-again"
          onClick={onPlayAgain}
          className="min-h-[48px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:col-span-2"
        >
          {t('truco.action.playAgain')}
        </button>
        <button
          type="button"
          data-testid="truco-end-change-mode"
          onClick={onChangeMode}
          className="min-h-[44px] rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {t('truco.action.changeMode')}
        </button>
        <button
          type="button"
          data-testid="truco-end-back"
          onClick={onBack}
          className="min-h-[44px] rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {t('truco.action.back')}
        </button>
        <button
          type="button"
          data-testid="truco-end-geotano"
          onClick={onGeotano}
          className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-all hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] sm:col-span-2"
        >
          {t('truco.action.geotano')}
        </button>
      </div>
    </div>
  );
}
