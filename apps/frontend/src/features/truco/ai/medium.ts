// ---------------------------------------------------------------------------
// Truco CPU — Medium difficulty (spec: "Medium — tier heuristic + thresholds")
// ---------------------------------------------------------------------------
// Behavioral contract:
// - Initiates truco in ≥80% of windows holding two tier-10+ cards.
// - Accepts plain truco with a tier-10+ card in ≥80% of cases.
// - Folds junk hands (all tiers ≤ 3) against a raise in ≥90% of cases.
// - Sings envido when its own value is ≥27 in ≥90% of windows (incl. the 31).
// - NEVER folds pre-retruco while holding both 1espada and 1basto.
// - Short fixed think delay.

import type { CpuDecisionInput, Rng, TrucoAction } from '@geotano/shared';
import { computeEnvido, compareCards } from '@geotano/shared';
import {
  byStrength,
  cardTier,
  cpuOptions,
  maxTier,
  actingSlot,
} from './types';
import { GAME_TIMING } from '../lib/GAME_TIMING';
import type { TrucoAi } from './types';

const STRONG_INITIATE_PROBABILITY = 0.9; // ≥80% required
const ACCEPT_WITH_TIER10_PROBABILITY = 0.85; // ≥80% required
const JUNK_FOLD_PROBABILITY = 0.95; // ≥90% required
const ENVIDO_SING_AT_27_PROBABILITY = 0.95; // ≥90% required
const MACHO_RAISE_PROBABILITY = 0.3;
const MID_HAND_ACCEPT_PROBABILITY = 0.35;

function answerWithTruco(input: CpuDecisionInput, rng: Rng): TrucoAction {
  const options = cpuOptions(input);
  const accept = options.find((action) => action.type === 'quiero');
  const fold = options.find((action) => action.type === 'no_quiero');
  if (!accept || !fold) return options[0] as TrucoAction;

  const hand = input.myHand;
  const machos = hand.filter((card) => cardTier(card) >= 13);
  const awaitingLevel = input.trucoAwaiting?.level ?? 0;

  // Hard floor: never surrender both machos before retruco exists.
  if (machos.length >= 2 && awaitingLevel === 2) {
    const raise = options.find((action) => action.type === 'sing_retruco');
    if (raise && rng() < MACHO_RAISE_PROBABILITY) return raise;
    return accept;
  }

  const best = maxTier(hand);
  if (best >= 10) {
    return rng() < ACCEPT_WITH_TIER10_PROBABILITY ? accept : fold;
  }
  if (best <= 3) {
    return rng() < JUNK_FOLD_PROBABILITY ? fold : accept;
  }
  return rng() < MID_HAND_ACCEPT_PROBABILITY ? accept : fold;
}

function answerWithEnvido(input: CpuDecisionInput, rng: Rng): TrucoAction {
  const options = cpuOptions(input);
  const accept = options.find((action) => action.type === 'quiero');
  const fold = options.find((action) => action.type === 'no_quiero');
  if (!accept || !fold) return options[0] as TrucoAction;

  const own = computeEnvido(input.myHand);
  const acceptProbability = own >= 27 ? 0.95 : own >= 22 ? 0.5 : 0.15;
  return rng() < acceptProbability ? accept : fold;
}

export const mediumAi: TrucoAi = {
  // Sourced from GAME_TIMING (C3); fixed short delay.
  thinkDelayMs: GAME_TIMING.opponentThinking.medium,

  decide(input: CpuDecisionInput, rng: Rng): TrucoAction {
    const options = cpuOptions(input);

    // Responder windows first.
    const hasAnswer = options.some(
      (action) => action.type === 'quiero' || action.type === 'no_quiero',
    );
    if (hasAnswer) {
      return input.envidoAwaiting
        ? answerWithEnvido(input, rng)
        : answerWithTruco(input, rng);
    }

    // Playing turn: threshold-gated initiations, otherwise tier-heuristic play.
    const singEnvido = options.find((action) => action.type === 'sing_envido');
    if (singEnvido && computeEnvido(input.myHand) >= 27 && rng() < ENVIDO_SING_AT_27_PROBABILITY) {
      return singEnvido;
    }
    const strongCards = input.myHand.filter((card) => cardTier(card) >= 10);
    const singTruco = options.find((action) => action.type === 'sing_truco');
    if (
      singTruco &&
      strongCards.length >= 2 &&
      rng() < STRONG_INITIATE_PROBABILITY
    ) {
      return singTruco;
    }

    const plays = options.filter((action) => action.type === 'play_card');
    if (plays.length === 0) return options[0] as TrucoAction;
    const sorted = plays.slice().sort((a, b) => byStrength(a.card, b.card));

    if (input.openBazaPlays.length === 0) {
      return sorted[0] as TrucoAction; // lead the cheapest card
    }
    const me = actingSlot(input);
    const rivalPlay = input.openBazaPlays.find((play) => play.player !== me);
    if (!rivalPlay) return sorted[0] as TrucoAction;
    const winner = sorted.find((play) => compareCards(play.card, rivalPlay.card) === 'win1');
    return (winner ?? sorted[0]) as TrucoAction;
  },
};
