import type { EnvidoCall, PlayerSlot, TrucoCall, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/**
 * Center-zone feedback: announces every sung call, every answer, envido
 * showdowns (revealing BOTH values with the winner highlighted) and refusal
 * payouts. Feedback persists until superseded — the banner renders the
 * current betting cluster (history tail since the last non-bet event).
 * 
 * Enhanced: larger text, colored backgrounds, longer duration (3.5s).
 */
export interface CallFeedbackBannerProps {
  history: readonly TrucoEvent[];
  names: Record<PlayerSlot, string>;
}

const CALL_KEYS: Record<EnvidoCall | TrucoCall, string> = {
  sing_envido: 'truco.call.envido',
  sing_real_envido: 'truco.call.realEnvido',
  sing_falta_envido: 'truco.call.faltaEnvido',
  sing_truco: 'truco.call.truco',
  sing_retruco: 'truco.call.retruco',
  sing_vale_cuatro: 'truco.call.valeCuatro',
};

const ANSWER_KEYS = {
  quiero: 'truco.answer.quiero',
  no_quiero: 'truco.answer.noQuiero',
  fold: 'truco.response.fold',
} as const;

/** Events that close a betting cluster. */
const CLUSTER_BREAKS: readonly TrucoEvent['type'][] = [
  'card_played',
  'baza_resolved',
  'hand_ended',
  'match_ended',
];

/** History tail holding the current (or most recent) bet conversation. */
function currentCluster(history: readonly TrucoEvent[]): TrucoEvent[] {
  let start = history.length;
  while (start > 0) {
    const next = start - 1;
    if (CLUSTER_BREAKS.includes(history[next]!.type)) break;
    start = next;
  }
  return history.slice(start);
}

function getCallColor(call: EnvidoCall | TrucoCall): string {
  if (call === 'sing_truco' || call === 'sing_retruco' || call === 'sing_vale_cuatro') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200';
  }
  return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200';
}

function getAnswerColor(answer: 'quiero' | 'no_quiero' | 'fold'): string {
  if (answer === 'quiero') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200';
  return 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200';
}

export function CallFeedbackBanner({ history, names }: CallFeedbackBannerProps) {
  const { t } = useTranslation();
  const cluster = currentCluster(history);
  if (cluster.length === 0) return null;

  return (
    <div
      data-testid="truco-call-banner"
      className="mx-auto flex w-full max-w-md min-w-0 flex-col items-center gap-1.5 px-2 py-1"
    >
      {cluster.map((event, index) => {
        switch (event.type) {
          case 'call_sung':
            return (
              <span
                key={index}
                data-testid={`banner-call-${event.call}`}
                className={`w-full text-center px-4 py-2.5 rounded-lg font-bold text-xl uppercase tracking-wide shadow-md animate-fade-in ${getCallColor(event.call)}`}
              >
                {names[event.actor]}: {t(CALL_KEYS[event.call])}
              </span>
            );
          case 'answered':
            return (
              <span
                key={index}
                data-testid={`banner-answer-${event.answer}`}
                className={`w-full text-center px-4 py-2.5 rounded-lg font-bold text-xl shadow-md animate-fade-in ${getAnswerColor(event.answer)}`}
              >
                {names[event.player]}: {t(ANSWER_KEYS[event.answer])}
              </span>
            );
          case 'envido_showdown':
            return (
              <span
                key={index}
                data-testid="banner-showdown"
                className="w-full text-center px-4 py-2 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-base tabular-nums shadow-md animate-fade-in"
              >
                {names.A}: {event.values.A} — {names.B}: {event.values.B}
                {' · '}
                <span data-testid="showdown-winner" className="font-bold underline">
                  {names[event.winner]}
                </span>
              </span>
            );
          case 'points_awarded':
            return (
              <span
                key={index}
                data-testid="banner-points"
                className="w-full text-center px-4 py-2 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 font-bold text-lg tabular-nums shadow-md animate-fade-in"
              >
                +{event.amount} {t('truco.banner.pointsTo', { player: names[event.side] })}
              </span>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
