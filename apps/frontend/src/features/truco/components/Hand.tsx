import { useState } from 'react';
import type { CardId, TrucoAction } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { cardStrengthHint } from '../cardStrength';

/**
 * Orejeo hand: up to 3 cards held in a gentle fan like a physical hand.
 * Hovering (or keyboard-focusing) a playable card lifts it toward the player
 * — "lo traje hacia mí para verla mejor". Disabled cards stay in the fan,
 * dimmed, and never lift. On touch there is no hover: taps play/select
 * directly through PlayingCard's own interaction.
 */
export interface HandProps {
  myHand: readonly CardId[];
  /** Legal play_card actions keyed by card — the ONLY legality source. */
  playable: ReadonlyMap<CardId, Extract<TrucoAction, { type: 'play_card' }>>;
  onAction: (action: TrucoAction) => void;
  /** Optional externally-controlled selection highlight. */
  selected?: CardId | null;
  /**
   * In-flight action lock (multiplayer POST pending): cards stop lifting and
   * become non-interactive while remaining visible. Defaults to false.
   */
  isActing?: boolean;
}

/** Degrees of rotation per card away from the fan's center. */
const FAN_STEP_DEG = 6;
/** Vertical drop in px per card away from the center (outer cards sit lower). */
const FAN_DROP_PX = 4;

export function Hand({ myHand, playable, onAction, selected = null, isActing = false }: HandProps) {
  const { t } = useTranslation();
  const [inspected, setInspected] = useState<CardId | null>(null);
  const middle = (myHand.length - 1) / 2;

  return (
    <div
      data-testid="truco-hand"
      aria-label={t('truco.hand.label')}
      className="truco-fan flex min-w-0 items-end justify-center min-h-[clamp(6rem,18vh,9.5rem)]"
      onPointerLeave={() => setInspected(null)}
    >
      {myHand.map((card, index) => {
        const action = playable.get(card);
        const offset = index - middle;
        const restTransform = `rotate(${(offset * FAN_STEP_DEG).toFixed(2)}deg) translateY(${Math.abs(offset) * FAN_DROP_PX}px)`;
        // Only playable cards answer the orejeo lift; the action lock
        // (in-flight POST) freezes every card in the fan.
        const lifted = inspected === card && !!action && !isActing;

        return (
          <div
            key={card}
            data-testid={`truco-fan-slot-${card}`}
            className={[
              'truco-fan-slot shrink-0 transition-transform duration-200 ease-out',
              lifted ? 'truco-fan-slot--lift' : '',
            ].join(' ')}
            style={{
              transform: lifted ? 'translateY(-13px) scale(1.06)' : restTransform,
              zIndex: lifted ? 30 : undefined,
            }}
            onPointerEnter={() => setInspected(card)}
            onPointerLeave={() => setInspected((cur) => (cur === card ? null : cur))}
            onFocus={() => setInspected(card)}
            onBlur={() => setInspected((cur) => (cur === card ? null : cur))}
          >
            <PlayingCard
              card={card}
              size="md"
              onClick={action ? () => onAction(action) : undefined}
              disabled={!action || isActing}
              selected={selected === card}
              strengthHint={cardStrengthHint(card)}
            />
          </div>
        );
      })}
    </div>
  );
}
