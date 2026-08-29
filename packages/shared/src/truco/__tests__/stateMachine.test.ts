import { describe, expect, it } from 'vitest';
import { TRUCO_ERROR_CODES, type TrucoErrorCode } from '../errors.js';
import { TRANSITIONS } from '../state.js';
import type { TrucoPhase } from '../types.js';

const SPEC_ERROR_CODES: readonly TrucoErrorCode[] = [
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

describe('Error taxonomy exhaustiveness', () => {
  it('exposes exactly the spec error codes, each exactly once', () => {
    expect([...TRUCO_ERROR_CODES].sort()).toEqual([...SPEC_ERROR_CODES].sort());
    expect(new Set(TRUCO_ERROR_CODES).size).toBe(TRUCO_ERROR_CODES.length);
  });
});

describe('TRANSITIONS table (Explicit state machine)', () => {
  const PHASES: readonly TrucoPhase[] = [
    'waiting_for_players',
    'dealing',
    'playing',
    'envido_betting',
    'truco_betting',
    'hand_end',
    'match_end',
  ];

  it('declares every phase of the finite machine', () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...PHASES].sort());
  });

  it('matches the required legal-action sets per phase exactly', () => {
    expect(TRANSITIONS.waiting_for_players).toEqual(['start']);
    expect(TRANSITIONS.dealing).toEqual([]);
    expect(TRANSITIONS.hand_end).toEqual([]);
    expect(TRANSITIONS.match_end).toEqual([]);
    expect(TRANSITIONS.playing).toEqual([
      'play_card',
      'sing_envido',
      'sing_real_envido',
      'sing_falta_envido',
      'sing_truco',
      'sing_retruco',
      'sing_vale_cuatro',
    ]);
    expect(TRANSITIONS.envido_betting).toEqual([
      'quiero',
      'no_quiero',
      'fold',
      'sing_envido',
      'sing_real_envido',
      'sing_falta_envido',
    ]);
    expect(TRANSITIONS.truco_betting).toEqual([
      'quiero',
      'no_quiero',
      'fold',
      'sing_retruco',
      'sing_vale_cuatro',
      // Envido-before-Truco precedence: the responder may answer a pending
      // truco by OPENING envido (spec scenario "Envido takes precedence").
      'sing_envido',
      'sing_real_envido',
      'sing_falta_envido',
    ]);
  });

  it('contains no duplicate action types inside any phase', () => {
    for (const actions of Object.values(TRANSITIONS)) {
      expect(new Set(actions).size).toBe(actions.length);
    }
  });
});
