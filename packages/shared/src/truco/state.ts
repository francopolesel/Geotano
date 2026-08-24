// ---------------------------------------------------------------------------
// Truco Argentino — explicit state machine table (spec: "Explicit state machine")
// ---------------------------------------------------------------------------
// S6 layering: depends downward only (types). The table is the single source
// of truth for which action types are even addressable per phase; guards in
// engine.ts narrow them further ("per windows above").

import type { PlayerSlot, TrucoActionType, TrucoPhase } from './types.js';

/**
 * Legal action types per phase, exactly as the requirement enumerates them.
 * Notes:
 * - `playing` lists the full envido/truco families; window guards decide
 *   executability at runtime.
 * - `truco_betting` includes the envido family because the responder may
 *   answer a pending truco by OPENING envido (Envido-before-Truco precedence).
 */
export const TRANSITIONS: Record<TrucoPhase, readonly TrucoActionType[]> = {
  waiting_for_players: ['start'],
  dealing: [],
  playing: [
    'play_card',
    'sing_envido',
    'sing_real_envido',
    'sing_falta_envido',
    'sing_truco',
    'sing_retruco',
    'sing_vale_cuatro',
  ],
  envido_betting: ['quiero', 'no_quiero', 'sing_envido', 'sing_real_envido', 'sing_falta_envido'],
  truco_betting: [
    'quiero',
    'no_quiero',
    'sing_retruco',
    'sing_vale_cuatro',
    'sing_envido',
    'sing_real_envido',
    'sing_falta_envido',
  ],
  hand_end: [],
  match_end: [],
};

export function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === 'A' ? 'B' : 'A';
}
