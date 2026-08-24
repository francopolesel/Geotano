import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CoinsIcon, FlameIcon } from './icons';

/**
 * Elevated overlay panel shown when a bet awaits MY response: the sung call
 * rendered huge over the felt with a human explanation and — via `children`
 * — the very same ActionBar instance (same test ids), so answer controls are
 * never duplicated elsewhere while the bet is pending.
 */
export interface BetPanelProps {
  /** Which bet family is pending — drives the iconography. */
  family: 'truco' | 'envido';
  /** Huge call headline, already localized ("¡TRUCO!", "¡ENVIDO!"…). */
  title: string;
  /** Human explanation of what the bet means. */
  explanation: string;
  /** One-line hint about how to answer (Quiero / No quiero). */
  answerHint?: string;
  /** Action bar content rendered INSIDE the panel. */
  children: ReactNode;
}

export function BetPanel({ family, title, explanation, answerHint, children }: BetPanelProps) {
  const { t } = useTranslation();
  const Icon = family === 'truco' ? FlameIcon : CoinsIcon;

  // Focus management for the alertdialog: the primary accept (Quiero) gets
  // focus on mount so keyboard players can answer with a single Enter.
  const actionsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    actionsRef.current
      ?.querySelector<HTMLButtonElement>('[data-testid="truco-action-quiero"]')
      ?.focus();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-2">
      <div
        data-testid="truco-bet-panel"
        role="alertdialog"
        aria-label={title}
        className={[
          'animate-truco-bet-in pointer-events-auto flex w-full max-w-sm min-w-0 flex-col items-center gap-2',
          'rounded-2xl border-2 px-4 py-4 shadow-xl backdrop-blur-sm',
          family === 'truco'
            ? 'border-amber-400/80 bg-[var(--color-card)]/95'
            : 'border-yellow-500/70 bg-[var(--color-card)]/95',
        ].join(' ')}
      >
        <span
          aria-hidden
          className={[
            'flex h-11 w-11 items-center justify-center rounded-full',
            family === 'truco'
              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
          ].join(' ')}
        >
          <Icon className="h-6 w-6" />
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
          <p className="text-center text-xs text-[var(--color-muted-foreground)]">{answerHint}</p>
        ) : null}

        {/* Same ActionBar instance/test ids — answers live ONLY here while
            this panel is up. */}
        <div ref={actionsRef} className="mt-1 w-full">{children}</div>

        <span className="sr-only">{t('truco.bet.answerHint')}</span>
      </div>
    </div>
  );
}
