// ---------------------------------------------------------------------------
// Truco CPU — Easy difficulty (spec: "Easy — random-ish, rarely bets")
// ---------------------------------------------------------------------------
// Behavioral contract:
// - Plays a uniformly random legal card.
// - Initiates envido/truco in at most 25% of eligible windows (combined).
//   When initiating: 40% truco, 30% envido, 20% retruco (if level 2), 10% vale4 (if level 3)
// - Sometimes folds even strong hands pre-retruco (at least 5%).
// - Fixed think delay of 700 ms regardless of hand strength.

import type { CpuDecisionInput, Rng, TrucoAction } from '@geotano/shared';
import { cardTier, cpuOptions, pick } from './types';
import { GAME_TIMING } from '../lib/GAME_TIMING';
import type { TrucoAi } from './types';

/** Combined initiation probability across all eligible bet windows (≤25%). */
const INITIATE_PROBABILITY = 0.25;
/** Fold probability holding 1espada/1basto pre-retruco (≥5% required). */
const FOLD_STRONG_PROBABILITY = 0.1;
/** Fold probability with any other hand. */
const FOLD_OTHER_PROBABILITY = 0.4;

function isStrongHand(hand: readonly string[]): boolean {
  return hand.some((card) => cardTier(card as Parameters<typeof cardTier>[0]) >= 13);
}

export const easyAi: TrucoAi = {
  // Spec-pinned: Easy always thinks one fixed delay, sourced from GAME_TIMING.
  thinkDelayMs: GAME_TIMING.opponentThinking.easy,

  decide(input: CpuDecisionInput, rng: Rng): TrucoAction {
    const options = cpuOptions(input);

    // Answer path: quiero/no_quiero present means this input is a responder.
    const fold = options.find((action) => action.type === 'no_quiero');
    const accept = options.find((action) => action.type === 'quiero');
    if (fold && accept) {
      const foldProbability = isStrongHand(input.myHand)
        ? FOLD_STRONG_PROBABILITY
        : FOLD_OTHER_PROBABILITY;
      return rng() < foldProbability ? fold : accept;
    }

    // Playing turn: occasionally initiate a bet, otherwise play a random card.
    const calls = options.filter((action) => action.type.startsWith('sing_'));
    const plays = options.filter((action) => action.type === 'play_card');
    if (calls.length > 0 && rng() < INITIATE_PROBABILITY) {
      // Weight: 40% truco, 30% envido, 20% retruco (if level 2), 10% vale4 (if level 3)
      const trucoCalls = calls.filter((a) => a.type === 'sing_truco');
      const envidoCalls = calls.filter((a) => a.type === 'sing_envido' || a.type === 'sing_real_envido' || a.type === 'sing_falta_envido');
      const retrucoCalls = calls.filter((a) => a.type === 'sing_retruco');
      const vale4Calls = calls.filter((a) => a.type === 'sing_vale_cuatro');
      
      const r = rng();
      if (r < 0.4 && trucoCalls.length > 0) return pick(trucoCalls, rng);
      if (r < 0.7 && envidoCalls.length > 0) return pick(envidoCalls, rng);
      if (r < 0.9 && retrucoCalls.length > 0) return pick(retrucoCalls, rng);
      if (vale4Calls.length > 0) return pick(vale4Calls, rng);
      return pick(calls, rng);
    }
    if (plays.length > 0) return pick(plays, rng);
    return pick(options, rng);
  },
};
