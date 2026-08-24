// ---------------------------------------------------------------------------
// Truco Argentino — legal action enumeration (spec: "Explicit state machine")
// ---------------------------------------------------------------------------
// Mirrors the TRANSITIONS windows: phase cases + window guards evaluated over
// the PUBLIC context only — never hidden information. Returned player-actions
// carry `actor` prefilled so they are directly applicable via applyAction.

import type { PlayerSlot, TrucoAction, TrucoPublicContext } from './types.js';

export function legalActions(ctx: TrucoPublicContext, playerId: PlayerSlot): TrucoAction[] {
  switch (ctx.phase) {
    case 'waiting_for_players':
      return [{ type: 'start' }];

    case 'dealing':
    case 'hand_end':
    case 'match_end':
      return [];

    case 'playing': {
      if (playerId !== ctx.playerToAct) return [];
      const actions: TrucoAction[] = ctx.myHand.map((card) => ({
        type: 'play_card',
        actor: playerId,
        card,
      }));
      // Envido window: no card played, no accepted truco, betting not closed.
      if (!ctx.envidoClosed && !ctx.trucoAcceptedThisHand && ctx.cardsPlayedThisHand === 0) {
        actions.push(
          { type: 'sing_envido', actor: playerId },
          { type: 'sing_real_envido', actor: playerId },
          { type: 'sing_falta_envido', actor: playerId },
        );
      }
      if (!ctx.trucoAcceptedThisHand && ctx.acceptedTrucoLevel === 1) {
        actions.push({ type: 'sing_truco', actor: playerId });
      }
      return actions;
    }

    case 'envido_betting': {
      const awaiting = ctx.envidoAwaiting;
      if (!awaiting || awaiting.responder !== playerId) return [];
      const out: TrucoAction[] = [
        { type: 'quiero', actor: playerId },
        { type: 'no_quiero', actor: playerId },
      ];
      if (!awaiting.falta) {
        if (!awaiting.realRaised) out.push({ type: 'sing_envido', actor: playerId });
        out.push({ type: 'sing_real_envido', actor: playerId });
        out.push({ type: 'sing_falta_envido', actor: playerId });
      }
      return out;
    }

    case 'truco_betting': {
      const awaiting = ctx.trucoAwaiting;
      if (!awaiting || awaiting.responder !== playerId) return [];
      const out: TrucoAction[] = [
        { type: 'quiero', actor: playerId },
        { type: 'no_quiero', actor: playerId },
      ];
      if (awaiting.level === 2) out.push({ type: 'sing_retruco', actor: playerId });
      if (awaiting.level === 3) out.push({ type: 'sing_vale_cuatro', actor: playerId });
      // Envido-before-Truco precedence while the envido window is open.
      if (!ctx.envidoClosed && ctx.cardsPlayedThisHand === 0) {
        out.push(
          { type: 'sing_envido', actor: playerId },
          { type: 'sing_real_envido', actor: playerId },
          { type: 'sing_falta_envido', actor: playerId },
        );
      }
      return out;
    }
  }
}
