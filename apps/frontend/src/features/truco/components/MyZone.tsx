import type { CardId, TrucoAction } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { ActionBar } from './ActionBar';

/** BOTTOM zone: my score, my hand of up to 3 playable cards, the action bar. */
export interface MyZoneProps {
  name: string;
  score: number;
  targetPoints: number;
  myHand: readonly CardId[];
  /** legalActions(view, mySlot) output — the ONLY legality source. */
  actions: readonly TrucoAction[];
  awaitingOpponent: boolean;
  onAction: (action: TrucoAction) => void;
}

export function MyZone({
  name,
  score,
  targetPoints,
  myHand,
  actions,
  awaitingOpponent,
  onAction,
}: MyZoneProps) {
  const { t } = useTranslation();
  const playable = new Map(
    actions
      .filter((a): a is Extract<TrucoAction, { type: 'play_card' }> => a.type === 'play_card')
      .map((a) => [a.card, a]),
  );

  return (
    <div
      data-testid="truco-my-zone"
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">{name}</p>
        <p data-testid="my-score" className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
          {score} / {targetPoints}
        </p>
        <span
          data-testid="my-turn-indicator"
          className={[
            'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity',
            playable.size > 0 || actions.some((a) => a.type !== 'play_card')
              ? 'bg-emerald-600 text-white'
              : 'invisible',
          ].join(' ')}
        >
          {t('truco.turn.you')}
        </span>
      </div>

      {/* Hand: clickable only when playing that card is legal (turn included) */}
      <div className="flex min-w-0 flex-wrap items-end justify-center gap-2" style={{ minHeight: '5rem' }}>
        {myHand.map((card) => {
          const action = playable.get(card);
          return (
            <PlayingCard
              key={card}
              card={card}
              size="md"
              onClick={action ? () => onAction(action) : undefined}
            />
          );
        })}
      </div>

      <ActionBar actions={actions} onAction={onAction} awaitingOpponent={awaitingOpponent} />
    </div>
  );
}
