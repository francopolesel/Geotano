import type { BazaPlay, BazaRecord, PlayerSlot, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { CallFeedbackBanner } from './CallFeedbackBanner';

/** CENTER zone: open-baza cards per owner, resolved-baza markers, call feedback. */
export interface TableZoneProps {
  openBazaPlays: readonly BazaPlay[];
  bazas: readonly BazaRecord[];
  mySlot: PlayerSlot;
  names: Record<PlayerSlot, string>;
  history: readonly TrucoEvent[];
}

export function TableZone({ openBazaPlays, bazas, mySlot, names, history }: TableZoneProps) {
  const { t } = useTranslation();
  const rivalSlot: PlayerSlot = mySlot === 'A' ? 'B' : 'A';
  const rivalPlay = openBazaPlays.find((p) => p.player === rivalSlot);
  const myPlay = openBazaPlays.find((p) => p.player === mySlot);

  return (
    <div
      data-testid="truco-table-zone"
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-3"
    >
      {/* Call feedback persists here until superseded */}
      <div className="min-h-[1.5rem] w-full max-w-md">
        <CallFeedbackBanner history={history} names={names} />
      </div>

      {/* Current baza: rival above, mine below */}
      <div className="flex min-w-0 flex-wrap items-center justify-center gap-6">
        <div data-testid={`open-baza-${rivalSlot}-slot`}>
          {rivalPlay ? (
            <PlayingCard card={rivalPlay.card} size="lg" />
          ) : (
            <div className="aspect-[2/3] w-[clamp(3rem,11vw,4.25rem)] rounded-md border-2 border-dashed border-[var(--color-border)]" />
          )}
        </div>
        <div data-testid={`open-baza-${mySlot}-slot`}>
          {myPlay ? (
            <PlayingCard card={myPlay.card} size="lg" />
          ) : (
            <div className="aspect-[2/3] w-[clamp(3rem,11vw,4.25rem)] rounded-md border-2 border-dashed border-[var(--color-border)]" />
          )}
        </div>
      </div>

      {/* Resolved baza outcome markers (won by X / tied) */}
      {bazas.length > 0 ? (
        <div data-testid="baza-markers" className="flex min-w-0 flex-wrap items-center justify-center gap-1">
          {bazas.map((baza) => (
            <span
              key={baza.number}
              data-testid={`baza-marker-${baza.number}`}
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                baza.winner === null
                  ? 'bg-[var(--color-border)] text-[var(--color-muted-foreground)]'
                  : baza.winner === mySlot
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700',
              ].join(' ')}
            >
              {baza.number}: {baza.winner === null ? t('truco.baza.tied') : names[baza.winner]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
