import type { CardId, TrucoAction } from '@geotano/shared';
import { ActionBar } from './ActionBar';
import { Hand } from './Hand';
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
  /** In-flight POST / pacing freeze: disables the action bar and card taps. */
  disabled?: boolean;
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
  disabled = false,
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

      {/* Orejeo hand: fanned, inspectable, clickable only when legal */}
      <div className="min-w-0 py-1" style={{ minHeight: '7.5rem' }}>
        <Hand
          myHand={myHand}
          playable={playable}
          onAction={onAction}
          isActing={disabled}
        />
      </div>

      {showActionBar ? (
        <ActionBar
          actions={actions}
          onAction={onAction}
          awaitingOpponent={awaitingOpponent}
          waitingForAnswer={waitingForAnswer}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
