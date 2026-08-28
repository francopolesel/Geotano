import type {
  BazaPlay,
  BazaRecord,
  PlayerSlot,
  TrucoEvent,
  TrucoPhase,
} from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { CallFeedbackBanner } from './CallFeedbackBanner';

/**
 * CENTER zone over the felt: call feedback plus the three-baza lane strip —
 * the whole hand visible at a glance. Resolved lanes hold both miniature
 * cards "tossed on the table" with a winner badge; the ACTIVE lane is
 * visually dominant and receives cards as they land (owner-direction entry
 * animation); future lanes show faint embossed silhouettes.
 *
 * During `hand_end` the lanes persist (the board never blanks between hands)
 * and a compact summary chip overlays the felt. Lanes reset naturally when
 * the next hand deals (bazaNumber back to 1, empty bazas).
 */
export interface TableZoneProps {
  openBazaPlays: readonly BazaPlay[];
  bazas: readonly BazaRecord[];
  mySlot: PlayerSlot;
  names: Record<PlayerSlot, string>;
  history: readonly TrucoEvent[];
  phase: TrucoPhase;
}

/** Phases in which the baza lanes are on stage. */
const LANES_PHASES: readonly TrucoPhase[] = [
  'playing',
  'envido_betting',
  'truco_betting',
  'hand_end',
];

/** Winner of the most recent hand from the public event log (null if none). */
function lastHandWinner(history: readonly TrucoEvent[]): PlayerSlot | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const event = history[i]!;
    if (event.type === 'hand_ended') return event.winner;
  }
  return null;
}

/**
 * Points awarded for the CURRENT hand: every `points_awarded` event between
 * this `hand_ended` and the PREVIOUS one. The engine settles envido
 * immediately mid-hand, so awards interleave with card_played/baza_resolved
 * events — only a hand boundary terminates the scan, never an event type.
 */
function handEndPoints(history: readonly TrucoEvent[]): number {
  let sum = 0;
  let seenBoundary = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const event = history[i]!;
    if (event.type === 'hand_ended') {
      if (seenBoundary) break; // reached the PREVIOUS hand → stop
      seenBoundary = true;
      continue;
    }
    if (!seenBoundary) continue; // skip match_ended / trailing noise
    if (event.type === 'points_awarded') sum += event.amount;
  }
  return sum;
}

/** Embossed card-outline silhouette for empty slots/future lanes. */
function CardSilhouette({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-hidden
      className={[
        'aspect-[2/3] rounded-md border border-white/25 bg-black/15 shadow-[inset_0_1px_4px_rgb(0_0_0/0.35)]',
        small ? 'w-10' : 'w-[clamp(3rem,11vw,4.5rem)]',
      ].join(' ')}
    />
  );
}

export function TableZone({
  openBazaPlays,
  bazas,
  mySlot,
  names,
  history,
  phase,
}: TableZoneProps) {
  const { t } = useTranslation();
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';

  if (!LANES_PHASES.includes(phase)) {
    // Pre-deal / post-match: keep only the feedback slot alive.
    return (
      <div
        data-testid="truco-table-zone"
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 px-3 py-3"
      >
        <div className="min-h-[1.5rem] w-full max-w-md">
          <CallFeedbackBanner history={history} names={names} />
        </div>
      </div>
    );
  }

  const rivalPlay = openBazaPlays.find((p) => p.player === rivalSlot);
  const myPlay = openBazaPlays.find((p) => p.player === mySlot);
  const lastBazaNumber = bazas.length > 0 ? bazas[bazas.length - 1]!.number : null;

  const summaryPoints = phase === 'hand_end' ? handEndPoints(history) : 0;
  const handWinner = phase === 'hand_end' ? lastHandWinner(history) : null;

  return (
    <div
      data-testid="truco-table-zone"
      className="relative flex min-w-0 flex-1 flex-col items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-3"
    >
      {/* Call feedback persists here until superseded */}
      <div className="min-h-[1.5rem] w-full max-w-md">
        <CallFeedbackBanner history={history} names={names} />
      </div>

      {/* Three-baza lane strip: past / active / future side by side */}
      <div
        data-testid="truco-baza-lanes"
        className="grid w-full max-w-md grid-cols-3 items-end gap-1.5 sm:gap-2"
      >
        {[1, 2, 3].map((n) => {
          const resolved = bazas.find((b) => b.number === n);
          const isActive = !resolved && n === bazas.length + 1;

          const laneTone = resolved
            ? 'border-white/10 bg-black/20 opacity-90'
            : isActive
              ? 'border-emerald-300/50 bg-white/15 shadow-[0_0_14px_rgb(16_185_129/0.35)]'
              : 'border-white/10 bg-black/10';

          return (
            <div key={n} data-testid={`baza-lane-${n}`} className="flex min-w-0 flex-col items-center gap-1">
              <span
                data-testid={`baza-lane-label-${n}`}
                className={[
                  'text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]',
                  isActive ? 'text-white' : 'text-white/60',
                ].join(' ')}
              >
                {t('truco.baza.label', { n })}
              </span>

              <div className={['w-full rounded-lg border p-1 transition-all', laneTone].join(' ')}>
                {resolved ? (
                  /* Resolved: both mini cards tossed with a slight offset */
                  <div className="flex flex-col items-center">
                    <PlayingCard card={resolved.plays.find((p) => p.player === rivalSlot)?.card} size="sm" faceDown={!resolved.plays.some((p) => p.player === rivalSlot)} />
                    <div className="-mt-2 translate-x-1 rotate-2">
                      <PlayingCard card={resolved.plays.find((p) => p.player === mySlot)?.card} size="sm" faceDown={!resolved.plays.some((p) => p.player === mySlot)} />
                    </div>
                  </div>
                ) : isActive ? (
                  /* Active: larger cards land here as they are played */
                  <div className="flex flex-col items-center gap-1 py-0.5">
                    <div
                      data-testid={`open-baza-${rivalSlot}-slot`}
                      className="relative"
                    >
                      {rivalPlay ? (
                        <div
                          key={rivalPlay.card}
                          className="animate-truco-play-rival"
                        >
                          <PlayingCard card={rivalPlay.card} size="md" />
                        </div>
                      ) : (
                        <CardSilhouette />
                      )}
                    </div>
                    <div
                      data-testid={`open-baza-${mySlot}-slot`}
                      className="relative"
                    >
                      {myPlay ? (
                        <div
                          key={myPlay.card}
                          className="animate-truco-play-mine"
                        >
                          <PlayingCard card={myPlay.card} size="md" />
                        </div>
                      ) : (
                        <CardSilhouette />
                      )}
                    </div>
                  </div>
                ) : (
                  /* Future lane: faint embossed placeholder */
                  <div className="flex flex-col items-center gap-1 py-1 opacity-50">
                    <CardSilhouette small />
                    <CardSilhouette small />
                  </div>
                )}
              </div>

              {/* Winner badge under resolved lanes */}
              {resolved ? (
                <LaneBadge
                  baza={resolved}
                  mySlot={mySlot}
                  pulse={resolved.number === lastBazaNumber && resolved.winner !== null}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Hand-end summary: lanes stay fully visible underneath */}
      {phase === 'hand_end' && handWinner !== null ? (
        <div
          data-testid="truco-hand-summary"
          className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/30 bg-black/55 px-4 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm"
        >
          <span>
            {handWinner === mySlot ? t('truco.handEnd.won') : t('truco.handEnd.lost')}
          </span>
          {summaryPoints > 0 ? (
            <span className="tabular-nums text-emerald-300">
              +{summaryPoints} {t('truco.banner.pointsUnit')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface LaneBadgeProps {
  baza: BazaRecord;
  mySlot: PlayerSlot;
  /** Brief winner pulse (~600ms) fired once per resolution. */
  pulse: boolean;
}

function LaneBadge({ baza, mySlot, pulse }: LaneBadgeProps) {
  const { t } = useTranslation();
  const resultKey =
    baza.winner === null
      ? 'truco.baza.tied'
      : baza.winner === mySlot
        ? 'truco.baza.won'
        : 'truco.baza.lost';
  const badgeKey =
    baza.winner === null
      ? 'truco.baza.badgeTied'
      : baza.winner === mySlot
        ? 'truco.baza.badgeMine'
        : 'truco.baza.badgeRival';
  const glyph = baza.winner === null ? '=' : baza.winner === mySlot ? '✓' : '●';
  // Icon + label carry the outcome (never color alone); the sr-only copy keeps
  // the full viewer-perspective sentence ("Baza n: you won") for tests/a11y.
  const title = `${t('truco.baza.label', { n: baza.number })}: ${t(resultKey)}`;

  return (
    <span
      data-testid={`baza-marker-${baza.number}`}
      title={title}
      className={[
        'relative flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold leading-tight sm:text-[10px]',
        baza.winner === null
          ? 'border-white/25 bg-black/30 text-white/75'
          : baza.winner === mySlot
            ? 'border-emerald-400/50 bg-emerald-900/40 text-emerald-200'
            : 'border-red-400/40 bg-red-900/30 text-red-200/90',
      ].join(' ')}
    >
      {pulse && baza.winner !== null ? (
        <span
          key={`pulse-${baza.number}`}
          aria-hidden
          data-testid={`baza-win-pulse-${baza.winner}`}
          className="animate-truco-win-pulse pointer-events-none absolute inset-0 rounded-full"
        />
      ) : null}
      <span aria-hidden>{glyph}</span>
      <span aria-hidden>{t(badgeKey)}</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}
