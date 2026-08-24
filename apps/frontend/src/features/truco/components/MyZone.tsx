import type { CardId, TrucoAction } from '@geotano/shared';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { cardStrengthHint } from '../cardStrength';
import { ActionBar } from './ActionBar';
import { Scoreboard } from './Scoreboard';

/**
 * BOTTOM zone: my scoreboard, my hand of up to 3 playable cards and — when
 * no bet panel supersedes it — the grouped action bar. Turn presence shows
 * as an ambient glow ring; the explicit pill moved to the shared TurnBanner.
 */
export interface MyZoneProps {
  name: string;
  score: number;
  targetPoints: number;
  myHand: readonly CardId[];
  /** legalActions(view, mySlot) output — the ONLY legality source. */
  actions: readonly TrucoAction[];
  awaitingOpponent: boolean;
  /** Refined waiting copy when a bet answer is owed by the rival. */
  waitingForAnswer: boolean;
  /**
   * False while a bet awaits MY response: the ActionBar instance then lives
   * inside the BetPanel overlay, so it must not render here twice.
   */
  showActionBar: boolean;
  isTurn: boolean;
  isMano: boolean;
  onAction: (action: TrucoAction) => void;
}

export function MyZone({
  name,
  score,
  targetPoints,
  myHand,
  actions,
  awaitingOpponent,
  waitingForAnswer,
  showActionBar,
  isTurn,
  isMano,
  onAction,
}: MyZoneProps) {
  const playable = new Map(
    actions
      .filter((a): a is Extract<TrucoAction, { type: 'play_card' }> => a.type === 'play_card')
      .map((a) => [a.card, a]),
  );

  return (
    <div
      data-testid="truco-my-zone"
      className={[
        'flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-2 transition-shadow',
        isTurn
          ? 'border-emerald-400/60 bg-[var(--color-card)] truco-turn-glow'
          : 'border-[var(--color-border)] bg-[var(--color-card)]',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">{name}</p>
        <div className="flex min-w-0 items-center gap-2">
          <Scoreboard
            score={score}
            targetPoints={targetPoints}
            tone="mine"
            isMano={isMano}
          />
        </div>
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
              disabled={!action}
              strengthHint={cardStrengthHint(card)}
            />
          );
        })}
      </div>

      {showActionBar ? (
        <ActionBar
          actions={actions}
          onAction={onAction}
          awaitingOpponent={awaitingOpponent}
          waitingForAnswer={waitingForAnswer}
        />
      ) : null}
    </div>
  );
}
