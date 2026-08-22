import type { TrucoAction } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/**
 * Contextual action bar. Renders EXCLUSIVELY from the engine's
 * `legalActions(publicCtx, mySlot)` output passed by the parent — the UI
 * implements zero rules logic: an illegal action simply never appears here.
 */
export interface ActionBarProps {
  /** Output of legalActions for the viewing player (play_card excluded). */
  actions: readonly TrucoAction[];
  onAction: (action: TrucoAction) => void;
  /**
   * Presentation hint derived from the public view: a bet or the turn is
   * currently the opponent's. Shows a waiting indicator instead of controls.
   */
  awaitingOpponent?: boolean;
}

/** Stable display order regardless of enumeration order. */
const DISPLAY_ORDER: readonly TrucoAction['type'][] = [
  'quiero',
  'no_quiero',
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
};

/** Answer buttons get emphasis; call buttons stay secondary. */
const ANSWER_TYPES: readonly string[] = ['quiero', 'no_quiero'];

export function ActionBar({ actions, onAction, awaitingOpponent = false }: ActionBarProps) {
  const { t } = useTranslation();

  const barActions = actions
    .filter((a) => a.type !== 'play_card' && LABEL_KEYS[a.type])
    .slice()
    .sort((a, b) => DISPLAY_ORDER.indexOf(a.type) - DISPLAY_ORDER.indexOf(b.type));

  return (
    <div
      data-testid="truco-action-bar"
      className="flex min-w-0 flex-wrap items-center justify-center gap-2"
    >
      {barActions.length === 0 && awaitingOpponent ? (
        <span
          data-testid="truco-actionbar-waiting"
          className="animate-pulse rounded-full bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted-foreground)] transition-opacity"
        >
          {t('truco.turn.waiting')}
        </span>
      ) : (
        barActions.map((action) => {
          const isAnswer = ANSWER_TYPES.includes(action.type);
          return (
            <button
              key={action.type}
              type="button"
              data-testid={`truco-action-${action.type}`}
              onClick={() => onAction(action)}
              className={[
                'min-h-[44px] min-w-0 shrink rounded-lg border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5',
                isAnswer
                  ? 'border-transparent bg-[var(--color-primary)] text-white shadow-sm hover:brightness-110'
                  : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]',
              ].join(' ')}
            >
              {t(LABEL_KEYS[action.type]!)}
            </button>
          );
        })
      )}
    </div>
  );
}
