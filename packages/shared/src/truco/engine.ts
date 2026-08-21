// ---------------------------------------------------------------------------
// Truco Argentino — pure rules engine (D2–D5)
// ---------------------------------------------------------------------------
// S6 layering: sits ON TOP of every other module. No I/O, no Math.random,
// no Date.now — randomness enters only via an injected Rng at deal boundaries.
//
// Contract:
// - `applyAction` never throws for illegal GAME actions; it returns a typed
//   rejection naming an E_* code and the ORIGINAL state reference untouched.
// - Successful transitions return a NEW state object (clone-on-write).
// - When a hand ends and the match continues, the next hand is dealt inside
//   the SAME result — this requires `deps.rng`; omitting it there is a
//   programmer error and throws.

import { DECK_40, shuffle } from './deck.js';
import { compareCards } from './hierarchy.js';
import { ERROR_MESSAGES, type TrucoErrorCode } from './errors.js';
import { otherSlot, TRANSITIONS } from './state.js';
import type {
  AwardReason,
  CreateMatchOptions,
  PlayerSlot,
  Rng,
  TrucoAction,
  TrucoActionType,
  TrucoEvent,
  TrucoPhase,
  TrucoState,
} from './types.js';

/** Optional engine dependencies. `rng` is required when a hand must be dealt. */
export type ApplyDeps = { rng?: Rng };

/** Result type per D4. Rejections additionally carry the ORIGINAL,
 * untouched state reference back (spec: "the returned state deep-equals the
 * pre-action state") — an additive field over the D4 sketch. */
export type EngineResult =
  | { ok: true; state: TrucoState; events: TrucoEvent[] }
  | {
      ok: false;
      errorCode: TrucoErrorCode;
      message: string;
      /** Always the SAME reference passed in — proof of zero side effects. */
      state: TrucoState;
    };

const ENVIDO_CALLS: readonly TrucoActionType[] = [
  'sing_envido',
  'sing_real_envido',
  'sing_falta_envido',
];
const TRUCO_CALLS: readonly TrucoActionType[] = [
  'sing_truco',
  'sing_retruco',
  'sing_vale_cuatro',
];
const ANSWERS: readonly TrucoActionType[] = ['quiero', 'no_quiero'];

function actorOf(action: TrucoAction): PlayerSlot | undefined {
  return 'actor' in action ? action.actor : undefined;
}

/** Rejection carrying the untouched original state reference. */
function rejected(errorCode: TrucoErrorCode, state: TrucoState): EngineResult {
  return { ok: false, errorCode, message: ERROR_MESSAGES[errorCode], state };
}

function rejectForPhase(
  phase: TrucoPhase,
  actionType: TrucoActionType,
  state: TrucoState,
): EngineResult {
  if (phase === 'hand_end') {
    if (TRUCO_CALLS.includes(actionType)) return rejected('E_TRUCO_WINDOW_CLOSED', state);
    if (ENVIDO_CALLS.includes(actionType) || actionType === 'play_card') {
      return rejected('E_ENVIDO_WINDOW_CLOSED', state);
    }
  }
  if (ANSWERS.includes(actionType)) return rejected('E_NO_PENDING_BET', state);
  if (actionType === 'sing_retruco' || actionType === 'sing_vale_cuatro') {
    return rejected('E_NO_PENDING_BET', state);
  }
  return rejected('E_STATE_FORBIDDEN', state);
}

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

/** Deals a fresh hand INTO `state` (caller owns the clone). */
function dealHandInto(state: TrucoState, rng: Rng): void {
  const shuffled = shuffle(DECK_40, rng);
  state.hands = { A: shuffled.slice(0, 3), B: shuffled.slice(3, 6) };
  state.deckRemaining = shuffled.slice(6);
  state.playedCards = { A: [], B: [] };
  state.bazas = [];
  state.openBazaPlays = [];
  state.bazaLeader = state.mano;
  state.playerToAct = state.mano;
  state.envido = null;
  state.truco = null;
  state.parkedTruco = null;
  state.envidoClosed = false;
  state.trucoAccepted = false;
  state.trucoLevel = 1;
  state.handWinner = null;
  state.phase = 'playing';
}

/**
 * Create a match. Consumes rng ONLY here (mano derivation when unspecified +
 * initial shuffle). Concrete hands live inside the returned state.
 */
export function createMatch(options: CreateMatchOptions, rng: Rng): TrucoState {
  const targetPoints = options.targetPoints ?? 30;
  if (targetPoints !== 15 && targetPoints !== 30) {
    throw new Error(`Invalid targetPoints ${String(targetPoints)}: must be 15 or 30`);
  }
  const mano: PlayerSlot = options.mano ?? (rng() < 0.5 ? 'A' : 'B');
  const state: TrucoState = {
    targetPoints,
    mano,
    pie: otherSlot(mano),
    phase: 'waiting_for_players',
    playerToAct: mano,
    handNumber: 1,
    scores: { A: 0, B: 0 },
    hands: { A: [], B: [] },
    deckRemaining: [],
    playedCards: { A: [], B: [] },
    bazas: [],
    openBazaPlays: [],
    bazaLeader: mano,
    envido: null,
    truco: null,
    parkedTruco: null,
    envidoClosed: false,
    trucoAccepted: false,
    trucoLevel: 1,
    handWinner: null,
    winner: null,
    history: [],
  };
  dealHandInto(state, rng);
  return state;
}

// ---------------------------------------------------------------------------
// Scoring / hand conclusion
// ---------------------------------------------------------------------------

function award(
  state: TrucoState,
  side: PlayerSlot,
  amount: number,
  reason: AwardReason,
  events: TrucoEvent[],
): void {
  state.scores[side] += amount;
  const event: TrucoEvent = { type: 'points_awarded', side, amount, reason };
  state.history.push(event);
  events.push(event);
}

/**
 * Concludes the current hand: emits hand_ended, then either ends the match
 * (score >= target, inclusive) or auto-deals the next hand with swapped mano.
 * The caller must already have awarded any points for the hand.
 */
function concludeHand(state: TrucoState, winner: PlayerSlot, deps: ApplyDeps, events: TrucoEvent[]): void {
  state.handWinner = winner;
  const ended: TrucoEvent = { type: 'hand_ended', winner };
  state.history.push(ended);
  events.push(ended);

  if (state.scores[winner] >= state.targetPoints) {
    state.phase = 'match_end';
    state.winner = winner;
    const finished: TrucoEvent = { type: 'match_ended', winner, scores: { ...state.scores } };
    state.history.push(finished);
    events.push(finished);
    return;
  }

  // Match continues → rotate mano/pie and deal the next hand immediately.
  const nextMano = state.pie;
  state.mano = nextMano;
  state.pie = otherSlot(nextMano);
  state.handNumber += 1;
  if (!deps.rng) {
    throw new Error('applyAction: deps.rng is required to deal the next hand');
  }
  dealHandInto(state, deps.rng);
}

// ---------------------------------------------------------------------------
// Baza resolution + parda cascade (spec items 1–6)
// ---------------------------------------------------------------------------

/**
 * Hand outcome after N resolved bazas.
 * Returns the winning slot, or null when play must continue.
 */
function cascadeWinner(bazas: { winner: PlayerSlot | null }[], mano: PlayerSlot): PlayerSlot | null {
  const outcomes = bazas.map((b) => b.winner);
  const n = outcomes.length;

  if (n === 2) {
    const [o1, o2] = outcomes as [PlayerSlot | null, PlayerSlot | null];
    // Items 1–3: decided by the first two bazas in these shapes.
    if (o1 && o2 && o1 === o2) return o1; // won both (item 1)
    if (o1 && !o2) return o1; // won b1, parda b2 (item 3)
    if (!o1 && o2) return o2; // parda b1, won b2 (item 2)
    return null; // split or double parda → decider
  }

  if (n === 3) {
    // Item 5: earliest untied baza wins; item 6: all parda → mano.
    return outcomes.find((o) => o !== null) ?? mano;
  }

  return null; // after baza 1 play always continues
}

function resolveBaza(state: TrucoState, events: TrucoEvent[], deps: ApplyDeps): void {
  const [p0, p1] = state.openBazaPlays;
  const outcome = compareCards(p0!.card, p1!.card);
  const number = (state.bazas.length + 1) as 1 | 2 | 3;
  const winner =
    outcome === 'win1' ? p0!.player : outcome === 'win2' ? p1!.player : null;

  state.bazas.push({ number, plays: [...state.openBazaPlays], winner });
  const resolved: TrucoEvent = { type: 'baza_resolved', baza: number, winner };
  state.history.push(resolved);
  events.push(resolved);
  state.openBazaPlays = [];

  const decided = cascadeWinner(state.bazas, state.mano);
  if (decided !== null) {
    award(state, decided, state.trucoLevel, 'hand_prize', events);
    concludeHand(state, decided, deps, events);
    return;
  }

  // Continue: winner of a baza leads the next; a parda keeps the leader.
  const lastWinner = state.bazas[state.bazas.length - 1]!.winner;
  state.bazaLeader = lastWinner ?? state.bazaLeader;
  state.playerToAct = state.bazaLeader;
}

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

export function applyAction(state: TrucoState, action: TrucoAction, deps: ApplyDeps = {}): EngineResult {
  const actor = actorOf(action);
  if (actor !== undefined && actor !== 'A' && actor !== 'B') {
    return rejected('E_NOT_PARTICIPANT', state);
  }
  if (state.phase === 'match_end') {
    return rejected('E_MATCH_FINISHED', state);
  }
  if (!TRANSITIONS[state.phase].includes(action.type)) {
    return rejectForPhase(state.phase, action.type, state);
  }

  const events: TrucoEvent[] = [];

  switch (action.type) {
    case 'start': {
      if (state.phase !== 'waiting_for_players' || !deps.rng) {
        throw new Error('applyAction: start requires phase waiting_for_players and deps.rng');
      }
      const next = structuredClone(state);
      dealHandInto(next, deps.rng);
      return { ok: true, state: next, events };
    }

    case 'play_card': {
      const card = action.card;
      if (action.actor !== state.playerToAct) return rejected('E_OUT_OF_TURN', state);
      if (state.playedCards[action.actor].includes(card)) {
        return rejected('E_CARD_ALREADY_PLAYED', state);
      }
      if (!state.hands[action.actor].includes(card)) return rejected('E_CARD_NOT_OWNED', state);

      const next = structuredClone(state);
      const hand = next.hands[action.actor];
      hand.splice(hand.indexOf(card), 1);
      next.playedCards[action.actor].push(card);
      next.openBazaPlays.push({ player: action.actor, card });
      const played: TrucoEvent = { type: 'card_played', player: action.actor, card };
      next.history.push(played);
      events.push(played);

      if (next.openBazaPlays.length === 2) {
        resolveBaza(next, events, deps);
      } else {
        next.playerToAct = otherSlot(action.actor);
      }
      return { ok: true, state: next, events };
    }

    default:
      // Envido/truco betting handlers are layered in dedicated slices.
      return rejectForPhase(state.phase, action.type, state);
  }
}
