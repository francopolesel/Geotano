import type { PlayerSlot, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/game/Modal';
import { lastHandWinner, handEndPoints } from './TableZone';

/**
 * HandEndPanel — event-derived result overlay (design CRITICAL 1, task B3-T9).
 *
 * The engine NEVER rests in `hand_end`: it auto-deals the next hand into
 * `playing` in the same applyAction. So this panel is shown from EVENT history
 * (`hand_ended` present, no later `match_ended`) — gated by the parent via the
 * `open` flag from `usePacing.handEndOpen`, which is derived from events, NOT
 * from `phase === 'hand_end'`.
 *
 * - `Continue` is a PURE UI release: it calls `onContinue` →
 *   `usePacing.advanceHandEnd()`, which just closes the panel and unpauses.
 *   It makes ZERO engine calls (there is no continue/resume action).
 * - `handEndPoints`/`lastHandWinner` are the UNCONDITIONAL helpers shared with
 *   TableZone, so the summary is consistent whether or not the next hand has
 *   already been dealt underneath.
 * - Escape/backdrop both release the overlay (harmless — pure UI).
 */

export interface HandEndPanelProps {
  open: boolean;
  history: readonly TrucoEvent[];
  mySlot: PlayerSlot;
  /** Current engine scores, shown as the "A - B" line. */
  scores: Record<PlayerSlot, number>;
  onContinue: () => void;
}

export function HandEndPanel({ open, history, mySlot, scores, onContinue }: HandEndPanelProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const winner = lastHandWinner(history);
  const points = handEndPoints(history);
  const IWon = winner === mySlot;

  return (
    <Modal
      open
      role="alertdialog"
      title={t(IWon ? 'truco.handEnd.titleWin' : 'truco.handEnd.titleLose')}
      escapeClose
      onClose={onContinue}
      variant="large"
    >
      <div data-testid="truco-hand-end-panel" className="flex flex-col items-center gap-3">
        <p
          data-testid="truco-hand-end-title"
          className={[
            'text-center text-3xl font-black uppercase tracking-wide leading-none',
            IWon
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-500 dark:text-red-400',
          ].join(' ')}
        >
          {t(IWon ? 'truco.handEnd.titleWin' : 'truco.handEnd.titleLose')}
        </p>

        {points > 0 ? (
          <p
            data-testid="truco-hand-end-points"
            className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
          >
            {t('truco.handEnd.pointsN', { n: points })}
          </p>
        ) : null}

        <p
          data-testid="truco-hand-end-score"
          className="text-2xl font-black tabular-nums text-[var(--color-foreground)]"
        >
          {t('truco.handEnd.score', { a: scores.A, b: scores.B })}
        </p>

        <button
          type="button"
          data-testid="truco-hand-end-continue"
          onClick={onContinue}
          className="min-h-[44px] w-full max-w-xs rounded-lg border border-emerald-500/60 bg-emerald-600 px-6 py-2 text-lg font-bold text-white shadow-sm transition-all hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--truco-card-ring)]"
        >
          {t('truco.handEnd.continue')}
        </button>
      </div>
    </Modal>
  );
}
