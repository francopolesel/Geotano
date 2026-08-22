import type { PlayerSlot } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/**
 * Match-end panel: result title, final scores against the target and the
 * four navigation actions (spec: end-of-match screen). The draw label exists
 * for shared-pattern parity but is unreachable in truco v1 (the mano rule
 * decides every hand).
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

  const titleKey =
    winner === null ? 'truco.end.draw' : winner === mySlot ? 'truco.end.win' : 'truco.end.lose';

  const opponentSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  const rows: Array<{ name: string; score: number; mine: boolean }> = [
    { name: myName, score: scores[mySlot], mine: true },
    { name: opponentName, score: scores[opponentSlot], mine: false },
  ];

  return (
    <div
      data-testid="truco-end-screen"
      className="mx-auto flex w-full max-w-sm min-w-0 flex-col items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-lg"
    >
      <h2
        data-testid="truco-end-title"
        className={[
          'text-2xl font-extrabold tracking-tight transition-colors',
          winner === mySlot ? 'text-emerald-600' : winner === null ? '' : 'text-red-600',
        ].join(' ')}
      >
        {t(titleKey)}
      </h2>

      <div data-testid="truco-end-scores" className="w-full min-w-0 text-center">
        {rows.map((row) => (
          <div
            key={row.name}
            className={[
              'flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm',
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
        <button
          type="button"
          data-testid="truco-end-play-again"
          onClick={onPlayAgain}
          className="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:brightness-110"
        >
          {t('truco.action.playAgain')}
        </button>
        <button
          type="button"
          data-testid="truco-end-change-mode"
          onClick={onChangeMode}
          className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]"
        >
          {t('truco.action.changeMode')}
        </button>
        <button
          type="button"
          data-testid="truco-end-back"
          onClick={onBack}
          className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]"
        >
          {t('truco.action.back')}
        </button>
        <button
          type="button"
          data-testid="truco-end-geotano"
          onClick={onGeotano}
          className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-muted)]"
        >
          {t('truco.action.geotano')}
        </button>
      </div>
    </div>
  );
}
