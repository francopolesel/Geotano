import { useEffect, useRef, useState } from 'react';
import type { CardId, PlayerSlot } from '@geotano/shared';
import { DECK_40 } from '@geotano/shared';
import { useTranslation } from 'react-i18next';
import { PlayingCard } from '../../../components/game/PlayingCard';
import { CrossIcon } from './icons';

/**
 * Mazo: decorative face-down deck stack on the felt edge plus an inspection
 * drawer. The count label is the number of cards NOT visible to the viewer
 * (undealt + rival's hidden hand) — public arithmetic over the redacted view,
 * never a reveal. The drawer shows MY hand enlarged and every card publicly
 * played this hand, grouped by player; undealt cards stay strictly face-down
 * with explicit copy (revealing them would leak information about the
 * opponent's possible holdings).
 */
export interface DeckProps {
  myHand: readonly CardId[];
  playedCards: Record<PlayerSlot, CardId[]>;
  names: Record<PlayerSlot, string>;
}

export function Deck({ myHand, playedCards, names }: DeckProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 40-card Spanish deck minus what I hold minus what is publicly on record.
  const unseen =
    DECK_40.length - myHand.length - playedCards.A.length - playedCards.B.length;

  // Focus the close button on open; Escape closes while open.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    // Return focus to the deck button so keyboard flow is not dropped.
    toggleRef.current?.focus();
  };

  const slots: PlayerSlot[] = ['A', 'B'];

  return (
    <>
      {/* Decorative stack: 2-3 offset face-down layers + unseen count */}
      <button
        type="button"
        ref={toggleRef}
        data-testid="truco-deck-button"
        aria-label={t('truco.deck.open')}
        aria-expanded={open}
        aria-controls="truco-deck-drawer"
        onClick={() => setOpen((value) => !value)}
        className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] hover:bg-black/20"
      >
        <span className="relative block h-9 w-8" aria-hidden>
          <span className="absolute left-1 top-0 -rotate-6">
            <PlayingCard faceDown size="sm" />
          </span>
          <span className="absolute left-0 top-0.5 rotate-3">
            <PlayingCard faceDown size="sm" />
          </span>
        </span>
        <span
          data-testid="truco-deck-count"
          className="rounded-full border border-white/25 bg-black/30 px-1.5 py-px text-[9px] font-semibold tabular-nums text-white/85 sm:text-[10px]"
        >
          {unseen} {t('truco.deck.unseen')}
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-stretch sm:justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={t('truco.deck.title')}
        >
          {/* Backdrop tap closes */}
          <button
            type="button"
            aria-label={t('truco.deck.close')}
            onClick={close}
            className="absolute inset-0 h-full w-full cursor-default bg-black/40"
          />

          {/* Mobile: capped bottom sheet (never covers the action bar's
              controls for long) · Desktop: right-side panel */}
          <div
            id="truco-deck-drawer"
            data-testid="truco-deck-drawer"
            className={[
              'animate-truco-panel-in relative flex max-h-[72dvh] w-full flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl pb-safe-bottom',
              'sm:max-h-none sm:h-full sm:w-80 sm:max-w-xs sm:rounded-none sm:rounded-l-2xl sm:pb-0',
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <p className="text-sm font-bold text-[var(--color-foreground)]">
                {t('truco.deck.title')}
              </p>
              <button
                type="button"
                ref={closeRef}
                data-testid="truco-deck-close"
                aria-label={t('truco.deck.close')}
                onClick={close}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              >
                <CrossIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {/* MY hand, enlarged for orejeo-style inspection */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)]">
                {t('truco.hand.label')}
              </p>
              <div className="mb-4 mt-2 flex flex-wrap items-center gap-2">
                {myHand.map((card) => (
                  <PlayingCard key={card} card={card} size="lg" />
                ))}
              </div>

              {/* Publicly played cards, grouped by who played them */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)]">
                {t('truco.deck.playedTitle')}
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {slots.map((slot) => (
                  <div key={slot}>
                    <p className="text-xs font-semibold text-[var(--color-foreground)]">
                      {names[slot]}
                    </p>
                    {playedCards[slot].length === 0 ? (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                        {t('truco.deck.nonePlayed')}
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {playedCards[slot].map((card) => (
                          <PlayingCard key={card} card={card} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Face-down remainder — identities are NEVER revealed */}
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)]">
                {t('truco.deck.stackTitle')}
              </p>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
                <span className="relative block h-12 w-11 shrink-0" aria-hidden>
                  <span className="absolute left-2 top-0 -rotate-6">
                    <PlayingCard faceDown size="sm" />
                  </span>
                  <span className="absolute left-1 top-1 rotate-2">
                    <PlayingCard faceDown size="sm" />
                  </span>
                  <span className="absolute left-0 top-2 rotate-6">
                    <PlayingCard faceDown size="sm" />
                  </span>
                </span>
                <p className="text-xs leading-snug text-[var(--color-muted-foreground)]">
                  {t('truco.deck.hidden', { n: unseen })}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
