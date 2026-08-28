import { memo } from 'react';
import type { CardId, Suit } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { CARD_BACK_URL, cardAssetUrl } from '../../features/truco/cardAssets';

/** Subtle hand-strength indicator (MY cards only, derived from engine tiers). */
export type StrengthHint = 'strong' | 'medium' | 'weak';

/**
 * Spanish-deck card primitive shared by BOTH truco modes.
 * Presentation shell only: sizing, framing, shadow, hover/selected/disabled
 * states and motion live here; ALL artwork is the official asset set
 * (WebP derivatives of the source SVGs) resolved through
 * features/truco/cardAssets (single source of truth).
 * W2 responsive rule: fixed/clamp arbitrary widths only.
 */
export interface PlayingCardProps {
  /** Card id in `{rank}{suit}` form, e.g. `7espada`. Omit when faceDown. */
  card?: CardId;
  /** Uniform back variant (rival hand / deck). */
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** When provided (and not disabled) the card becomes an interactive button. */
  onClick?: (card: CardId) => void;
  /** Not-playable treatment: dimmed + grayscale + not-allowed cursor. */
  disabled?: boolean;
  /** Tiny strength pip for MY hand cards only; rivals/table never get it. */
  strengthHint?: StrengthHint;
  /** Raised selection treatment: lifted + accent ring/glow. */
  selected?: boolean;
}

const CARD_ID_PATTERN = /^(\d+)(oro|copa|espada|basto)$/;

function splitCardId(card: CardId): { rank: string; suit: Suit } {
  const match = CARD_ID_PATTERN.exec(card);
  if (!match) throw new Error(`Malformed card id: ${card}`);
  return { rank: match[1]!, suit: match[2] as Suit };
}

/** Fixed/clamp width tokens per variant (W2 proxy contract). */
const SIZE_CLASSES = {
  sm: 'w-[clamp(2.75rem,10vw,4rem)]',
  md: 'w-[clamp(3.5rem,13vw,5.5rem)]',
  lg: 'w-[clamp(4.25rem,16vw,6.5rem)]',
} as const;

/**
 * Intrinsic aspect ratio of the official assets (viewBox `66.24 × 102.08`).
 * Declared on the frame so the <img> can never cause layout shift.
 */
const ASSET_ASPECT_RATIO = `${66.24} / ${102.08}`;

// Memoized: the baza-lane strip keeps many static mini cards mounted while
// the table re-renders on every engine tick; primitive-only props make the
// shallow compare effective there. Context (i18n) updates bypass memo.
export const PlayingCard = memo(function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  onClick,
  disabled = false,
  strengthHint,
  selected = false,
}: PlayingCardProps) {
  const { t } = useTranslation();

  if (!faceDown && !card) {
    throw new Error('PlayingCard requires either `card` or `faceDown`');
  }

  const interactive = !!onClick && !faceDown && !!card && !disabled;
  const testId = faceDown || !card ? 'playing-card-back' : `playing-card-${card}`;
  let label: string;
  if (faceDown || !card) {
    label = t('truco.card.back');
  } else {
    const { rank, suit } = splitCardId(card);
    label = t('truco.card.alt', { rank, suit: t(`truco.suit.${suit}`) });
  }

  const Interactive = interactive ? 'button' : 'div';

  return (
    <Interactive
      {...(interactive ? { type: 'button' as const } : {})}
      {...(interactive ? { onClick: () => onClick!(card!) } : {})}
      {...(!interactive && disabled ? { 'aria-disabled': true as const } : {})}
      data-testid={testId}
      role="img"
      aria-label={label}
      className={[
        SIZE_CLASSES[size],
        'relative min-w-0 shrink-0 select-none overflow-hidden rounded-md border shadow-[var(--truco-card-shadow)] transition-all duration-200 ease-out',
        'border-[var(--truco-card-border)]',
        interactive
          ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--truco-card-ring)]'
          : '',
        selected ? '-translate-y-3.5 shadow-lg ring-2 ring-[var(--truco-card-ring)]' : '',
        disabled && !selected ? 'opacity-45 grayscale-[60%] cursor-not-allowed' : '',
      ].join(' ')}
      style={{ aspectRatio: ASSET_ASPECT_RATIO, backgroundColor: 'var(--truco-card-face)' }}
    >
      {faceDown || !card ? (
        /* Official printed back artwork (decorative: root carries the label). */
        <img
          src={CARD_BACK_URL}
          alt=""
          draggable={false}
          data-testid="playing-card-back-art"
          className="h-full w-full rounded-[inherit] object-cover"
        />
      ) : (
        <>
          {/* Official face artwork fills the frame (decorative: root carries
              the localized label via role="img" + aria-label). */}
          <img
            src={cardAssetUrl(card!)}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
          {strengthHint ? (
            <span
              data-testid="playing-card-strength-hint"
              title={t(`truco.card.strength.${strengthHint}`)}
              className="absolute bottom-[2%] left-1/2 z-[1] h-[3px] w-[46%] -translate-x-1/2 rounded-full"
              style={{ backgroundColor: `var(--truco-hint-${strengthHint})` }}
            />
          ) : null}
        </>
      )}
    </Interactive>
  );
});
