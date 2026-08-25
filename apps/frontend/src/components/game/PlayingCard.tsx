import { memo, useId } from 'react';
import type { CardId, Suit } from '@geotano/shared';
import { useTranslation } from 'react-i18next';

/** Subtle hand-strength indicator (MY cards only, derived from engine tiers). */
export type StrengthHint = 'strong' | 'medium' | 'weak';

/**
 * Spanish-deck card primitive shared by BOTH truco modes (D11).
 * Self-contained inline SVG art — zero network assets, deterministic output.
 * Physical-deck treatment: cream paper tone, double inner frame, authentic
 * pip layouts for number cards, hero scenes for aces, emblem scenes for
 * figuras. W2 responsive rule: fixed/clamp arbitrary widths only.
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

/* ─── Suit pips: detailed mini illustrations (memoized — reused heavily) ─ */

function OroPipSvg() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden focusable={false}>
      {/* gold coin: rim, engraved inner ring, embossed cross */}
      <circle cx="16" cy="16" r="13" fill="currentColor" />
      <circle cx="16" cy="16" r="10.2" fill="none" stroke="#fef3c7" strokeWidth="1.6" opacity="0.85" />
      <path d="M16 8.6v14.8M8.6 16h14.8" stroke="#fef3c7" strokeWidth="2.1" opacity="0.9" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.1" fill="#fffbeb" />
      {/* rim ticks for minted feel */}
      <g stroke="#fef3c7" strokeWidth="1" opacity="0.5">
        <path d="M16 3.4v1.8M16 26.8v1.8M3.4 16h1.8M26.8 16h1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function CopaPipSvg() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden focusable={false}>
      {/* chalice: banded rim, bowl, knopped stem, flared foot */}
      <path d="M7 3.5h18c0 8.2-3.6 12.8-9 12.8S7 11.7 7 3.5Z" fill="currentColor" />
      <rect x="7" y="3.5" width="18" height="2.2" rx="1.1" fill="#fee2e2" opacity="0.75" />
      <rect x="14.4" y="16.3" width="3.2" height="5.4" rx="1.2" fill="currentColor" />
      <ellipse cx="16" cy="22.2" rx="3.1" ry="1.5" fill="currentColor" />
      <path d="M9.6 29c0-1.9 2.9-3.2 6.4-3.2s6.4 1.3 6.4 3.2v.6H9.6V29Z" fill="currentColor" />
      <ellipse cx="16" cy="29.3" rx="6.4" ry="0.9" fill="#fee2e2" opacity="0.4" />
    </svg>
  );
}

function EspadaPipSvg() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden focusable={false}>
      {/* sword: tapered blade with fuller, curved quillon block, grip, pommel */}
      <path d="M16 1.5l3.2 19.6h-6.4L16 1.5Z" fill="currentColor" />
      <path d="M16 6l1.5 14.6h-3L16 6Z" fill="#dbeafe" opacity="0.75" />
      <path d="M6.5 21.2h19a1.3 1.3 0 0 1 0 2.6h-19a1.3 1.3 0 0 1 0-2.6Z" fill="currentColor" />
      <rect x="14.3" y="23.8" width="3.4" height="4.9" rx="1.3" fill="currentColor" />
      <circle cx="16" cy="30" r="1.9" fill="currentColor" />
      <circle cx="16" cy="30" r="0.7" fill="#dbeafe" opacity="0.85" />
    </svg>
  );
}

function BastoPipSvg() {
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden focusable={false}>
      {/* knotted wooden cudgel raised diagonally */}
      <g transform="rotate(-32 16 16)">
        <path
          d="M12.6 3.4c0-1.6 1.5-2.8 3.4-2.8s3.4 1.2 3.4 2.8c0 1-.5 1.8-1.1 2.4l1.9 22.4a2.2 2.2 0 0 1-2.2 2.4h-4a2.2 2.2 0 0 1-2.2-2.4l1.9-22.4c-.6-.6-1.1-1.4-1.1-2.4Z"
          fill="currentColor"
        />
        <circle cx="16" cy="3.6" r="1.7" fill="#ecfccb" />
        <circle cx="16" cy="14.5" r="1.5" fill="#d9f99d" />
        <circle cx="14.9" cy="26" r="1.2" fill="#ecfccb" />
        <circle cx="17.1" cy="26" r="1.2" fill="#ecfccb" />
      </g>
    </svg>
  );
}

const SUIT_PIP = {
  oro: memo(OroPipSvg),
  copa: memo(CopaPipSvg),
  espada: memo(EspadaPipSvg),
  basto: memo(BastoPipSvg),
} as const;

/** One traditional suit pip instance, positioned by the rank layout. */
const Pip = memo(function Pip({
  card,
  n,
  suit,
  x,
  y,
  flip,
}: {
  card: CardId;
  n: number;
  suit: Suit;
  x: number;
  y: number;
  flip?: boolean;
}) {
  const PipArt = SUIT_PIP[suit];
  return (
    <span
      data-testid={`playing-card-${card}-pip-${n}`}
      className="absolute aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        color: suitVar(suit),
        transform: `translate(-50%, -50%)${flip ? ' rotate(180deg)' : ''}`,
      }}
    >
      <PipArt />
    </span>
  );
});

/* ─── Authentic Spanish-deck pip layouts (percent coords in pip zone) ──── */

interface PipSpot {
  x: number;
  y: number;
  flip?: boolean;
}

const PIP_LAYOUTS: Record<'2' | '3' | '4' | '5' | '6' | '7', readonly PipSpot[]> = {
  '2': [
    { x: 50, y: 13 },
    { x: 50, y: 87, flip: true },
  ],
  '3': [
    { x: 50, y: 13 },
    { x: 50, y: 50 },
    { x: 50, y: 87, flip: true },
  ],
  '4': [
    { x: 26, y: 13 },
    { x: 74, y: 13 },
    { x: 26, y: 87, flip: true },
    { x: 74, y: 87, flip: true },
  ],
  '5': [
    { x: 26, y: 13 },
    { x: 74, y: 13 },
    { x: 50, y: 50 },
    { x: 26, y: 87, flip: true },
    { x: 74, y: 87, flip: true },
  ],
  '6': [
    { x: 26, y: 13 },
    { x: 74, y: 13 },
    { x: 26, y: 50 },
    { x: 74, y: 50 },
    { x: 26, y: 87, flip: true },
    { x: 74, y: 87, flip: true },
  ],
  // Siete: two columns of three plus one upper-middle pip (classic truco 7).
  '7': [
    { x: 26, y: 13 },
    { x: 74, y: 13 },
    { x: 26, y: 50 },
    { x: 74, y: 50 },
    { x: 50, y: 31.5 },
    { x: 26, y: 87, flip: true },
    { x: 74, y: 87, flip: true },
  ],
};

/* ─── Ace hero scenes: the four matadores get illustrated treatments ───── */

const GOLD = 'var(--truco-card-back-gold)';

/** Shared golden flourish arcs framing every ace scene. */
function AceFlourish() {
  return (
    <g fill="none" stroke={GOLD} strokeWidth="1.4" opacity="0.8">
      <path d="M8 92c10 4 46 4 56 0" strokeLinecap="round" />
      <path d="M10 96c11 3.4 41 3.4 52 0" strokeLinecap="round" opacity="0.55" />
      <circle cx="36" cy="94" r="1.6" fill={GOLD} stroke="none" />
    </g>
  );
}

const AsEspadaHero = memo(function AsEspadaHero() {
  return (
    <svg viewBox="0 0 72 100" className="h-full w-full" aria-hidden focusable={false}>
      {/* radiating crown behind the point — el ancho de espadas */}
      <g stroke={GOLD} strokeWidth="1.2" opacity="0.65">
        <path d="M36 20L24 4M36 20L36 2M36 20L48 4" strokeLinecap="round" />
      </g>
      {/* great sword */}
      <path d="M36 8l6.5 52h-13L36 8Z" fill="currentColor" />
      <path d="M36 15l3 44h-6l3-44Z" fill="#dbeafe" opacity="0.8" />
      <path d="M17 61h38a2.4 2.4 0 0 1 0 4.8H17a2.4 2.4 0 0 1 0-4.8Z" fill="currentColor" />
      <circle cx="17" cy="63.4" r="2.4" fill="currentColor" />
      <circle cx="55" cy="63.4" r="2.4" fill="currentColor" />
      <rect x="33" y="65.8" width="6" height="12" rx="2.4" fill="currentColor" />
      <circle cx="36" cy="81.5" r="4" fill="currentColor" />
      <circle cx="36" cy="81.5" r="1.5" fill="#dbeafe" opacity="0.85" />
      <AceFlourish />
    </svg>
  );
});

const AsBastoHero = memo(function AsBastoHero() {
  return (
    <svg viewBox="0 0 72 100" className="h-full w-full" aria-hidden focusable={false}>
      {/* golden laurel arcs behind the cudgel */}
      <g fill="none" stroke={GOLD} strokeWidth="1.4" opacity="0.7">
        <path d="M12 78C10 58 20 34 36 26" strokeLinecap="round" />
        <path d="M60 78C62 58 52 34 36 26" strokeLinecap="round" />
      </g>
      <g transform="rotate(-30 36 50)">
        <path
          d="M29 12c0-3.4 3.1-5.8 7-5.8s7 2.4 7 5.8c0 2-1 3.6-2.2 4.7L43 76a4.4 4.4 0 0 1-4.4 4.8h-5.2A4.4 4.4 0 0 1 29 76l2.2-59.3C30 15.6 29 14 29 12Z"
          fill="currentColor"
        />
        <circle cx="36" cy="12.4" r="3.4" fill="#ecfccb" />
        <circle cx="36" cy="36" r="3" fill="#d9f99d" />
        <circle cx="33.6" cy="70" r="2.5" fill="#ecfccb" />
        <circle cx="38.4" cy="70" r="2.5" fill="#ecfccb" />
        <path d="M32 24h8M31.6 52h8.8" stroke="#d9f99d" strokeWidth="1.2" opacity="0.6" />
      </g>
      <AceFlourish />
    </svg>
  );
});

const AsOroHero = memo(function AsOroHero() {
  return (
    <svg viewBox="0 0 72 100" className="h-full w-full" aria-hidden focusable={false}>
      {/* oversized minted coin with ornate rim + radiant emblem */}
      <circle cx="36" cy="47" r="33" fill="currentColor" />
      <circle cx="36" cy="47" r="27.5" fill="none" stroke="#fef3c7" strokeWidth="2.4" opacity="0.85" />
      <circle cx="36" cy="47" r="23" fill="none" stroke="#fde68a" strokeWidth="1.2" strokeDasharray="2.4 2.2" opacity="0.7" />
      {/* embossed radiant star emblem */}
      <g fill="#fef3c7" opacity="0.92">
        <path d="M36 27l4.2 15.8L56 47l-15.8 4.2L36 67l-4.2-15.8L16 47l15.8-4.2L36 27Z" />
      </g>
      <circle cx="36" cy="47" r="5" fill="#fffbeb" />
      <circle cx="36" cy="47" r="33" fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.6" />
      <AceFlourish />
    </svg>
  );
});

const AsCopaHero = memo(function AsCopaHero() {
  return (
    <svg viewBox="0 0 72 100" className="h-full w-full" aria-hidden focusable={false}>
      {/* great ornate chalice with jewelled bands */}
      <path d="M14 10h44c0 17-9 27-22 27S14 27 14 10Z" fill="currentColor" />
      <rect x="14" y="10" width="44" height="4.4" rx="2.2" fill="#fecaca" opacity="0.9" />
      <path d="M21 17.5h30c-1.2 9.4-7.4 15.2-15 15.2s-13.8-5.8-15-15.2Z" fill="#fee2e2" opacity="0.4" />
      <circle cx="36" cy="24.5" r="2.6" fill="#fef3c7" opacity="0.9" />
      <path d="M31 37h10l2 15h-14l2-15Z" fill="currentColor" />
      <rect x="28.5" y="42" width="15" height="2.4" rx="1.2" fill={GOLD} opacity="0.85" />
      <ellipse cx="36" cy="54.5" rx="6.5" ry="4" fill="currentColor" />
      <path d="M20 78c0-4.2 7.2-7 16-7s16 2.8 16 7v3H20v-3Z" fill="currentColor" />
      <ellipse cx="36" cy="77.6" rx="16" ry="2" fill={GOLD} opacity="0.55" />
      <AceFlourish />
    </svg>
  );
});

const ACE_HERO = {
  oro: AsOroHero,
  copa: AsCopaHero,
  espada: AsEspadaHero,
  basto: AsBastoHero,
} as const;

/* ─── Court-card emblems (figuras) ──────────────────────────────────── */

const SotaEmblem = memo(function SotaEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* page figure: cap, head, doublet */}
      <path d="M21.5 15L32 6l10.5 9-2.2 3.5H23.7L21.5 15Z" fill="currentColor" />
      <circle cx="32" cy="24.5" r="6" fill="currentColor" />
      <path d="M19.5 53.5c0-11.5 5.6-19 12.5-19s12.5 7.5 12.5 19l-2 4h-21l-2-4Z" fill="currentColor" />
      <rect x="24.5" y="44" width="15" height="2.5" rx="1.25" fill="#fef3c7" opacity="0.8" />
    </svg>
  );
});

const CaballoEmblem = memo(function CaballoEmblem() {
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
});

const ReyEmblem = memo(function ReyEmblem() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden focusable={false}>
      {/* crowned king bust: crown, head, mantled shoulders */}
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
});

/** Court ranks render emblem + localized legend so figuras read at a glance. */
const COURT_RANKS = {
  '10': { emblem: SotaEmblem, i18nKey: 'truco.card.sota' },
  '11': { emblem: CaballoEmblem, i18nKey: 'truco.card.caballo' },
  '12': { emblem: ReyEmblem, i18nKey: 'truco.card.rey' },
} as const;

/* ─── Paper texture: ultra-cheap dot pattern (no filters) ────────────── */

function PaperTexture({ patternId }: { patternId: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden focusable={false}>
      <defs>
        {/* Id is derived from useId() so two mounts of the same card (hand +
            deck drawer, hand + baza lane) never collide on a pattern id. */}
        <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="0.45" fill="oklch(0.55 0.04 80)" opacity="0.07" />
          <circle cx="5.2" cy="5.2" r="0.45" fill="oklch(0.55 0.04 80)" opacity="0.05" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

/* ─── Face composition ──────────────────────────────────────────────── */

function CornerIndex({ rank, suit }: { rank: string; suit: Suit }) {
  const PipArt = SUIT_PIP[suit];
  return (
    <div
      className="relative z-[1] flex flex-col items-center gap-[0.15em] leading-none font-bold"
      style={{ color: suitVar(suit) }}
    >
      <span>{rank}</span>
      <span className="block h-[1.05em] w-[1.05em]">
        <PipArt />
      </span>
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

function CardFace({ card, rank, suit }: { card: CardId; rank: string; suit: Suit }) {
  // useId() returns ":rN:"-style ids; strip non-identifier chars so the value
  // is safe inside url(#...) fragment references.
  const patternId = `truco-paper-${card}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const court = COURT_RANKS[rank as keyof typeof COURT_RANKS];
  const AceHero = ACE_HERO[suit];
  const pipLayout = PIP_LAYOUTS[rank as keyof typeof PIP_LAYOUTS];
  const isAce = rank === '1';

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: 'var(--truco-card-face)' }}
    >
      <PaperTexture patternId={patternId} />

      {/* Double-line inner frame, like a printed physical card */}
      <div className="pointer-events-none absolute inset-[3.5%] rounded-[inherit] border border-[var(--truco-card-frame)]" />
      <div className="pointer-events-none absolute inset-[6%] rounded-[inherit] border border-[var(--truco-card-frame)] opacity-55" />

      {/* Corner indices: top-left + rotated bottom-right (authentic layout) */}
      <div className="absolute left-[7%] top-[5%]">
        <CornerIndex rank={rank} suit={suit} />
      </div>
      <div className="absolute bottom-[5%] right-[7%] rotate-180">
        <CornerIndex rank={rank} suit={suit} />
      </div>

      {/* Central art zone, clear of both corner columns */}
      <div className="absolute inset-y-[10%] left-[19%] right-[19%]">
        {court ? (
          <div className="flex h-full w-full flex-col justify-center" style={{ color: suitVar(suit) }}>
            <div className="mx-auto aspect-square h-[68%]">
              <court.emblem />
            </div>
            <CourtLegend i18nKey={court.i18nKey} />
          </div>
        ) : isAce ? (
          <div
            data-testid={`playing-card-${card}-hero`}
            className="flex h-full w-full items-center justify-center"
            style={{ color: suitVar(suit) }}
          >
            <div className="aspect-[72/100] h-full max-w-full">
              <AceHero />
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {pipLayout!.map((spot, i) => (
              <Pip key={i} card={card} n={i + 1} suit={suit} x={spot.x} y={spot.y} flip={spot.flip} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Designed card back (printed lattice + sun medallion) ──────────── */

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
      {/* double printed frame */}
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
      <rect
        x="6.5"
        y="6.5"
        width={BACK_W - 13}
        height={BACK_H - 13}
        rx="3.5"
        fill="none"
        stroke="var(--truco-card-back-gold)"
        strokeWidth="0.6"
        opacity="0.5"
      />
      {/* diagonal lattice, clipped to the frame */}
      <clipPath id={clipId}>
        <rect x="8.5" y="8.5" width={BACK_W - 17} height={BACK_H - 17} rx="2.5" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <g stroke="var(--truco-card-back-deep)" strokeWidth="2.2">
          <BackLattice />
        </g>
        {/* deep panel behind medallion, gold-ringed like a print stamp */}
        <circle cx="45" cy="67.5" r="19.5" fill="var(--truco-card-back)" />
        <circle cx="45" cy="67.5" r="19.5" fill="none" stroke="var(--truco-card-back-gold)" strokeWidth="0.8" opacity="0.7" />
        <SunMedallion />
      </g>
    </svg>
  );
}

/* ─── Root component ────────────────────────────────────────────────── */

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
        'relative aspect-[2/3] min-w-0 shrink-0 select-none overflow-hidden rounded-md border shadow-[var(--truco-card-shadow)] transition-all duration-200 ease-out',
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
          <CardFace {...splitCardId(card!)} card={card!} />
          {strengthHint ? (
            <span
              data-testid="playing-card-strength-hint"
              title={t(`truco.card.strength.${strengthHint}`)}
              className="absolute bottom-[3%] left-1/2 z-[1] h-[3px] w-[46%] -translate-x-1/2 rounded-full"
              style={{ backgroundColor: `var(--truco-hint-${strengthHint})` }}
            />
          ) : null}
        </>
      )}
    </Interactive>
  );
});
