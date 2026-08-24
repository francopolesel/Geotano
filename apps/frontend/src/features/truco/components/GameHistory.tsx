import { useEffect, useState } from 'react';
import type { CardId, EnvidoCall, PlayerSlot, TrucoCall, TrucoEvent } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { CrossIcon, HistoryIcon } from './icons';

/**
 * Discreet collapsible match-history log (batch 3).
 *
 * Collapsed by DEFAULT — always — so it never competes with the table. The
 * toggle lives in the table header; expanding opens an overlay drawer
 * (right-side panel on desktop, bottom sheet above the safe area on mobile).
 * Open/closed state is component-local only (deliberately not persisted).
 *
 * Entries are engine events mapped to human copy via i18n, newest first,
 * capped to the last MAX_VISIBLE events for performance.
 */

const MAX_VISIBLE = 50;

const CALL_KEYS: Record<EnvidoCall | TrucoCall, string> = {
  sing_envido: 'truco.call.envido',
  sing_real_envido: 'truco.call.realEnvido',
  sing_falta_envido: 'truco.call.faltaEnvido',
  sing_truco: 'truco.call.truco',
  sing_retruco: 'truco.call.retruco',
  sing_vale_cuatro: 'truco.call.valeCuatro',
};

/** Sota/Caballo/Rey for face cards, plain number otherwise. */
function rankLabel(rank: number, t: (key: string) => string): string {
  if (rank === 10) return t('truco.card.sota');
  if (rank === 11) return t('truco.card.caballo');
  if (rank === 12) return t('truco.card.rey');
  return String(rank);
}

/** Parses a `{rank}{suit}` card id into its display parts. */
function parseCard(card: CardId): { rank: string; suitKey: string } | null {
  const match = /^(1[012]|[1-7])(oro|copa|espada|basto)$/.exec(card);
  if (!match) return null;
  return { rank: match[1]!, suitKey: `truco.suit.${match[2]!}` };
}

/** Tone class per event kind, mirroring the table's color language. */
function toneClass(event: TrucoEvent, mySlot: PlayerSlot): string {
  switch (event.type) {
    case 'call_sung':
      return 'text-amber-600 dark:text-amber-400';
    case 'answered':
      return event.answer === 'quiero'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';
    case 'baza_resolved':
    case 'hand_ended':
    case 'match_ended':
      return 'winner' in event && event.winner === mySlot
        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
        : 'winner' in event && event.winner !== null
          ? 'text-[var(--color-muted-foreground)]'
          : 'text-[var(--color-muted-foreground)]';
    case 'points_awarded':
      return 'font-semibold text-[var(--color-foreground)]';
    case 'envido_showdown':
      return 'tabular-nums text-[var(--color-foreground)]';
    default:
      return 'text-[var(--color-muted-foreground)]';
  }
}

export interface GameHistoryProps {
  /** Full public engine event log for the match. */
  history: readonly TrucoEvent[];
  mySlot: PlayerSlot;
  names: Record<PlayerSlot, string>;
}

export function GameHistory({ history, mySlot, names }: GameHistoryProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Escape closes while open (same affordance as the invite banner/lightbox);
  // the listener only exists while the overlay is up and is cleaned on
  // unmount/close so a closed log never swallows key presses.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Newest at top; hard cap so a very long match never renders unbounded DOM.
  const visible = history.slice(-MAX_VISIBLE);
  const entries = visible
    .map((event, index) => ({ event, key: visible.length - index }))
    .reverse();

  const renderEntry = (event: TrucoEvent) => {
    switch (event.type) {
      case 'card_played': {
        const parts = parseCard(event.card);
        if (!parts) return null;
        return t('truco.history.playedCard', {
          name: names[event.player],
          rank: rankLabel(Number(parts.rank), t),
          suit: t(parts.suitKey),
        });
      }
      case 'call_sung':
        return t('truco.history.sang', {
          name: names[event.actor],
          call: t(CALL_KEYS[event.call]),
        });
      case 'answered':
        return t(
          event.answer === 'quiero' ? 'truco.history.quiero' : 'truco.history.noQuiero',
          { name: names[event.player] },
        );
      case 'envido_showdown':
        return t('truco.history.showdown', {
          a: event.values.A,
          b: event.values.B,
          winner: names[event.winner],
        });
      case 'baza_resolved':
        return event.winner === null
          ? t('truco.history.bazaTied', { n: event.baza })
          : event.winner === mySlot
            ? t('truco.history.bazaMine', { n: event.baza })
            : t('truco.history.bazaRival', { name: names[event.winner], n: event.baza });
      case 'points_awarded':
        return t('truco.history.points', { amount: event.amount, name: names[event.side] });
      case 'hand_ended':
        return event.winner === mySlot
          ? t('truco.history.handMine')
          : t('truco.history.handRival', { name: names[event.winner] });
      case 'match_ended':
        return event.winner === mySlot
          ? t('truco.history.matchWin')
          : t('truco.history.matchLose', { name: names[event.winner] });
      default:
        return null;
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="truco-history-toggle"
        aria-expanded={open}
        aria-controls="truco-history-panel"
        onClick={() => setOpen((value) => !value)}
        className={[
          'flex min-h-[32px] shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
          open
            ? 'border-white/40 bg-black/30 text-white'
            : 'border-white/20 bg-black/20 text-white/80 hover:border-white/40 hover:text-white',
        ].join(' ')}
      >
        <HistoryIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t('truco.history.toggle')}</span>
        <span className="sr-only sm:hidden">{t('truco.history.toggle')}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t('truco.history.title')}
        >
          {/* Backdrop tap closes — the log must never trap the player */}
          <button
            type="button"
            aria-label={t('truco.history.close')}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />

          {/* Mobile: bottom sheet · Desktop: right-side panel */}
          <div
            id="truco-history-panel"
            data-testid="truco-history-panel"
            className={[
              'animate-truco-panel-in relative flex max-h-[72dvh] w-full flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl pb-safe-bottom',
              'sm:max-h-none sm:h-full sm:w-80 sm:max-w-xs sm:rounded-none sm:rounded-l-2xl sm:pb-0',
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--color-foreground)]">
                {t('truco.history.title')}
              </p>
              <button
                type="button"
                data-testid="truco-history-close"
                aria-label={t('truco.history.close')}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                <CrossIcon className="h-5 w-5" />
              </button>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto px-4">
              {entries.length === 0 ? (
                <li className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  {t('truco.history.empty')}
                </li>
              ) : (
                entries.map(({ event, key }) => {
                  const copy = renderEntry(event);
                  if (!copy) return null;
                  return (
                    <li
                      key={key}
                      data-testid="truco-history-entry"
                      className={['py-2 text-xs leading-snug', toneClass(event, mySlot)].join(' ')}
                    >
                      {copy}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
