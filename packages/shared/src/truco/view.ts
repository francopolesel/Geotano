// ---------------------------------------------------------------------------
// Truco Argentino — per-viewer redacted DTOs (D9) + CPU firewall input (D10)
// ---------------------------------------------------------------------------
// S6 layering: depends downward only (types + state). Builders WHITELIST
// public fields; hidden info (opponent hand, deck order, private bet
// internals) never enters these objects by construction.

import { otherSlot } from './state.js';
import type {
  CpuDecisionInput,
  PlayerSlot,
  TrucoPublicContext,
  TrucoState,
  TrucoView,
} from './types.js';

/** Public, redaction-safe projection for one viewer (input to legalActions). */
export function toPublicContext(state: TrucoState, viewer: PlayerSlot): TrucoPublicContext {
  return {
    phase: state.phase,
    playerToAct: state.playerToAct,
    mano: state.mano,
    targetPoints: state.targetPoints,
    scores: { ...state.scores },
    bazaNumber: Math.min(state.bazas.length + 1, 3),
    bazaLeader: state.bazaLeader,
    openBazaPlays: state.openBazaPlays.map((p) => ({ ...p })),
    cardsPlayedThisHand: state.playedCards.A.length + state.playedCards.B.length,
    myHand: [...state.hands[viewer]],
    opponentHandCount: state.hands[otherSlot(viewer)].length,
    envidoAwaiting: state.envido
      ? {
          responder: state.envido.awaitingResponder,
          falta: state.envido.falta,
          realRaised: state.envido.realRaised,
        }
      : null,
    trucoAwaiting: state.truco
      ? { responder: state.truco.responder, level: state.truco.level }
      : null,
    trucoAcceptedThisHand: state.trucoAccepted,
    envidoClosed: state.envidoClosed,
    acceptedTrucoLevel: state.trucoLevel,
  };
}

/** REST DTO: own hand full, opponent hand as a count, public info identical. */
export function buildView(state: TrucoState, viewer: PlayerSlot): TrucoView {
  return {
    ...toPublicContext(state, viewer),
    handNumber: state.handNumber,
    playedCards: { A: [...state.playedCards.A], B: [...state.playedCards.B] },
    bazas: state.bazas.map((b) => ({ ...b, plays: [...b.plays] })),
    history: [...state.history],
    ...(state.winner ? { winner: state.winner } : {}),
  };
}

/**
 * CPU firewall DTO (D10): structurally omits opponentHand / deckRemaining /
 * private bet substates. `winner` is always present (null pre-match-end).
 */
export function buildCpuDecisionInput(state: TrucoState, cpuSlot: PlayerSlot): CpuDecisionInput {
  return {
    ...toPublicContext(state, cpuSlot),
    handNumber: state.handNumber,
    playedCards: { A: [...state.playedCards.A], B: [...state.playedCards.B] },
    bazas: state.bazas.map((b) => ({ ...b, plays: [...b.plays] })),
    history: [...state.history],
    winner: state.winner,
  };
}
