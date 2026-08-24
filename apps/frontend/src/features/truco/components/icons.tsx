// ---------------------------------------------------------------------------
// Truco table iconography — tiny inline SVG set (currentColor)
// ---------------------------------------------------------------------------
// Presentation-only glyphs for the bet panel, action bar and turn banner.
// Kept local to the truco feature: no icon library dependency, no engine
// coupling. Every icon inherits color via `currentColor`.

export interface IconProps {
  className?: string;
}

/** Flame — Truco bet family (raise-the-hand bets). */
export function FlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 2.5c.6 3-1.2 4.6-2.6 6.1C7.9 10.2 6.5 11.8 6.5 14.5a5.5 5.5 0 0 0 11 0c0-1.4-.4-2.6-1-3.7-.9 1-1.7 1.4-2.5 1.2.9-2.4.4-5.6-2-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Coins — Envido bet family (hand-strength side bets). */
export function CoinsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <ellipse cx="9" cy="8" rx="5.5" ry="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 8v4c0 1.66 2.46 3 5.5 3s5.5-1.34 5.5-3V8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12.2 13.2c.9 1 2.6 1.8 4.8 1.8 3.04 0 5.5-1.34 5.5-3V8"
        stroke="currentColor"
        strokeWidth="1.8"
        transform="translate(-2.5 4)"
      />
    </svg>
  );
}

/** Fanned cards — plain card-play / game group. */
export function CardsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="3" y="6" width="9" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(-8 7.5 12.5)" />
      <rect x="11" y="5" width="9" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.8" transform="rotate(8 15.5 11.5)" />
    </svg>
  );
}

/** Play triangle — my-turn banner. */
export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

/** Hourglass — rival's turn (waiting). */
export function HourglassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M6 3h12M6 21h12M7.5 3v3.2c0 1.5.9 2.6 2.1 3.5l1.4 1c.6.45.6 1.65 0 2.1l-1.4 1c-1.2.9-2.1 2-2.1 3.5V21M16.5 3v3.2c0 1.5-.9 2.6-2.1 3.5l-1.4 1c-.6.45-.6 1.65 0 2.1l1.4 1c1.2.9 2.1 2 2.1 3.5V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Spinner ring — waiting-for-answer states. */
export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className ?? 'h-4 w-4 animate-spin'}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Check mark — Quiero answer. */
export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Cross mark — No quiero answer. */
export function CrossIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Clock — match history toggle. */
export function HistoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5.2l3.4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Clipboard — copy-to-clipboard affordance. */
export function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Robot — CPU mode card. */
export function RobotIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="4" y="8" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8V4.5M12 4.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="13" r="1.2" fill="currentColor" />
      <circle cx="15" cy="13" r="1.2" fill="currentColor" />
      <path d="M9.5 16.2c.8.6 4.2.6 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Two people — friend mode card. */
export function PeopleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.8 14.6c2.4.1 4.1 1.4 4.7 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Trophy — victory celebration. */
export function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M8 4h8v6a4 4 0 0 1-8 0V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3M12 14v3M8.5 20h7M10 17h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
