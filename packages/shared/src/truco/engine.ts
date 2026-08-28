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
import { computeEnvido } from './envido.js';
import { compareCards } from './hierarchy.js';
import { ERROR_MESSAGES, type TrucoErrorCode } from './errors.js';
import { otherSlot, TRANSITIONS } from './state.js';
import type {
  AwardReason,
  CreateMatchOptions,
  EnvidoCall,
  PlayerSlot,
  Rng,
  TrucoAction,
  TrucoActionType,
  TrucoCall,
  TrucoEvent,
  TrucoPendingBet,
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

// Envido stake values, spec-pinned (specs/truco-engine/spec.md "Envido betting
// chain and exact stake matrix"): first bets envido=2 / realEnvido=3, raises
// add +2 / +3 respectively. faltaEnvido carries no numeric stake here — its
// payout is computed at settlement from the target.
const ENVIDO_STAKE = 2;
const REAL_ENVIDO_STAKE = 3;
const ANSWERS: readonly TrucoActionType[] = ['quiero', 'no_quiero'];

function actorOf(action: TrucoAction): PlayerSlot | undefined {
  return 'actor' in action ? action.actor : undefined;
}

function isEnvidoCall(type: TrucoActionType): type is EnvidoCall {
  return type === 'sing_envido' || type === 'sing_real_envido' || type === 'sing_falta_envido';
}

function isTrucoSing(type: TrucoActionType): type is TrucoCall {
  return type === 'sing_truco' || type === 'sing_retruco' || type === 'sing_vale_cuatro';
}

function cardsPlayedThisHand(state: TrucoState): number {
  return state.playedCards.A.length + state.playedCards.B.length;
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
    if (ENVIDO_CALLS.includes(actionType)) return rejected('E_ENVIDO_WINDOW_CLOSED', state);
    if (actionType === 'play_card') return rejected('E_STATE_FORBIDDEN', state);
  }
  // A card is never an implicit answer: any open bet blocks play first.
  if (
    actionType === 'play_card' &&
    (phase === 'envido_betting' || phase === 'truco_betting')
  ) {
    return rejected('E_AWAITING_OWN_BET', state);
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

    case 'sing_envido':
    case 'sing_real_envido':
    case 'sing_falta_envido':
      return singEnvido(state, action, events);

    case 'sing_truco':
      return singTruco(state, action, events);

    case 'sing_retruco':
    case 'sing_vale_cuatro':
      return raiseTruco(state, action, events);

    case 'quiero':
    case 'no_quiero':
      return answer(state, action, deps, events);
  }
}

// ---------------------------------------------------------------------------
// Envido betting (D5 chain model)
// ---------------------------------------------------------------------------

function pushCallSung(
  next: TrucoState,
  actor: PlayerSlot,
  call: EnvidoCall | TrucoCall,
  events: TrucoEvent[],
): void {
  const event: TrucoEvent = { type: 'call_sung', actor, call };
  next.history.push(event);
  events.push(event);
}

function openEnvido(
  next: TrucoState,
  caller: PlayerSlot,
  call: EnvidoCall,
  events: TrucoEvent[],
): void {
  next.envido = {
    stake: call === 'sing_envido' ? ENVIDO_STAKE : call === 'sing_real_envido' ? REAL_ENVIDO_STAKE : 0,
    priorStake: 0,
    awaitingResponder: otherSlot(caller),
    lastCaller: caller,
    falta: call === 'sing_falta_envido',
    realRaised: call === 'sing_real_envido',
  };
  next.phase = 'envido_betting';
  pushCallSung(next, caller, call, events);
}

/** Envido window: no card played this hand, no accepted truco, betting open. */
function envidoWindowError(state: TrucoState): TrucoErrorCode | null {
  if (state.envidoClosed) return 'E_ENVIDO_BETTING_CLOSED';
  if (cardsPlayedThisHand(state) > 0 || state.trucoAccepted) return 'E_ENVIDO_WINDOW_CLOSED';
  return null;
}

function singEnvido(state: TrucoState, action: Extract<TrucoAction, { actor: PlayerSlot }>, events: TrucoEvent[]): EngineResult {
  const type = action.type as EnvidoCall;

  if (state.phase === 'playing') {
    if (!isEnvidoCall(action.type)) return rejected('E_STATE_FORBIDDEN', state);
    const windowError = envidoWindowError(state);
    // Window closure outranks turn order: once envido is unavailable it is
    // unavailable to EVERYONE (determinism sweep pins this precedence).
    if (windowError) return rejected(windowError, state);
    // Opening is a bet initiation like sing_truco: only the seat owing the
    // next move may start one (server-authoritative anti-spoof parity).
    if (action.actor !== state.playerToAct) return rejected('E_OUT_OF_TURN', state);
    const next = structuredClone(state);
    openEnvido(next, action.actor, type, events);
    return { ok: true, state: next, events };
  }

  if (state.phase === 'truco_betting') {
    if (!isEnvidoCall(action.type)) return rejected('E_STATE_FORBIDDEN', state);
    const bet = state.truco!;
    // Only the challenged side may answer by opening envido; the singer must
    // wait for his own pending bet (explicit answers only).
    if (action.actor !== bet.responder) return rejected('E_AWAITING_OWN_BET', state);
    if (state.envidoClosed) return rejected('E_ENVIDO_BETTING_CLOSED', state);
    if (cardsPlayedThisHand(state) > 0) return rejected('E_ENVIDO_WINDOW_CLOSED', state);
    const next = structuredClone(state);
    next.parkedTruco = next.truco;
    next.truco = null;
    openEnvido(next, action.actor, type, events);
    return { ok: true, state: next, events };
  }

  // phase === 'envido_betting' → raise path.
  const env = state.envido!;
  if (action.actor !== env.awaitingResponder) return rejected('E_NOT_RESPONDER', state);
  // Defense-in-depth: legalActions never offers an answer to an already
  // answered bet, so this guard is unreachable through the UI — it exists for
  // direct/applyAction callers and future surfaces (synthetic reachability).
  if (env.answered) return rejected('E_ALREADY_ANSWERED', state);
  if (env.falta) return rejected('E_ILLEGAL_RAISE_ORDER', state); // falta is terminal
  if (type === 'sing_envido' && env.realRaised) return rejected('E_ILLEGAL_RAISE_ORDER', state);
  // A real envido cannot be called again once a real raise is already pending
  // (F1). Mirrors the sing_envido guard above; rejects with untouched state so
  // neither the stake nor the responder flips.
  if (type === 'sing_real_envido' && env.realRaised) return rejected('E_ILLEGAL_RAISE_ORDER', state);

  const next = structuredClone(state);
  const sub = next.envido!;
  sub.answered = false;
  sub.priorStake = sub.stake;
  if (type === 'sing_envido') {
    sub.stake += ENVIDO_STAKE;
  } else if (type === 'sing_real_envido') {
    sub.stake += REAL_ENVIDO_STAKE;
    sub.realRaised = true;
  } else {
    sub.falta = true;
  }
  sub.lastCaller = action.actor;
  sub.awaitingResponder = otherSlot(action.actor);
  pushCallSung(next, action.actor, type, events);
  return { ok: true, state: next, events };
}

/**
 * Settles an envido chain. Winner of the comparison takes the stake; ties go
 * to mano ("ganar de mano"). Falta pays target − max(scores) computed NOW.
 * Refusal pays prior accumulation (1 when refusing the first bet).
 */
function settleEnvido(next: TrucoState, answer: 'quiero' | 'no_quiero', deps: ApplyDeps, events: TrucoEvent[]): void {
  const env = next.envido!;
  const answeredEvent: TrucoEvent = {
    type: 'answered',
    player: env.awaitingResponder,
    answer,
    bet: 'envido',
  };
  next.history.push(answeredEvent);
  events.push(answeredEvent);
  next.envidoClosed = true;

  let beneficiary: PlayerSlot;
  if (answer === 'quiero') {
    const values = { A: computeEnvido(next.hands.A), B: computeEnvido(next.hands.B) };
    const winner: PlayerSlot =
      values.A === values.B ? next.mano : values.A > values.B ? 'A' : 'B';
    const showdown: TrucoEvent = { type: 'envido_showdown', values, winner };
    next.history.push(showdown);
    events.push(showdown);
    const amount = env.falta
      ? next.targetPoints - Math.max(next.scores.A, next.scores.B)
      : env.stake;
    award(next, winner, amount, 'envido_accepted', events);
    beneficiary = winner;
  } else {
    const payout = env.priorStake === 0 ? 1 : env.priorStake;
    award(next, env.lastCaller, payout, 'envido_refused', events);
    beneficiary = env.lastCaller;
  }
  next.envido = null;

  if (next.scores[beneficiary] >= next.targetPoints) {
    // The award ended the match → any parked truco is voided and the hand ends.
    next.parkedTruco = null;
    concludeHand(next, beneficiary, deps, events);
  } else if (next.parkedTruco) {
    // Pending truco resurfaces with the SAME responder (D5 precedence).
    next.truco = next.parkedTruco;
    next.parkedTruco = null;
    next.phase = 'truco_betting';
  } else {
    next.phase = 'playing';
  }
}

// ---------------------------------------------------------------------------
// Truco betting (open + accept; refusals/raises land in a dedicated slice)
// ---------------------------------------------------------------------------

function singTruco(state: TrucoState, action: Extract<TrucoAction, { type: 'sing_truco' }>, events: TrucoEvent[]): EngineResult {
  if (state.trucoLevel !== 1) return rejected('E_NO_PENDING_BET', state);
  if (action.actor !== state.playerToAct) return rejected('E_OUT_OF_TURN', state);
  const next = structuredClone(state);
  next.truco = { level: 2, singer: action.actor, responder: otherSlot(action.actor), resumeTurn: action.actor };
  next.phase = 'truco_betting';
  pushCallSung(next, action.actor, 'sing_truco', events);
  return { ok: true, state: next, events };
}

/**
 * Raise right belongs to the ACCEPTER of the previous bet alone: he is the
 * responder of the pending bet. Retruco raises over level 2, vale cuatro
 * over level 3 — anything else is an illegal raise order.
 */
function raiseTruco(
  state: TrucoState,
  action: Extract<TrucoAction, { type: 'sing_retruco' | 'sing_vale_cuatro' }>,
  events: TrucoEvent[],
): EngineResult {
  const bet = state.truco;
  if (!bet) return rejected('E_NO_PENDING_BET', state);
  if (action.actor !== bet.responder) return rejected('E_NOT_RESPONDER', state);
  if (bet.answered) return rejected('E_ALREADY_ANSWERED', state);

  const requiredLevel = action.type === 'sing_retruco' ? 2 : 3;
  if (bet.level !== requiredLevel) return rejected('E_ILLEGAL_RAISE_ORDER', state);

  const next = structuredClone(state);
  next.truco = {
    level: (bet.level + 1) as TrucoPendingBet['level'],
    singer: action.actor,
    responder: otherSlot(action.actor),
    resumeTurn: bet.resumeTurn, // raises never move the resumption point
  };
  pushCallSung(next, action.actor, action.type, events);
  return { ok: true, state: next, events };
}

/** Dispatches quiero/no_quiero to the active betting sub-phase. */
function answer(
  state: TrucoState,
  action: Extract<TrucoAction, { type: 'quiero' | 'no_quiero' }>,
  deps: ApplyDeps,
  events: TrucoEvent[],
): EngineResult {
  if (state.phase === 'envido_betting') {
    const env = state.envido!;
    if (action.actor !== env.awaitingResponder) return rejected('E_NOT_RESPONDER', state);
    if (env.answered) return rejected('E_ALREADY_ANSWERED', state);
    const next = structuredClone(state);
    settleEnvido(next, action.type, deps, events);
    return { ok: true, state: next, events };
  }

  if (state.phase === 'truco_betting') {
    const bet = state.truco!;
    if (action.actor !== bet.responder) return rejected('E_NOT_RESPONDER', state);
    // Defense-in-depth: legalActions never offers an answer to an already
    // answered bet, so this guard is unreachable through the UI — it exists
    // for direct/applyAction callers (synthetic reachability).
    if (bet.answered) return rejected('E_ALREADY_ANSWERED', state);
    if (action.type === 'quiero') {
      const next = structuredClone(state);
      const answeredEvent: TrucoEvent = {
        type: 'answered',
        player: action.actor,
        answer: 'quiero',
        bet: 'truco',
      };
      next.history.push(answeredEvent);
      events.push(answeredEvent);
      // Accepting locks the level for the hand and closes the envido window.
      next.trucoLevel = bet.level;
      next.trucoAccepted = true;
      next.truco = null;
      next.phase = 'playing';
      // Resume where the chain OPENED, not where the last raise left it.
      next.playerToAct = bet.resumeTurn;
      return { ok: true, state: next, events };
    }

    // ── no_quiero: hand ends NOW; singer collects level − 1 ──
    const next = structuredClone(state);
    const answeredEvent: TrucoEvent = {
      type: 'answered',
      player: action.actor,
      answer: 'no_quiero',
      bet: 'truco',
    };
    next.history.push(answeredEvent);
    events.push(answeredEvent);
    const reason =
      bet.level === 2 ? 'truco_refused' : bet.level === 3 ? 'retruco_refused' : 'vale_cuatro_refused';
    award(next, bet.singer, bet.level - 1, reason, events);
    next.truco = null;
    concludeHand(next, bet.singer, deps, events);
    return { ok: true, state: next, events };
  }

  return rejectForPhase(state.phase, action.type, state);
}
