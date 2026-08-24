// ---------------------------------------------------------------------------
// Truco — shared turn-query rule (remediation #14a)
// ---------------------------------------------------------------------------
// ONE presentation-only derivation of "the rival owes the next move" from
// PUBLIC fields — zero rules logic (legality itself stays engine-owned via
// legalActions). TrucoTable and any other surface consume this instead of
// re-deriving the phase/bet ternary chain locally.

import type { PlayerSlot, TrucoPublicContext } from '@geotano/shared';

/**
 * True when the given seat is NOT the one owing the next action: an open bet
 * awaiting the other responder, or (plain playing) the rival's card-play turn.
 */
export function isAwaitingOpponent(ctx: TrucoPublicContext, mySlot: PlayerSlot): boolean {
  if (ctx.envidoAwaiting != null) return ctx.envidoAwaiting.responder !== mySlot;
  if (ctx.trucoAwaiting != null) return ctx.trucoAwaiting.responder !== mySlot;
  return ctx.phase === 'playing' && ctx.playerToAct !== mySlot;
}
