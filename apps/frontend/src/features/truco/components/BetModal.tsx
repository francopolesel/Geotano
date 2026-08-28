import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrucoAction } from '@geotano/shared';
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
 *
 * EXISTING TESTIDS PRESERVED: `truco-bet-panel`, `truco-bet-title`.
 */

export interface BetModalProps {
  /** Which bet family is pending — drives the iconography. */
  family: 'truco' | 'envido';
  /** Huge call headline, already localized ("¡TRUCO!", "¡ENVIDO!"…). */
  title: string;
  /** Human explanation of what the bet means. */
  explanation: string;
  /** One-line hint about how to answer (Quiero / No quiero). */
  answerHint?: string;
  /** legalActions(view, mySlot) subset offered as the ONLY answer buttons. */
  actions: readonly TrucoAction[];
  onAction: (action: TrucoAction) => void;
  /** Disable all answer controls while an action is in flight. */
  disabled?: boolean;
}

export function BetModal({
  family,
  title,
  explanation,
  answerHint,
  actions,
  onAction,
  disabled = false,
}: BetModalProps) {
  const { t } = useTranslation();
  const Icon = family === 'truco' ? FlameIcon : CoinsIcon;

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

        <p className="text-center text-sm font-medium text-[var(--color-foreground)]">
          {explanation}
        </p>
        {answerHint ? (
          <p className="text-center text-xs text-[var(--color-muted-foreground)]">
            {answerHint}
          </p>
        ) : null}

        <div ref={actionsRef} className="mt-1 w-full">
          <RenderActions actions={actions} onAction={onAction} disabled={disabled} />
        </div>

        <span className="sr-only">{t('truco.bet.answerHint')}</span>
      </div>
    </Modal>
  );
}
