// ---------------------------------------------------------------------------
// Truco Argentino — error taxonomy (exhaustive, spec-pinned)
// ---------------------------------------------------------------------------
// Leaf module: imports NOTHING. Every illegal input must produce a typed
// rejection naming one of these stable codes and leave state untouched.

export type TrucoErrorCode =
  | 'E_OUT_OF_TURN'
  | 'E_CARD_NOT_OWNED'
  | 'E_CARD_ALREADY_PLAYED'
  | 'E_ENVIDO_WINDOW_CLOSED'
  | 'E_ENVIDO_BETTING_CLOSED'
  | 'E_ILLEGAL_RAISE_ORDER'
  | 'E_NOT_RESPONDER'
  | 'E_NO_PENDING_BET'
  | 'E_ALREADY_ANSWERED'
  | 'E_AWAITING_OWN_BET'
  | 'E_TRUCO_WINDOW_CLOSED'
  | 'E_NOT_PARTICIPANT'
  | 'E_MATCH_FINISHED'
  | 'E_STATE_FORBIDDEN';

/** Exhaustive list of every error code the engine can emit (taxonomy sweep). */
export const TRUCO_ERROR_CODES: readonly TrucoErrorCode[] = [
  'E_OUT_OF_TURN',
  'E_CARD_NOT_OWNED',
  'E_CARD_ALREADY_PLAYED',
  'E_ENVIDO_WINDOW_CLOSED',
  'E_ENVIDO_BETTING_CLOSED',
  'E_ILLEGAL_RAISE_ORDER',
  'E_NOT_RESPONDER',
  'E_NO_PENDING_BET',
  'E_ALREADY_ANSWERED',
  'E_AWAITING_OWN_BET',
  'E_TRUCO_WINDOW_CLOSED',
  'E_NOT_PARTICIPANT',
  'E_MATCH_FINISHED',
  'E_STATE_FORBIDDEN',
];

/** Human-readable default messages per code (English; UI localizes upstream). */
export const ERROR_MESSAGES: Record<TrucoErrorCode, string> = {
  E_OUT_OF_TURN: 'It is not this player’s turn to act.',
  E_CARD_NOT_OWNED: 'The played card is not in the actor’s hand.',
  E_CARD_ALREADY_PLAYED: 'That card has already been played this hand.',
  E_ENVIDO_WINDOW_CLOSED: 'Envido can no longer be sung in this hand.',
  E_ENVIDO_BETTING_CLOSED: 'Envido betting is closed for this hand.',
  E_ILLEGAL_RAISE_ORDER: 'That raise breaks the betting chain order.',
  E_NOT_RESPONDER: 'Only the responder may answer or raise the pending bet.',
  E_NO_PENDING_BET: 'There is no pending bet to answer or raise.',
  E_ALREADY_ANSWERED: 'The pending bet has already been answered.',
  E_AWAITING_OWN_BET: 'A bet is pending; it must be resolved before acting.',
  E_TRUCO_WINDOW_CLOSED: 'Truco calls are closed for the current hand.',
  E_NOT_PARTICIPANT: 'The actor is not a participant of this match.',
  E_MATCH_FINISHED: 'The match is finished; no further actions are allowed.',
  E_STATE_FORBIDDEN: 'This action is not valid in the current phase.',
};
