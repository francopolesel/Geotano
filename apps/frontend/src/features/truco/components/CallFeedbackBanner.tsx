import type { EnvidoCall, PlayerSlot, TrucoCall, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/**
 * Center-zone feedback: announces every sung call, every answer, envido
 * showdowns (revealing BOTH values with the winner highlighted) and refusal
 * payouts. Feedback persists until superseded — the banner renders the
 * current betting cluster (history tail since the last non-bet event).
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

export function CallFeedbackBanner({ history, names }: CallFeedbackBannerProps) {
  const { t } = useTranslation();
  const cluster = currentCluster(history);
  if (cluster.length === 0) return null;

  return (
    <div
      data-testid="truco-call-banner"
      className="mx-auto flex w-full max-w-md min-w-0 flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs shadow-sm transition-all"
    >
      {cluster.map((event, index) => {
        switch (event.type) {
          case 'call_sung':
            return (
              <span key={index} data-testid={`banner-call-${event.call}`} className="font-semibold">
                {names[event.actor]}:{' '}
                <span className="uppercase tracking-wide">{t(CALL_KEYS[event.call])}</span>
              </span>
            );
          case 'answered':
            return (
              <span key={index} data-testid={`banner-answer-${event.answer}`} className="font-semibold">
                {names[event.player]}:{' '}
                <span className={event.answer === 'quiero' ? 'text-emerald-600' : 'text-red-600'}>
                  {t(ANSWER_KEYS[event.answer])}
                </span>
              </span>
            );
          case 'envido_showdown':
            return (
              <span key={index} data-testid="banner-showdown" className="tabular-nums">
                {names.A}: {event.values.A} — {names.B}: {event.values.B}
                {' · '}
                <span data-testid="showdown-winner" className="font-bold underline">
                  {names[event.winner]}
                </span>
              </span>
            );
          case 'points_awarded':
            return (
              <span key={index} data-testid="banner-points" className="font-bold tabular-nums">
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
