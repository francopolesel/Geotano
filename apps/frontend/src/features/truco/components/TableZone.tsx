import type { BazaPlay, BazaRecord, PlayerSlot, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { CallFeedbackBanner } from './CallFeedbackBanner';

/**
 * CENTER zone over the felt: call feedback, the open-baza plays (rival's
 * card sits top-center, mine bottom-center, facing each other), embossed
 * empty-slot silhouettes, resolved-baza outcome pips and a brief CSS-only
 * highlight on whichever slot won the latest baza.
 */
export interface TableZoneProps {
  openBazaPlays: readonly BazaPlay[];
  bazas: readonly BazaRecord[];
  mySlot: PlayerSlot;
  names: Record<PlayerSlot, string>;
  history: readonly TrucoEvent[];
}

/** Embossed card-outline silhouette shown while the slot is empty. */
function CardSilhouette() {
  return (
    <div
      aria-hidden
      className="aspect-[2/3] w-[clamp(3rem,11vw,4.25rem)] rounded-md border border-white/25 bg-black/15 shadow-[inset_0_1px_4px_rgb(0_0_0/0.35)]"
    />
  );
}

export function TableZone({ openBazaPlays, bazas, mySlot, names, history }: TableZoneProps) {
  const { t } = useTranslation();
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  const rivalPlay = openBazaPlays.find((p) => p.player === rivalSlot);
  const myPlay = openBazaPlays.find((p) => p.player === mySlot);

  // Latest resolved baza drives the ~600ms winning-slot ring pulse (pure CSS,
  // restarted per resolution via the keyed overlay below).
  const lastBaza = bazas.length > 0 ? bazas[bazas.length - 1] : undefined;
  const pulseWinner: PlayerSlot | null = lastBaza?.winner ?? null;

  return (
    <div
      data-testid="truco-table-zone"
      className="flex min-w-0 flex-1 flex-col items-center justify-between gap-3 px-3 py-3"
    >
      {/* Call feedback persists here until superseded */}
      <div className="min-h-[1.5rem] w-full max-w-md">
        <CallFeedbackBanner history={history} names={names} />
      </div>

      {/* Current baza: rival above, mine below, facing each other */}
      <div className="flex min-w-0 flex-col items-center justify-center gap-1">
        {/* Rival play (top-center) */}
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
            {names[rivalSlot]}
          </span>
          <div className="relative" data-testid={`open-baza-${rivalSlot}-slot`}>
            {rivalPlay ? (
              <PlayingCard card={rivalPlay.card} size="lg" />
            ) : (
              <CardSilhouette />
            )}
            {pulseWinner === rivalSlot && lastBaza ? (
              <span
                key={`pulse-r-${lastBaza.number}`}
                aria-hidden
                data-testid={`baza-win-pulse-${rivalSlot}`}
                className="animate-truco-win-pulse pointer-events-none absolute inset-0 rounded-lg"
              />
            ) : null}
          </div>
        </div>

        {/* My play (bottom-center) */}
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <div className="relative" data-testid={`open-baza-${mySlot}-slot`}>
            {myPlay ? (
              <PlayingCard card={myPlay.card} size="lg" />
            ) : (
              <CardSilhouette />
            )}
            {pulseWinner === mySlot && lastBaza ? (
              <span
                key={`pulse-m-${lastBaza.number}`}
                aria-hidden
                data-testid={`baza-win-pulse-${mySlot}`}
                className="animate-truco-win-pulse pointer-events-none absolute inset-0 rounded-lg"
              />
            ) : null}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
            {names[mySlot]}
          </span>
        </div>
      </div>

      {/* Resolved baza outcome pips: emerald won / red lost / half-tone tied */}
      {bazas.length > 0 ? (
        <div data-testid="baza-markers" className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
          {bazas.map((baza) => {
            const resultKey =
              baza.winner === null
                ? 'truco.baza.tied'
                : baza.winner === mySlot
                  ? 'truco.baza.won'
                  : 'truco.baza.lost';
            const title = `${t('truco.baza.label', { n: baza.number })}: ${
              baza.winner !== null && baza.winner !== mySlot ? names[baza.winner] : t(resultKey)
            }`;
            return (
              <span
                key={baza.number}
                data-testid={`baza-marker-${baza.number}`}
                title={title}
                className="flex items-center"
              >
                <span
                  aria-hidden
                  className={[
                    'h-3 w-3 rounded-full border border-white/40',
                    baza.winner === null
                      ? 'bg-gradient-to-r from-emerald-500 to-red-400'
                      : baza.winner === mySlot
                        ? 'bg-emerald-500'
                        : 'bg-red-400/80',
                  ].join(' ')}
                />
                {/* Screen-reader + test-visible outcome kept textual */}
                <span className="sr-only">{title}</span>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
