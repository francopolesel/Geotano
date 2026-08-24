import { useId } from 'react';
import type { CardId, Suit } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/** Subtle hand-strength indicator (MY cards only, derived from engine tiers). */
export type StrengthHint = 'strong' | 'medium' | 'weak';

/**
 * Spanish-deck card primitive shared by BOTH truco modes (D11).
 * Self-contained inline SVG art — zero network assets, deterministic output.
 * W2 responsive rule: fixed/clamp arbitrary widths only, never viewport-%.
 * All colors come from truco-namespaced CSS custom properties (index.css).
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

/** Fixed/clamp sizing tokens per variant (W2 proxy contract). */
const SIZE_CLASSES = {
  sm: 'w-[clamp(2.75rem,9vw,3.25rem)] text-[0.55rem]',
  md: 'w-[clamp(3rem,11vw,4.25rem)] text-[0.7rem]',
  lg: 'w-[clamp(3.5rem,13vw,5rem)] text-[0.85rem]',
} as const;

function suitVar(suit: Suit): string {
  return `var(--truco-${suit})`;
}

/* ─── Corner glyph (small, used in indices) ─────────────────────────── */

function SuitGlyph({ suit }: { suit: Suit }) {
  const common = {
    viewBox: '0 0 32 32',
    className: 'h-full w-full',
    'aria-hidden': true as const,
    focusable: false as const,
  };
  switch (suit) {
    case 'oro':
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="12" fill="currentColor" />
          <circle cx="16" cy="16" r="7" fill="none" stroke="#fef3c7" strokeWidth="2.5" />
          <circle cx="16" cy="16" r="2.5" fill="#fef3c7" />
        </svg>
      );
    case 'copa':
      return (
        <svg {...common}>
          <path d="M6 3h20c0 9-4.5 13-10 13S6 12 6 3Z" fill="currentColor" />
          <rect x="14" y="16" width="4" height="8" rx="1" fill="currentColor" />
          <rect x="8" y="24" width="16" height="4" rx="1.5" fill="currentColor" />
        </svg>
      );
    case 'espada':
      return (
        <svg {...common}>
          <path d="M16 1l3.5 19h-7L16 1Z" fill="currentColor" />
          <rect x="7" y="20" width="18" height="3" rx="1.2" fill="currentColor" />
          <rect x="14" y="23" width="4" height="6" rx="1" fill="currentColor" />
          <circle cx="16" cy="30.4" r="1.6" fill="currentColor" />
        </svg>
      );
    case 'basto':
      return (
        <svg {...common}>
          <path
            d="M13 4c0-2 1.4-3 3-3s3 1 3 3c0 1.4-.7 2.3-1.2 3L20 28a2 2 0 0 1-2 2.2h-4A2 2 0 0 1 12 28l2.2-21C13.7 6.3 13 5.4 13 4Z"
            fill="currentColor"
          />
          <circle cx="16" cy="4" r="2.2" fill="#ecfccb" />
        </svg>
      );
  }
}

/* ─── Central art: one large illustration per suit ──────────────────── */

function OroArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* gold coin with rim + embossed cross motif */}
      <circle cx="32" cy="32" r="29" fill="currentColor" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#fef3c7" strokeWidth="2.5" opacity="0.85" />
      <circle cx="32" cy="32" r="19.5" fill="none" stroke="#fde68a" strokeWidth="1.25" opacity="0.55" />
      <rect x="29" y="15" width="6" height="34" rx="1.5" fill="#fef3c7" opacity="0.9" />
      <rect x="15" y="29" width="34" height="6" rx="1.5" fill="#fef3c7" opacity="0.9" />
      <circle cx="32" cy="32" r="4" fill="#fffbeb" />
    </svg>
  );
}

function CopaArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* ornate chalice: rim band, bowl, knopped stem, foot */}
      <path d="M12 8h40c0 14-8 22-20 22S12 22 12 8Z" fill="currentColor" />
      <path d="M17.5 12.5h29c-.8 8-6.8 13-14.5 13s-13.7-5-14.5-13Z" fill="#fee2e2" opacity="0.45" />
      <rect x="12" y="8" width="40" height="3.5" rx="1.75" fill="#fecaca" opacity="0.9" />
      <path d="M28.5 30h7l1.5 11h-10l1.5-11Z" fill="currentColor" />
      <ellipse cx="32" cy="43.5" rx="5" ry="3.5" fill="currentColor" />
      <path d="M19.5 56c0-2.8 5.6-5 12.5-5s12.5 2.2 12.5 5v1.5h-25V56Z" fill="currentColor" />
      <rect x="26" y="33.5" width="12" height="1.75" rx="0.85" fill="#fecaca" opacity="0.7" />
    </svg>
  );
}

function EspadaArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* vertical sword: blade with fuller, crossguard, grip, pommel */}
      <path d="M32 2l5.5 38h-11L32 2Z" fill="currentColor" />
      <path d="M32 7l2.6 32h-5.2L32 7Z" fill="#dbeafe" opacity="0.75" />
      <rect x="13.5" y="40" width="37" height="4.5" rx="2.25" fill="currentColor" />
      <rect x="29" y="44.5" width="6" height="10" rx="2" fill="currentColor" />
      <circle cx="32" cy="57.5" r="3.5" fill="currentColor" />
      <circle cx="32" cy="57.5" r="1.4" fill="#dbeafe" opacity="0.8" />
    </svg>
  );
}

function BastoArt() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* knotted wooden cudgel, raised diagonally */}
      <g transform="rotate(-35 32 32)">
        <path
          d="M26 7c0-2.6 2.7-4.4 6-4.4s6 1.8 6 4.4c0 1.7-.9 2.9-1.7 3.9l3 41a3.5 3.5 0 0 1-3.5 3.7H28.2A3.5 3.5 0 0 1 24.7 52l3-41C26.9 9.9 26 8.7 26 7Z"
          fill="currentColor"
        />
        <circle cx="32" cy="7" r="3" fill="#ecfccb" />
        <circle cx="32" cy="27" r="2.6" fill="#d9f99d" />
        <circle cx="29.6" cy="49.5" r="2.2" fill="#ecfccb" />
        <circle cx="34.4" cy="49.5" r="2.2" fill="#ecfccb" />
      </g>
    </svg>
  );
}

const SUIT_ART = {
  oro: OroArt,
  copa: CopaArt,
  espada: EspadaArt,
  basto: BastoArt,
} as const;

/* ─── Court-card emblems (figuras) ──────────────────────────────────── */

function SotaEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* page figure: cap, head, doublet */}
      <path d="M21.5 15L32 6l10.5 9-2.2 3.5H23.7L21.5 15Z" fill="currentColor" />
      <circle cx="32" cy="24.5" r="6" fill="currentColor" />
      <path d="M19.5 53.5c0-11.5 5.6-19 12.5-19s12.5 7.5 12.5 19l-2 4h-21l-2-4Z" fill="currentColor" />
      <rect x="24.5" y="44" width="15" height="2.5" rx="1.25" fill="#fef3c7" opacity="0.8" />
    </svg>
  );
}

function CaballoEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* horse head silhouette, chess-knight style */}
      <path
        d="M17 57c-2 0-3.4-1.7-3-3.6.9-4.7 3-8.6 6.1-11.9-2.9-.5-5.2-2.4-6.3-5-.8-1.9.3-4 2.2-4.7 1.5-.5 3.1-.1 4.5.3 1.1.3 2.2 0 2.9-.9l4.9-5.8c1.1-4.9 3.6-8.9 7.3-11.2 1.5-1 3.5-.5 4.4 1 .8 1.4.5 3.1-.6 4.3 5.2 2.7 8.8 8 8.8 14.3 0 8.6-2.9 16.7-6.6 23.2H17Z"
        fill="currentColor"
      />
      <path d="M40.5 12.5l4.5-5 1.5 6.5-6-1.5Z" fill="currentColor" />
      <circle cx="41" cy="22" r="1.8" fill="#fffbeb" />
    </svg>
  );
}

function ReyEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* crown: three points with orb finial, jewelled band */}
      <path d="M13 46L9.5 21l12 8.5L32 15l10.5 14.5 12-8.5L51 46H13Z" fill="currentColor" />
      <circle cx="32" cy="10.5" r="3.5" fill="currentColor" />
      <circle cx="9.5" cy="18" r="2.5" fill="currentColor" />
      <circle cx="54.5" cy="18" r="2.5" fill="currentColor" />
      <rect x="13" y="48" width="38" height="6" rx="2" fill="currentColor" />
      <circle cx="22" cy="51" r="1.8" fill="#fef3c7" />
      <circle cx="32" cy="51" r="1.8" fill="#fef3c7" />
      <circle cx="42" cy="51" r="1.8" fill="#fef3c7" />
    </svg>
  );
}

/** Court ranks render emblem + localized legend so figuras read at a glance. */
const COURT_RANKS = {
  '10': { emblem: SotaEmblem, i18nKey: 'truco.card.sota' },
  '11': { emblem: CaballoEmblem, i18nKey: 'truco.card.caballo' },
  '12': { emblem: ReyEmblem, i18nKey: 'truco.card.rey' },
} as const;

/* ─── Face composition ──────────────────────────────────────────────── */

function CornerIndex({ rank, suit }: { rank: string; suit: Suit }) {
  return (
    <div
      className="flex flex-col items-center gap-[0.15em] leading-none font-bold"
      style={{ color: suitVar(suit) }}
    >
      <span>{rank}</span>
      <span className="block h-[1em] w-[1em]">
        <SuitGlyph suit={suit} />
      </span>
    </div>
  );
}

function CardFace({ rank, suit }: { rank: string; suit: Suit }) {
  const court = COURT_RANKS[rank as keyof typeof COURT_RANKS];
  const Art = SUIT_ART[suit];
  return (
    <div
      className="relative flex h-full w-full flex-col justify-between p-[6%]"
      style={{ backgroundColor: 'var(--truco-card-face)' }}
    >
      {/* Corner indices: top-left + rotated bottom-right (authentic layout) */}
      <CornerIndex rank={rank} suit={suit} />
      <div className="absolute inset-0 flex items-center justify-center px-[16%]">
        {court ? (
          <div className="flex h-[64%] w-[78%] flex-col" style={{ color: suitVar(suit) }}>
            <div className="min-h-0 flex-1">
              <court.emblem />
            </div>
            <CourtLegend i18nKey={court.i18nKey} />
          </div>
        ) : (
          <div className="aspect-square h-[80%]" style={{ color: suitVar(suit) }}>
            <Art />
          </div>
        )}
      </div>
      <div className="rotate-180 self-end">
        <CornerIndex rank={rank} suit={suit} />
      </div>
    </div>
  );
}

function CourtLegend({ i18nKey }: { i18nKey: string }) {
  const { t } = useTranslation();
  return (
    <span className="mt-[6%] text-center text-[0.62em] leading-none font-bold uppercase tracking-widest">
      {t(i18nKey)}
    </span>
  );
}

/* ─── Designed card back (ornate lattice + sun medallion) ───────────── */

const BACK_W = 90;
const BACK_H = 135;

/** Deterministic precomputed diagonal lattice lines (no SVG ids needed). */
function BackLattice() {
  const lines = [];
  const step = 11;
  for (let k = 0; k <= Math.ceil((BACK_W + BACK_H) / step); k++) {
    lines.push(
      <line
        key={`f${k}`}
        x1={k * step}
        y1={0}
        x2={k * step - BACK_H}
        y2={BACK_H}
      />,
      <line
        key={`b${k}`}
        x1={k * step - BACK_H}
        y1={0}
        x2={k * step}
        y2={BACK_H}
      />,
    );
  }
  return <g>{lines}</g>;
}

function SunMedallion() {
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const x = 45 + Math.cos(angle) * 13.5;
    const y = 67.5 + Math.sin(angle) * 13.5;
    rays.push(<circle key={i} cx={x} cy={y} r={1.7} />);
  }
  return (
    <g fill="var(--truco-card-back-gold)">
      {rays}
      <circle cx="45" cy="67.5" r="10" />
      <circle cx="45" cy="67.5" r="5" fill="var(--truco-card-back-deep)" />
    </g>
  );
}

function CardBack() {
  const clipId = useId();
  return (
    <svg
      data-testid="playing-card-back-art"
      viewBox={`0 0 ${BACK_W} ${BACK_H}`}
      preserveAspectRatio="none"
      className="h-full w-full rounded-[inherit]"
      aria-hidden
      focusable={false}
    >
      <rect width={BACK_W} height={BACK_H} fill="var(--truco-card-back)" />
      {/* inner frame */}
      <rect
        x="4"
        y="4"
        width={BACK_W - 8}
        height={BACK_H - 8}
        rx="5"
        fill="none"
        stroke="var(--truco-card-back-gold)"
        strokeWidth="1.4"
        opacity="0.85"
      />
      {/* diagonal lattice, clipped to the frame */}
      <clipPath id={clipId}>
        <rect x="7" y="7" width={BACK_W - 14} height={BACK_H - 14} rx="3" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g stroke="var(--truco-card-back-deep)" strokeWidth="2.2">
          <BackLattice />
        </g>
        {/* deep panel behind medallion */}
        <circle cx="45" cy="67.5" r="17.5" fill="var(--truco-card-back)" />
        <SunMedallion />
      </g>
    </svg>
  );
}

/* ─── Root component ────────────────────────────────────────────────── */

export function PlayingCard({
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
        'relative aspect-[2/3] min-w-0 shrink-0 select-none overflow-hidden rounded-md border shadow-sm transition-all duration-200 ease-out',
        'border-[var(--truco-card-border)]',
        interactive
          ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--truco-card-ring)]'
          : '',
        selected ? '-translate-y-3.5 shadow-lg ring-2 ring-[var(--truco-card-ring)]' : '',
        disabled && !selected ? 'opacity-45 grayscale-[60%] cursor-not-allowed' : '',
      ].join(' ')}
      style={{ backgroundColor: faceDown || !card ? undefined : 'var(--truco-card-face)' }}
    >
      {faceDown || !card ? (
        <CardBack />
      ) : (
        <>
          <CardFace {...splitCardId(card!)} />
          {strengthHint ? (
            <span
              data-testid="playing-card-strength-hint"
              title={t(`truco.card.strength.${strengthHint}`)}
              className="absolute bottom-[3%] left-1/2 h-[3px] w-[46%] -translate-x-1/2 rounded-full"
              style={{ backgroundColor: `var(--truco-hint-${strengthHint})` }}
            />
          ) : null}
        </>
      )}
    </Interactive>
  );
}
