import type { ReactNode } from 'react';
import type { TrucoAction } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { CheckIcon, CoinsIcon, CrossIcon, FlameIcon, SpinnerIcon } from './icons';

/**
 * Shared answer/bet button renderer (design SUGGESTION 1).
 *
 * Used by BetModal (and any modal surface) so every surface shares ONE button
 * implementation. Hard contract:
 *  - every button keeps the `truco-action-<type>` testid (ActionBar.test.tsx /
 *    table.test.tsx assert on these);
 *  - the primary accept (`quiero`) is auto-focused on mount (BetPanel.tsx:33
 *    pattern) so keyboard players answer with a single Enter;
 *  - every control keeps a ≥44px min tap target;
 *  - `disabled` (isActing / paused) disables all controls without firing.
 */

export interface RenderActionsOptions {
  /** legalActions(view, mySlot) subset offered as buttons (play_card filtered). */
  actions: readonly TrucoAction[];
  onAction: (action: TrucoAction) => void;
  /** Disable all action buttons (in-flight POST / pacing freeze). Default false. */
  disabled?: boolean;
  /** Renders a waiting indicator instead of controls. */
  awaitingOpponent?: boolean;
  /** Refined waiting copy: bet answer owed by the rival (vs generic turn wait). */
  waitingForAnswer?: boolean;
  /** Button size variant: 'normal' (44px) for ActionBar, 'large' (52px) for BetModal. */
  size?: 'normal' | 'large';
}

export const ACTION_DISPLAY_ORDER: readonly TrucoAction['type'][] = [
  'quiero',
  'no_quiero',
  'fold',
  'sing_envido',
  'sing_real_envido',
  'sing_falta_envido',
  'sing_truco',
  'sing_retruco',
  'sing_vale_cuatro',
];

const LABEL_KEYS: Partial<Record<TrucoAction['type'], string>> = {
  sing_envido: 'truco.call.envido',
  sing_real_envido: 'truco.call.realEnvido',
  sing_falta_envido: 'truco.call.faltaEnvido',
  sing_truco: 'truco.call.truco',
  sing_retruco: 'truco.call.retruco',
  sing_vale_cuatro: 'truco.call.valeCuatro',
  quiero: 'truco.answer.quiero',
  no_quiero: 'truco.answer.noQuiero',
  fold: 'truco.action.fold',
};

export function actionIcon(type: TrucoAction['type'], className: string): ReactNode {
  switch (type) {
    case 'quiero':
      return <CheckIcon className={className} />;
    case 'no_quiero':
      return <CrossIcon className={className} />;
    case 'fold':
      return <CrossIcon className={className} />;
    case 'sing_envido':
    case 'sing_real_envido':
    case 'sing_falta_envido':
      return <CoinsIcon className={className} />;
    default:
      return <FlameIcon className={className} />;
  }
}

export function actionButtonClass(type: TrucoAction['type']): string {
  switch (type) {
    case 'quiero':
      return 'border-transparent bg-emerald-600 text-white shadow-sm hover:brightness-110';
    case 'no_quiero':
    case 'fold':
      return 'border-2 border-red-500/80 bg-transparent text-red-600 dark:text-red-400 hover:bg-red-500/10';
    case 'sing_truco':
    case 'sing_retruco':
    case 'sing_vale_cuatro':
      return 'border border-amber-400/70 bg-amber-100 text-amber-900 hover:border-amber-500 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:border-amber-400';
    default:
      // Envido family: gold/yellow tones.
      return 'border border-yellow-500/60 bg-yellow-100 text-yellow-900 hover:border-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-200 dark:hover:border-yellow-500';
  }
}

/** Order-stable, play_card-excluded, label-existence-filtered actions. */
export function actionBarList(actions: readonly TrucoAction[]): TrucoAction[] {
  return actions
    .filter((a) => a.type !== 'play_card' && LABEL_KEYS[a.type])
    .slice()
    .sort((a, b) => ACTION_DISPLAY_ORDER.indexOf(a.type) - ACTION_DISPLAY_ORDER.indexOf(b.type));
}

export function RenderActions({
  actions,
  onAction,
  disabled = false,
  awaitingOpponent = false,
  waitingForAnswer = false,
  size = 'normal',
}: RenderActionsOptions) {
  const { t } = useTranslation();

  const list = actionBarList(actions);

  if (list.length === 0 && awaitingOpponent) {
    return (
      <div
        data-testid="truco-actionbar-waiting"
        className="flex items-center gap-2 rounded-full bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted-foreground)]"
      >
        <SpinnerIcon />
        {t(waitingForAnswer ? 'truco.bet.waitingRival' : 'truco.turn.waiting')}
      </div>
    );
  }

  const buttonClasses = size === 'large'
    ? 'flex min-h-[52px] min-w-0 items-center justify-center gap-3 rounded-lg px-6 py-3 text-lg font-semibold'
    : 'flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold';

  const iconSize = size === 'large' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <div className="flex w-full flex-wrap items-stretch justify-center gap-3">
      {list.map((action) => (
        <button
          key={action.type}
          type="button"
          data-testid={`truco-action-${action.type}`}
          disabled={disabled}
          onClick={() => onAction(action)}
          className={[
            buttonClasses,
            'transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--truco-card-ring)]',
            disabled ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5',
            actionButtonClass(action.type),
          ].join(' ')}
        >
          {actionIcon(action.type, `${iconSize} shrink-0`)}
          {t(LABEL_KEYS[action.type]!)}
        </button>
      ))}
    </div>
  );
}
