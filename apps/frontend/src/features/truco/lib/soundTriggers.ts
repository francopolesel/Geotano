// ---------------------------------------------------------------------------
// Truco CPU — event→sound mapping (pure) + store-gated sink adapter
// ---------------------------------------------------------------------------
// The mapping itself is pure so it stays trivially testable; the adapter is
// the only place that touches the audio helpers and the global sound gate.

import type { PlayerSlot, TrucoEvent } from '@geotano/shared';
import {
  playTrucoBazaWon,
  playTrucoCallEnvido,
  playTrucoCallTruco,
  playTrucoCardPlayed,
  playTrucoHandEnded,
  playTrucoMatchLost,
  playTrucoMatchWon,
  playTrucoNoQuiero,
  playTrucoQuiero,
} from '../../../lib/sounds';
import { useSoundStore } from '../../../store/soundStore';

export interface TrucoSoundSink {
  cardPlayed(): void;
  callEnvido(): void;
  callTruco(): void;
  quiero(): void;
  noQuiero(): void;
  bazaWon(): void;
  handEnded(): void;
  matchWon(): void;
  matchLost(): void;
}

const ENVIDO_FAMILY_CALLS = new Set(['sing_envido', 'sing_real_envido', 'sing_falta_envido']);

/** Maps one batch of engine events onto sound cues, in order. */
export function mapEventsToSounds(
  events: readonly TrucoEvent[],
  mySlot: PlayerSlot,
  sink: TrucoSoundSink,
): void {
  for (const event of events) {
    switch (event.type) {
      case 'card_played':
        sink.cardPlayed();
        break;
      case 'call_sung':
        if (ENVIDO_FAMILY_CALLS.has(event.call)) sink.callEnvido();
        else sink.callTruco();
        break;
      case 'answered':
        if (event.answer === 'quiero') sink.quiero();
        else sink.noQuiero();
        break;
      case 'baza_resolved':
        if (event.winner !== null) sink.bazaWon();
        break;
      case 'hand_ended':
        sink.handEnded();
        break;
      case 'match_ended':
        if (event.winner === mySlot) sink.matchWon();
        else sink.matchLost();
        break;
      default:
        break; // points_awarded / envido_showdown stay silent
    }
  }
}

/** Sink wired to the real audio helpers, gated by the persisted sound store. */
export function createSoundSink(): TrucoSoundSink {
  const enabled = () => useSoundStore.getState().soundEnabled;
  return {
    cardPlayed: () => {
      if (enabled()) playTrucoCardPlayed();
    },
    callEnvido: () => {
      if (enabled()) playTrucoCallEnvido();
    },
    callTruco: () => {
      if (enabled()) playTrucoCallTruco();
    },
    quiero: () => {
      if (enabled()) playTrucoQuiero();
    },
    noQuiero: () => {
      if (enabled()) playTrucoNoQuiero();
    },
    bazaWon: () => {
      if (enabled()) playTrucoBazaWon();
    },
    handEnded: () => {
      if (enabled()) playTrucoHandEnded();
    },
    matchWon: () => {
      if (enabled()) playTrucoMatchWon();
    },
    matchLost: () => {
      if (enabled()) playTrucoMatchLost();
    },
  };
}
