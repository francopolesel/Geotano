import { useTranslation } from 'react-i18next';
import { CARD_BACK_URL } from '../cardAssets';

/**
 * Visual deck stack: face-down cards with a subtle 3D stack effect.
 * Shows remaining count badge. Hover shows tooltip with remaining count.
 */
export interface DeckVisualProps {
  /** Number of cards left in the deck. */
  deckRemaining: number;
  /** Size variant matching PlayingCard clamp tokens. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'w-[clamp(3.5rem,14vw,7rem)]',
  md: 'w-[clamp(4.5rem,18vw,8.5rem)]',
  lg: 'w-[clamp(5.5rem,22vw,10rem)]',
} as const;

/** Intrinsic aspect ratio of the official assets (viewBox `66.24 × 102.08`). */
const ASSET_ASPECT_RATIO = `${66.24} / ${102.08}`;

export function DeckVisual({ deckRemaining, size = 'md' }: DeckVisualProps) {
  const { t } = useTranslation();

  if (deckRemaining <= 0) return null;

  // Stack offsets for 3-4 visible cards
  const stackLayers = Math.min(deckRemaining, 4);
  const layerStyles = Array.from({ length: stackLayers }, (_, i) => ({
    transform: `translate(${i * -2}px, ${i * -2}px) rotate(${(i - 1) * 1.5}deg)`,
    boxShadow: `0 ${4 + i * 2}px ${8 + i * 2}px rgb(0 0 0 / ${0.25 + i * 0.05})`,
    zIndex: stackLayers - i,
  }));

  return (
    <div
      data-testid="truco-deck"
      role="img"
      aria-label={t('truco.deck.alt')}
      title={t('truco.deck.remaining', { count: deckRemaining })}
      className={[
        'relative flex items-center justify-center',
        SIZE_CLASSES[size],
      ].join(' ')}
      style={{ aspectRatio: ASSET_ASPECT_RATIO }}
    >
      {/* Stack of face-down cards */}
      <div className="relative" style={{ aspectRatio: ASSET_ASPECT_RATIO }}>
        {layerStyles.map((style, i) => (
          <img
            key={i}
            src={CARD_BACK_URL}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full rounded-md object-cover border border-[var(--truco-card-border)] bg-[var(--truco-card-face)]"
            style={style}
          />
        ))}
      </div>

      {/* Remaining count badge */}
      <span
        data-testid="truco-deck-count"
        className="absolute -bottom-2 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[10px] font-bold text-white shadow-lg border-2 border-[var(--color-background)]"
        aria-label={t('truco.deck.remaining', { count: deckRemaining })}
      >
        {deckRemaining > 99 ? '99+' : deckRemaining}
      </span>
    </div>
  );
}