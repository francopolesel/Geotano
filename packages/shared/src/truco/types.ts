// ---------------------------------------------------------------------------
// Truco Argentino — core vocabulary types
// ---------------------------------------------------------------------------
// Leaf layer: imports NOTHING intra-module. Every other engine module may
// import from here; this file must never import from a sibling.

/** Spanish-deck suits used by the engine. */
export type Suit = 'oro' | 'copa' | 'espada' | 'basto';

/** Ranks present in the 40-card deck (8s and 9s do not exist). */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

/** Card identity string in `{rank}{suit}` form, e.g. `7espada`, `12copa`. */
export type CardId = `${Rank}${Suit}`;

/** Injected pseudo-random source: returns numbers in [0, 1). */
export type Rng = () => number;

// ---------------------------------------------------------------------------
// Match vocabulary
// ---------------------------------------------------------------------------

/** The two participant slots of a 1v1 match. */
export type PlayerSlot = 'A' | 'B';

/**
 * Finite phase machine:
 * waiting_for_players → dealing → playing ⇄ (envido_betting | truco_betting)
 * → hand_end → dealing … → match_end.
 * `dealing` and `hand_end` are transient in practice — deals are chained
 * atomically inside `applyAction` — but remain first-class phases so the
 * machine is fully queryable.
 */
export type TrucoPhase =
  | 'waiting_for_players'
  | 'dealing'
  | 'playing'
  | 'envido_betting'
  | 'truco_betting'
  | 'hand_end'
  | 'match_end';

/** Discriminant of every player-submitted action. */
export type TrucoActionType =
  | 'start'
  | 'play_card'
  | 'sing_envido'
  | 'sing_real_envido'
  | 'sing_falta_envido'
  | 'sing_truco'
  | 'sing_retruco'
  | 'sing_vale_cuatro'
  | 'quiero'
  | 'no_quiero'
  | 'fold';

/** Envido call variants. */
export type EnvidoCall = 'sing_envido' | 'sing_real_envido' | 'sing_falta_envido';

/** Truco call variants. */
export type TrucoCall = 'sing_truco' | 'sing_retruco' | 'sing_vale_cuatro';

/** Answers to any pending bet. */
export type AnswerKind = 'quiero' | 'no_quiero';

/** Kinds of pending bets. */
export type BetKind = 'envido' | 'truco';

/** Reason attached to a points_awarded event. */
export type AwardReason =
  | 'envido_accepted'
  | 'envido_refused'
  | 'truco_refused'
  | 'retruco_refused'
  | 'vale_cuatro_refused'
  | 'hand_prize';

/** Public event log entries (D4). Defined here so state/history stays a leaf shape. */
export type TrucoEvent =
  | { type: 'card_played'; player: PlayerSlot; card: CardId }
  | { type: 'call_sung'; actor: PlayerSlot; call: EnvidoCall | TrucoCall }
  | { type: 'answered'; player: PlayerSlot; answer: AnswerKind; bet: BetKind }
  | { type: 'envido_showdown'; values: Record<PlayerSlot, number>; winner: PlayerSlot }
  | { type: 'baza_resolved'; baza: number; winner: PlayerSlot | null }
  | { type: 'points_awarded'; side: PlayerSlot; amount: number; reason: AwardReason }
  | { type: 'hand_ended'; winner: PlayerSlot }
  | { type: 'match_ended'; winner: PlayerSlot; scores: Record<PlayerSlot, number> };

/** Actions players submit to the engine. Actor is always explicit. */
export type TrucoAction =
  | { type: 'start' }
  | { type: 'play_card'; actor: PlayerSlot; card: CardId }
  | { type: 'sing_envido'; actor: PlayerSlot }
  | { type: 'sing_real_envido'; actor: PlayerSlot }
  | { type: 'sing_falta_envido'; actor: PlayerSlot }
  | { type: 'sing_truco'; actor: PlayerSlot }
  | { type: 'sing_retruco'; actor: PlayerSlot }
  | { type: 'sing_vale_cuatro'; actor: PlayerSlot }
  | { type: 'quiero'; actor: PlayerSlot }
  | { type: 'no_quiero'; actor: PlayerSlot }
  | { type: 'fold'; actor: PlayerSlot };

/** Options for creating a match. Target defaults to 30 (spec-pinned). */
export interface CreateMatchOptions {
  targetPoints?: 15 | 30;
  mano?: PlayerSlot;
}

// ---------------------------------------------------------------------------
// State shape (flat, JSONB-serializable per D2)
// ---------------------------------------------------------------------------

/** One card laid on the table inside an unresolved baza. */
export interface BazaPlay {
  player: PlayerSlot;
  card: CardId;
}

/** A resolved baza. `winner: null` means parda. */
export interface BazaRecord {
  number: 1 | 2 | 3;
  plays: BazaPlay[];
  winner: PlayerSlot | null;
}

/**
 * Accumulating envido chain substate (D5).
 * - `stake`: total points if the pending bet is accepted.
 * - `priorStake`: stake accumulated BEFORE the pending raise
 *   (refusal pays `priorStake`, or 1 when refusing the FIRST bet).
 * - `falta`: the pending bet is a terminal falta envido.
 * - `realRaised`: a real envido raise already happened (no envido raises after).
 */
export interface EnvidoSubstate {
  stake: number;
  priorStake: number;
  awaitingResponder: PlayerSlot;
  lastCaller: PlayerSlot;
  falta: boolean;
  realRaised: boolean;
  /** Internal marker used to reject double answers (E_ALREADY_ANSWERED). */
  answered?: boolean;
}

/** Pending truco-family bet awaiting its responder's answer. */
export interface TrucoPendingBet {
  /** Hand prize if accepted: truco=2, retruco=3, vale cuatro=4. */
  level: 2 | 3 | 4;
  singer: PlayerSlot;
  responder: PlayerSlot;
  /**
   * Turn to restore on acceptance: whoever was to act when the bet chain
   * OPENED (raises ride on the pending bet and keep this unchanged).
   */
  resumeTurn: PlayerSlot;
  /** Internal marker used to reject double answers (E_ALREADY_ANSWERED). */
  answered?: boolean;
}

/** The complete flat engine state. */
export interface TrucoState {
  targetPoints: 15 | 30;
  mano: PlayerSlot;
  pie: PlayerSlot;
  phase: TrucoPhase;
  /** Whose turn it is to act in the card flow (lead/speak). */
  playerToAct: PlayerSlot;
  handNumber: number;
  scores: Record<PlayerSlot, number>;
  /** Current unplayed cards per player (concrete hands live INSIDE state). */
  hands: Record<PlayerSlot, CardId[]>;
  /** Undealt cards remaining after the current deal. */
  deckRemaining: CardId[];
  /** Cards played this hand, chronological per player. */
  playedCards: Record<PlayerSlot, CardId[]>;
  /** Resolved bazas this hand. */
  bazas: BazaRecord[];
  /** Cards on the table in the open baza (0, 1 or 2 plays). */
  openBazaPlays: BazaPlay[];
  bazaLeader: PlayerSlot;
  /** Active envido chain; non-null iff phase is envido_betting. */
  envido: EnvidoSubstate | null;
  /** Pending truco bet; non-null iff phase is truco_betting. */
  truco: TrucoPendingBet | null;
  /** Truco bet parked while an envido contest resolves (D5 precedence). */
  parkedTruco: TrucoPendingBet | null;
  /** Envido betting permanently closed for this hand (after quiero/no quiero). */
  envidoClosed: boolean;
  /** Some truco level was accepted this hand (closes the envido window). */
  trucoAccepted: boolean;
  /** Accepted hand prize level: 1 untouched, 2 truco, 3 retruco, 4 vale cuatro. */
  trucoLevel: 1 | 2 | 3 | 4;
  handWinner: PlayerSlot | null;
  winner: PlayerSlot | null;
  /** Public event history of the whole match. */
  history: TrucoEvent[];
}

// ---------------------------------------------------------------------------
// Public context / views (legality + redaction inputs)
// ---------------------------------------------------------------------------

/** Public, redaction-safe context subset legalActions derives from (D11). */
export interface TrucoPublicContext {
  phase: TrucoPhase;
  playerToAct: PlayerSlot;
  mano: PlayerSlot;
  targetPoints: 15 | 30;
  scores: Record<PlayerSlot, number>;
  bazaNumber: number;
  bazaLeader: PlayerSlot;
  openBazaPlays: BazaPlay[];
  cardsPlayedThisHand: number;
  myHand: CardId[];
  opponentHandCount: number;
  envidoAwaiting: { responder: PlayerSlot; falta: boolean; realRaised: boolean } | null;
  trucoAwaiting: { responder: PlayerSlot; level: 2 | 3 | 4 } | null;
  trucoAcceptedThisHand: boolean;
  envidoClosed: boolean;
  /** Accepted hand prize level so callers know which raises remain legal. */
  acceptedTrucoLevel: 1 | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// Per-viewer DTOs (D9 redaction rule / D10 CPU firewall)
// ---------------------------------------------------------------------------

/** REST DTO: viewer's own hand in full, opponent reduced to a count. */
export interface TrucoView {
  phase: TrucoPhase;
  playerToAct: PlayerSlot;
  mano: PlayerSlot;
  targetPoints: 15 | 30;
  scores: Record<PlayerSlot, number>;
  bazaNumber: number;
  bazaLeader: PlayerSlot;
  openBazaPlays: BazaPlay[];
  cardsPlayedThisHand: number;
  myHand: CardId[];
  opponentHandCount: number;
  envidoAwaiting: { responder: PlayerSlot; falta: boolean; realRaised: boolean } | null;
  trucoAwaiting: { responder: PlayerSlot; level: 2 | 3 | 4 } | null;
  trucoAcceptedThisHand: boolean;
  envidoClosed: boolean;
  acceptedTrucoLevel: 1 | 2 | 3 | 4;
  handNumber: number;
  playedCards: Record<PlayerSlot, CardId[]>;
  bazas: BazaRecord[];
  history: TrucoEvent[];
  winner?: PlayerSlot;
}

/**
 * Hard information firewall (D10): everything a CPU decider may see.
 * Structurally EXCLUDES the opponent hand, deck order and private bet
 * internals — a runtime test asserts key absence on the built object.
 */
export interface CpuDecisionInput {
  phase: TrucoPhase;
  playerToAct: PlayerSlot;
  mano: PlayerSlot;
  targetPoints: 15 | 30;
  scores: Record<PlayerSlot, number>;
  bazaNumber: number;
  bazaLeader: PlayerSlot;
  openBazaPlays: BazaPlay[];
  cardsPlayedThisHand: number;
  myHand: CardId[];
  opponentHandCount: number;
  envidoAwaiting: { responder: PlayerSlot; falta: boolean; realRaised: boolean } | null;
  trucoAwaiting: { responder: PlayerSlot; level: 2 | 3 | 4 } | null;
  trucoAcceptedThisHand: boolean;
  envidoClosed: boolean;
  acceptedTrucoLevel: 1 | 2 | 3 | 4;
  handNumber: number;
  playedCards: Record<PlayerSlot, CardId[]>;
  bazas: BazaRecord[];
  history: TrucoEvent[];
  winner: PlayerSlot | null;
}
