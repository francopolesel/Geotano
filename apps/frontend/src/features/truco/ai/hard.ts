// ---------------------------------------------------------------------------
// Truco CPU — Hard difficulty (spec: "Hard — counts cards, trap lines, bluffs")
// ---------------------------------------------------------------------------
// Behavioral contract:
// - Counts visible cards (played cards + own hand) and adapts card selection:
//   with all four 3s visible a tier-9 lead becomes trustworthy, so it commits
//   the cheap card and saves its brava for the deciding baza.
// - Trap discipline: after winning baza 1 it plays non-macho cards first and
//   holds 1espada/1basto for baza 3 in ≥90% of cases.
// - Bluff band: initiates bets on junk hands within a fixed 10–25% band
//   measured over ≥300 windows.
// - Marker-aware falta discipline: when the opponent is within 3 points of
//   target, refuses falta envido unless holding a tier-11+ card (≥95%).
// - Varied-but-fixed think delay constants; never wall-clock.

import type { CpuDecisionInput, CardId, PlayerSlot, Rng, TrucoAction } from '@geotano/shared';
import { compareCards, computeEnvido } from '@geotano/shared';
import { actingSlot, byStrength, cardTier, cpuOptions, maxTier } from './types';
import type { TrucoAi } from './types';

const BLUFF_PROBABILITY = 0.17; // center of the spec's 10–25% band
const STRONG_INITIATE_PROBABILITY = 0.95;
const ENVIDO_SING_AT_27_PROBABILITY = 0.95;
const FALTA_REFUSE_PROBABILITY = 0.97; // ≥95% required
const FALTA_ACCEPT_WITH_BRAVA_PROBABILITY = 0.92;
const STRONG_ACCEPT_PROBABILITY = 0.995; // fold-strong ≤1%
const JUNK_ANSWER_FOLD_PROBABILITY = 0.75;
const MID_ANSWER_ACCEPT_PROBABILITY = 0.45;

/** Fixed per-handNumber delays — deterministic variety, never wall-clock. */
const THINK_DELAYS_MS = [520, 640, 760] as const;

const THREES: readonly CardId[] = ['3oro', '3copa', '3espada', '3basto'];

function rivalOf(slot: PlayerSlot): PlayerSlot {
  return slot === 'A' ? 'B' : 'A';
}

function allFourThreesVisible(input: CpuDecisionInput): boolean {
  const visible = new Set<CardId>([
    ...input.playedCards.A,
    ...input.playedCards.B,
    ...input.myHand,
  ]);
  return THREES.every((three) => visible.has(three));
}

function answer(input: CpuDecisionInput, rng: Rng): TrucoAction {
  const options = cpuOptions(input);
  const accept = options.find((action) => action.type === 'quiero');
  const fold = options.find((action) => action.type === 'no_quiero');
  if (!accept || !fold) return options[0] as TrucoAction;
  const me = actingSlot(input);
  const rival = rivalOf(me);

  // Marker-aware falta envido discipline (spec d).
  if (input.envidoAwaiting?.falta && input.scores[rival] >= input.targetPoints - 3) {
    if (maxTier(input.myHand) >= 11) {
      return rng() < FALTA_ACCEPT_WITH_BRAVA_PROBABILITY ? accept : fold;
    }
    return rng() < FALTA_REFUSE_PROBABILITY ? fold : accept;
  }

  if (input.envidoAwaiting) {
    const own = computeEnvido(input.myHand);
    const acceptProbability = own >= 24 ? 0.95 : own >= 20 ? 0.4 : 0.08;
    return rng() < acceptProbability ? accept : fold;
  }

  // Truco family answers.
  const best = maxTier(input.myHand);
  if (best >= 10) {
    const raise =
      input.trucoAwaiting?.level === 2
        ? options.find((action) => action.type === 'sing_retruco')
        : undefined;
    if (raise && rng() < 0.25) return raise;
    return rng() < STRONG_ACCEPT_PROBABILITY ? accept : fold;
  }
  if (best <= 3) {
    return rng() < JUNK_ANSWER_FOLD_PROBABILITY ? fold : accept;
  }
  return rng() < MID_ANSWER_ACCEPT_PROBABILITY ? accept : fold;
}

function chooseCard(input: CpuDecisionInput, me: PlayerSlot): TrucoAction {
  const options = cpuOptions(input);
  const plays = options.filter((action) => action.type === 'play_card');
  if (plays.length === 0) return options[0] as TrucoAction;
  const sorted = plays.slice().sort((a, b) => byStrength(a.card, b.card));
  const cheapest = sorted[0] as (typeof sorted)[number];
  const dearest = sorted[sorted.length - 1] as (typeof sorted)[number];

  if (input.openBazaPlays.length > 0) {
    const rivalPlay = input.openBazaPlays.find((play) => play.player !== me);
    if (!rivalPlay) return cheapest;
    // Win as cheaply as possible; otherwise dump the cheapest card.
    const winner = sorted.find((play) => compareCards(play.card, rivalPlay.card) === 'win1');
    return (winner ?? cheapest) as TrucoAction;
  }

  // Leading: trap lines + counting-informed commitment.
  const machos = sorted.filter((play) => cardTier(play.card) >= 13);
  if (machos.length > 0 && machos.length < sorted.length) {
    // Save the macho for the deciding baza; spend the best non-macho now.
    const nonMachos = sorted.filter((play) => cardTier(play.card) < 13);
    return nonMachos[nonMachos.length - 1] as TrucoAction;
  }
  if (allFourThreesVisible(input)) {
    // No 3s remain unseen: mid tiers are trustworthy, keep the brava parked.
    return cheapest;
  }
  return dearest;
}

export function hardThinkDelayMs(handNumber: number): number {
  return THINK_DELAYS_MS[Math.abs(handNumber) % THINK_DELAYS_MS.length] as number;
}

export const hardAi: TrucoAi = {
  // Fallback constant; the controller prefers thinkDelayFor below. Both
  // sources are fixed constants, never wall-clock.
  thinkDelayMs: THINK_DELAYS_MS[0],
  // Varied-but-fixed per-hand pacing (remediation #10: actually wired now).
  thinkDelayFor: hardThinkDelayMs,

  decide(input: CpuDecisionInput, rng: Rng): TrucoAction {
    const options = cpuOptions(input);

    const hasAnswer = options.some(
      (action) => action.type === 'quiero' || action.type === 'no_quiero',
    );
    if (hasAnswer) return answer(input, rng);

    const me = actingSlot(input);
    const singEnvido = options.find((action) => action.type === 'sing_envido');
    if (
      singEnvido &&
      computeEnvido(input.myHand) >= 27 &&
      rng() < ENVIDO_SING_AT_27_PROBABILITY
    ) {
      return singEnvido;
    }

    const singTruco = options.find((action) => action.type === 'sing_truco');
    if (singTruco) {
      const strongCards = input.myHand.filter((card) => cardTier(card) >= 10);
      const junk = maxTier(input.myHand) <= 4 && computeEnvido(input.myHand) < 25;
      if (strongCards.length >= 2 && rng() < STRONG_INITIATE_PROBABILITY) {
        return singTruco;
      }
      if (junk && rng() < BLUFF_PROBABILITY) {
        return singTruco; // documented bluff band: 10–25% of junk windows
      }
    }

    return chooseCard(input, me);
  },
};
