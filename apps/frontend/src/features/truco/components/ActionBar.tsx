import type { TrucoAction } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import {
  CheckIcon,
  CoinsIcon,
  CrossIcon,
  FlameIcon,
  SpinnerIcon,
} from './icons';

/**
 * Contextual action bar. Renders EXCLUSIVELY from the engine's
 * `legalActions(publicCtx, mySlot)` output passed by the parent — the UI
 * implements zero rules logic: an illegal action simply never appears here.
 *
 * Redesign (batch 2): buttons are grouped under small uppercase captions
 * ("Game" / "Truco" / "Envido"), each carrying an icon and a short human
 * hint; answers stay strongly color-coded (green accept / red-outline
 * decline) and bet calls carry their family color (amber = truco,
 * gold = envido).
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
  /**
   * Refined waiting variant: a bet is pending on the RIVAL's side — the copy
   * names the answer wait instead of the generic turn wait.
   */
  waitingForAnswer?: boolean;
  /**
   * Mobile/bet-panel layout: groups stack vertically and buttons go
   * full-width (min 44px tall) so answers sit near the thumb zone.
   */
  stacked?: boolean;
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

/** Grouped presentation: caption key + member action types in display order. */
const GROUPS: readonly { key: string; types: readonly TrucoAction['type'][] }[] = [
  { key: 'truco.group.game', types: ['quiero', 'no_quiero'] },
  { key: 'truco.group.truco', types: ['sing_truco', 'sing_retruco', 'sing_vale_cuatro'] },
  { key: 'truco.group.envido', types: ['sing_envido', 'sing_real_envido', 'sing_falta_envido'] },
];

function ActionIcon({ type }: { type: TrucoAction['type'] }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'quiero':
      return <CheckIcon className={cls} />;
    case 'no_quiero':
      return <CrossIcon className={cls} />;
    case 'sing_envido':
    case 'sing_real_envido':
    case 'sing_falta_envido':
      return <CoinsIcon className={cls} />;
    default:
      // Truco raise family + anything future gets the flame.
      return <FlameIcon className={cls} />;
  }
}

/** Per-family color coding: green accept, red-outline decline, amber truco, gold envido. */
function buttonClass(type: TrucoAction['type']): string {
  switch (type) {
    case 'quiero':
      return 'border-transparent bg-emerald-600 text-white shadow-sm hover:brightness-110';
    case 'no_quiero':
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

export function ActionBar({
  actions,
  onAction,
  awaitingOpponent = false,
  waitingForAnswer = false,
  stacked = false,
}: ActionBarProps) {
  const { t } = useTranslation();

  const barActions = actions
    .filter((a) => a.type !== 'play_card' && LABEL_KEYS[a.type])
    .slice()
    .sort((a, b) => DISPLAY_ORDER.indexOf(a.type) - DISPLAY_ORDER.indexOf(b.type));

  if (barActions.length === 0 && awaitingOpponent) {
    return (
      <div data-testid="truco-action-bar" className="flex min-w-0 flex-wrap items-center justify-center gap-2">
        <span
          data-testid="truco-actionbar-waiting"
          className="flex items-center gap-2 rounded-full bg-[var(--color-muted)] px-4 py-2 text-xs font-medium text-[var(--color-muted-foreground)] transition-opacity"
        >
          <SpinnerIcon />
          {t(waitingForAnswer ? 'truco.bet.waitingRival' : 'truco.turn.waiting')}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="truco-action-bar"
      className={[
        'flex min-w-0 items-start justify-center gap-x-4 gap-y-2',
        stacked ? 'flex-col' : 'flex-wrap',
      ].join(' ')}
    >
      {GROUPS.map((group) => {
        const groupActions = barActions.filter((a) => group.types.includes(a.type));
        if (groupActions.length === 0) return null;
        return (
          <div
            key={group.key}
            className={[
              'flex min-w-0 flex-col items-center gap-1',
              stacked ? 'w-full' : '',
            ].join(' ')}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)]">
              {t(group.key)}
            </span>
            <div
              className={[
                'min-w-0 items-stretch justify-center gap-1.5',
                stacked ? 'flex w-full flex-col' : 'flex flex-wrap',
              ].join(' ')}
            >
              {groupActions.map((action) => (
                <button
                  key={action.type}
                  type="button"
                  data-testid={`truco-action-${action.type}`}
                  onClick={() => onAction(action)}
                  title={t(`truco.hint.${action.type}`)}
                  className={[
                    'flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-3 py-1.5',
                    'text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--truco-card-ring)] hover:-translate-y-0.5',
                    stacked
                      ? 'w-full flex-row gap-1.5'
                      : 'shrink flex-col items-center gap-0.5',
                    buttonClass(action.type),
                  ].join(' ')}
                >
                  <span className="flex items-center gap-1.5">
                    <ActionIcon type={action.type} />
                    {t(LABEL_KEYS[action.type]!)}
                  </span>
                  {!stacked && (
                    <span className="max-w-[11rem] truncate text-[10px] font-normal opacity-75">
                      {t(`truco.hint.${action.type}`)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
