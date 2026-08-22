import type { CardId, Suit } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/**
 * Generic Spanish-deck card primitive shared by BOTH truco modes (D11).
 * Pure CSS/SVG rendering — zero network assets, deterministic snapshots.
 * W2 responsive rule: fixed/clamp arbitrary widths only, never viewport-%,
 */
export interface PlayingCardProps {
  /** Card id in `{rank}{suit}` form, e.g. `7espada`. Omit when faceDown. */
  card?: CardId;
  /** Uniform back variant (rival hand / deck). */
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** When provided the card becomes an interactive button emitting the id. */
  onClick?: (card: CardId) => void;
}

const CARD_ID_PATTERN = /^(\d+)(oro|copa|espada|basto)$/;

function splitCardId(card: CardId): { rank: string; suit: Suit } {
  const match = CARD_ID_PATTERN.exec(card);
  if (!match) throw new Error(`Malformed card id: ${card}`);
  return { rank: match[1]!, suit: match[2] as Suit };
}

/** Fixed/clamp sizing tokens per variant (W2 proxy contract). */
const SIZE_CLASSES = {
  sm: 'w-[clamp(2.75rem,9vw,3.25rem)] text-[0.55rem]',
  md: 'w-[clamp(3rem,11vw,4.25rem)] text-[0.7rem]',
  lg: 'w-[clamp(3.5rem,13vw,5rem)] text-[0.85rem]',
} as const;

/** Suit colors echo the traditional Spanish deck palette. */
const SUIT_COLORS: Record<Suit, string> = {
  oro: '#b45309',
  copa: '#b91c1c',
  espada: '#1e3a5f',
  basto: '#3f6212',
};

function SuitGlyph({ suit }: { suit: Suit }) {
  const common = {
    viewBox: '0 0 32 32',
    className: 'h-full w-full',
    'aria-hidden': true as const,
    focusable: false as const,
  };
  switch (suit) {
    case 'oro': // coin: solid disc with engraved ring
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12" fill="currentColor" />
          <circle cx="16" cy="16" r="7" fill="none" stroke="#fef3c7" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="#fef3c7" />
        </svg>
      );
    case 'copa': // chalice: bowl, stem, foot
      return (
        <svg {...common}>
          <path d="M6 3h20c0 9-4.5 13-10 13S6 12 6 3Z" fill="currentColor" />
          <path d="M9.5 6h13c-.6 4-3 7-6.5 7s-5.9-3-6.5-7Z" fill="#fee2e2" />
          <rect x="14" y="16" width="4" height="8" rx="1" fill="currentColor" />
          <rect x="8" y="24" width="16" height="4" rx="1.5" fill="currentColor" />
        </svg>
      );
    case 'espada': // sword: blade, guard, grip, pommel
      return (
        <svg {...common}>
          <path d="M16 1l3.5 19h-7L16 1Z" fill="currentColor" />
          <path d="M16 4l2 15h-4L16 4Z" fill="#dbeafe" />
          <rect x="7" y="20" width="18" height="3" rx="1.2" fill="currentColor" />
          <rect x="14" y="23" width="4" height="6" rx="1" fill="currentColor" />
          <circle cx="16" cy="30.4" r="1.6" fill="currentColor" />
        </svg>
      );
    case 'basto': // cudgel: knotted trunk
      return (
        <svg {...common}>
          <path
            d="M13 4c0-2 1.4-3 3-3s3 1 3 3c0 1.4-.7 2.3-1.2 3L20 28a2 2 0 0 1-2 2.2h-4A2 2 0 0 1 12 28l2.2-21C13.7 6.3 13 5.4 13 4Z"
            fill="currentColor"
          />
          <circle cx="16" cy="4" r="2.2" fill="#ecfccb" />
          <circle cx="13.6" cy="27" r="1.6" fill="#ecfccb" />
          <circle cx="18.4" cy="27" r="1.6" fill="#ecfccb" />
        </svg>
      );
  }
}

function CardBack() {
  return (
    <div
      data-testid="playing-card-back-art"
      className="h-full w-full rounded-[inherit]"
      style={{
        backgroundColor: '#7f1d1d',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)',
      }}
    />
  );
}

function CardFace({ rank, suit }: { rank: string; suit: Suit }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-between bg-[#fffdf5] p-[6%]">
      <span className="font-bold leading-none" style={{ color: SUIT_COLORS[suit] }}>
        {rank}
      </span>
      <div className="h-[46%] w-[62%]" style={{ color: SUIT_COLORS[suit] }}>
        <SuitGlyph suit={suit} />
      </div>
      <span className="rotate-180 font-bold leading-none" style={{ color: SUIT_COLORS[suit] }}>
        {rank}
      </span>
    </div>
  );
}

export function PlayingCard({ card, faceDown = false, size = 'md', onClick }: PlayingCardProps) {
  const { t } = useTranslation();

  if (!faceDown && !card) {
    throw new Error('PlayingCard requires either `card` or `faceDown`');
  }

  const testId = faceDown || !card ? 'playing-card-back' : `playing-card-${card}`;
  let label: string;
  if (faceDown || !card) {
    label = t('truco.card.back');
  } else {
    const { rank, suit } = splitCardId(card);
    label = t('truco.card.alt', { rank, suit: t(`truco.suit.${suit}`) });
  }

  const Interactive = onClick && !faceDown && card ? 'button' : 'div';

  return (
    <Interactive
      {...(Interactive === 'button' ? { type: 'button' as const } : {})}
      {...(onClick && !faceDown && card
        ? { onClick: () => onClick(card) }
        : {})}
      data-testid={testId}
      role="img"
      aria-label={label}
      className={[
        SIZE_CLASSES[size],
        'relative aspect-[2/3] min-w-0 shrink-0 select-none overflow-hidden rounded-md border border-[var(--color-border)] shadow-sm transition-transform',
        Interactive === 'button'
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]'
          : '',
      ].join(' ')}
    >
      {faceDown || !card ? (
        <CardBack />
      ) : (
        <CardFace {...splitCardId(card)} />
      )}
    </Interactive>
  );
}
