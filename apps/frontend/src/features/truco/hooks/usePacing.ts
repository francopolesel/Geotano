import { useEffect, useRef, useState } from 'react';
import type { TrucoEvent, TrucoView } from '@geotano/shared';
import { GAME_TIMING, reduceMotion } from '../lib/GAME_TIMING';

/**
 * usePacing — the presentation sequencer for a truco match (design C1/C2/E1,
 * tasks B3-T3).
 *
 * It owns three pacing concerns plus a freeze switch:
 *
 *  - `dealState`  : blocks playability right after a hand is dealt, releasing
 *                   after the `cardDeal` delay so cards appear to be laid one
 *                   by one instead of the board being instantly live.
 *  - `bazaState`  : holds the reveal gate open for `trickReveal` after a baza
 *                   resolves so the winner has time to register before the
 *                   next baza activates.
 *  - `handEndOpen`: derived from the EVENT LOG, never from `phase`. The engine
 *                   never rests in `hand_end` — it auto-deals the next hand, so
 *                   gating on `phase === 'hand_end'` would never fire. We open
 *                   the panel when a `hand_ended` is the latest relevant event,
 *                   and we RELEASE it via `advanceHandEnd()` even while the next
 *                   hand is already dealt underneath (C3-M).
 *  - `paused`     : while the hand-end panel is open we FREEZE the incoming,
 *                   already-dealt `playing` state so the player cannot act on
 *                   cards they haven't been told about yet.
 *
 * `advanceHandEnd()` is a PURE UI release: it closes the panel and unpauses
 * without issuing any engine action (there is no continue/resume engine call).
 */

export interface UsePacingOptions {
  view: TrucoView;
}

export interface UsePacingResult {
  /** Gating flags for the table renderer. */
  dealState: boolean;
  bazaState: boolean;
  /** Whether the hand-end panel should be shown. */
  handEndOpen: boolean;
  /** Freeze input while the hand-end panel is open. */
  paused: boolean;
  /** Close the panel + unpause. Pure UI — no engine action. */
  advanceHandEnd: () => void;
}

/** Index of the most recent event of a given type (discriminant), or -1. */
function lastIndexOfType(history: TrucoEvent[], type: TrucoEvent['type']): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.type === type) return i;
  }
  return -1;
}

/**
 * Pure predicate reused by the table renderer: true when a hand has ended and
 * no match has ended AFTER it (i.e. the banner should show, not the end screen).
 */
export function hasHandEndedWithoutMatchEnd(history: TrucoEvent[]): boolean {
  const handEnd = lastIndexOfType(history, 'hand_ended');
  const matchEnd = lastIndexOfType(history, 'match_ended');
  return handEnd >= 0 && handEnd > matchEnd;
}

export function usePacing({ view }: UsePacingOptions): UsePacingResult {
  // ---- dealState: gate playability after a hand is dealt ----
  const [dealState, setDealState] = useState(true);
  useEffect(() => {
    setDealState(true);
    const delay = reduceMotion() ? 0 : GAME_TIMING.cardDeal;
    if (delay <= 0) {
      setDealState(false);
      return;
    }
    const timer = setTimeout(() => setDealState(false), delay);
    return () => clearTimeout(timer);
  }, [view.handNumber]);

  // ---- bazaState: hold the reveal gate after a baza resolves ----
  const bazaCount = view.history.filter((e) => e.type === 'baza_resolved').length;
  const [bazaState, setBazaState] = useState(false);
  useEffect(() => {
    if (bazaCount === 0) {
      setBazaState(false);
      return;
    }
    setBazaState(true);
    const delay = reduceMotion() ? 0 : GAME_TIMING.trickReveal;
    if (delay <= 0) {
      setBazaState(false);
      return;
    }
    const timer = setTimeout(() => setBazaState(false), delay);
    return () => clearTimeout(timer);
  }, [bazaCount]);

  // ---- handEndOpen: event-derived, delayed by handEndDisplay, manually releasable ----
  const [handEndOpen, setHandEndOpen] = useState(false);
  const dismissedRef = useRef(-1);
  const handEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastHandEnd = lastIndexOfType(view.history, 'hand_ended');
  const matchEndAfter = lastIndexOfType(view.history, 'match_ended') > lastHandEnd;

  useEffect(() => {
    // Clear any pending timer when dependencies change
    if (handEndTimerRef.current) {
      clearTimeout(handEndTimerRef.current);
      handEndTimerRef.current = null;
    }

    if (matchEndAfter) {
      setHandEndOpen(false);
      return;
    }

    if (lastHandEnd > dismissedRef.current) {
      // New hand ended - start the display delay before showing the panel
      const delay = reduceMotion() ? 0 : GAME_TIMING.handEndDisplay;
      if (delay <= 0) {
        setHandEndOpen(true);
      } else {
        handEndTimerRef.current = setTimeout(() => {
          // Only open if this hand_end is still the latest (not superseded by a new hand)
          const currentLastHandEnd = lastIndexOfType(view.history, 'hand_ended');
          if (currentLastHandEnd === lastHandEnd && currentLastHandEnd > dismissedRef.current) {
            setHandEndOpen(true);
          }
        }, delay);
      }
    }

    return () => {
      if (handEndTimerRef.current) {
        clearTimeout(handEndTimerRef.current);
        handEndTimerRef.current = null;
      }
    };
  }, [lastHandEnd, matchEndAfter]);

  const advanceHandEnd = () => {
    if (lastHandEnd >= 0) dismissedRef.current = lastHandEnd;
    setHandEndOpen(false);
    if (handEndTimerRef.current) {
      clearTimeout(handEndTimerRef.current);
      handEndTimerRef.current = null;
    }
  };

  return {
    dealState,
    bazaState,
    handEndOpen,
    paused: handEndOpen,
    advanceHandEnd,
  };
}
