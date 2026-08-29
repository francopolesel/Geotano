import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrucoAction } from '@geotano/shared';
import type { PlayerSlot } from '@geotano/shared';
import { Modal } from '../../../components/game/Modal';
import { RenderActions } from './renderActions';
import { CoinsIcon, FlameIcon } from './icons';

/**
 * BetModal — the elevated overlay shown when a sung bet awaits MY response
 * (design E1/E3, task B3-T7). Replaces the inline BetPanel.
 *
 * - Backed by the shared Modal primitive: `role=alertdialog`, `max-w-lg`
 *   (`variant='large'`) so the big answer buttons stay ≥44px tap targets.
 * - `escapeClose=false`: Escape is INERT here (E3-E) — pressing Escape can
 *   never produce an illegal implicit quiero/no_quiero.
 * - Buttons come EXCLUSIVELY from `legalActions` via the shared
 *   `RenderActions`, preserving the `truco-action-*` testids and the
 *   autofocus-on-quiero contract (BetPanel.tsx:33 pattern).
 * - `disabled` while `isActing`/paused so double-taps and mid-POST repeats
 *   can't fire twice (G1).
 * - Renders compact match score context above the bet title.
 *
 * EXISTING TESTIDS PRESERVED: `truco-bet-panel`, `truco-bet-title`.
 */

export interface BetModalProps {
  /** Which bet family is pending — drives the iconography. */
  family: 'truco' | 'envido';
  /** Huge call headline, already localized ("¡TRUCO!", "¡ENVIDO!"…). */
  title: string;
  /** Human explanation of what the bet means (kept for compat, no longer rendered). */
  explanation: string;
  /** One-line hint about how to answer (Quiero / No quiero). */
  answerHint?: string;
  /** legalActions(view, mySlot) subset offered as the ONLY answer buttons. */
  actions: readonly TrucoAction[];
  onAction: (action: TrucoAction) => void;
  /** Disable all answer controls while an action is in flight. */
  disabled?: boolean;
  /** Current engine scores for compact match context display. */
  scores: Record<PlayerSlot, number>;
  /** Match target points (for reference). */
  targetPoints: number;
  /** My player slot. */
  mySlot: PlayerSlot;
  /** Opponent display name. */
  opponentName: string;
}

export function BetModal({
  family,
  title,
  explanation, // kept for compat, no longer rendered per T6
  answerHint,
  actions,
  onAction,
  disabled = false,
  scores,
  targetPoints,
  mySlot,
  opponentName,
}: BetModalProps) {
  const { t } = useTranslation();
  const Icon = family === 'truco' ? FlameIcon : CoinsIcon;

  // Compute my score and rival score for display
  const myScore = scores[mySlot];
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  const rivalScore = scores[rivalSlot];

  // Autofocus the primary accept (Quiero) on open (BetPanel.tsx:33 contract).
  const actionsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    actionsRef.current
      ?.querySelector<HTMLButtonElement>('[data-testid="truco-action-quiero"]')
      ?.focus();
  }, []);

  return (
    <Modal open role="alertdialog" title={title} escapeClose={false} variant="large">
      <div
        data-testid="truco-bet-panel"
        className="flex flex-col items-center gap-2"
      >
        {/* Compact match score context — secondary, muted */}
        <div className="w-full px-2 py-1 text-center">
          <div className="flex justify-center gap-4 text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
            <span>{t('truco.you')}: {myScore}</span>
            <span>{opponentName}: {rivalScore}</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.score.goal', { target: targetPoints })}
          </div>
        </div>

        <span
          aria-hidden
          className={[
            'flex h-12 w-12 items-center justify-center rounded-full',
            family === 'truco'
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
          ].join(' ')}
        >
          <Icon className="h-7 w-7" />
        </span>

        <p
          data-testid="truco-bet-title"
          className={[
            'text-center text-3xl font-black uppercase tracking-wide leading-none',
            family === 'truco'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-yellow-700 dark:text-yellow-400',
          ].join(' ')}
        >
          {title}
        </p>

        {answerHint ? (
          <p className="text-center text-xs text-[var(--color-muted-foreground)]">
            {answerHint}
          </p>
        ) : null}

        <div ref={actionsRef} className="mt-1 w-full">
          <RenderActions actions={actions} onAction={onAction} disabled={disabled} size="large" />
        </div>

        <span className="sr-only">{t('truco.bet.answerHint')}</span>
      </div>
    </Modal>
  );
}
