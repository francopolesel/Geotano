// ---------------------------------------------------------------------------
// Truco CPU — shared AI contracts (D10: decisions over CpuDecisionInput ONLY)
// ---------------------------------------------------------------------------
// Every difficulty implements `TrucoAi`. The decision input is built by the
// shared firewall (`buildCpuDecisionInput`) and structurally excludes hidden
// information, so no AI can cheat even by accident. Legal option sets are
// always derived through the shared `legalActions` — rules are never
// duplicated or hand-rolled here.

import type { CardId, CpuDecisionInput, PlayerSlot, Rng, TrucoAction } from '@geotano/shared';
import { TIER_TABLE, legalActions } from '@geotano/shared';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TrucoAi {
  /** Pure decision over the firewall input; rng is injected for reproducibility. */
  decide(input: CpuDecisionInput, rng: Rng): TrucoAction;
  /** Fixed think delay constant (never wall-clock). */
  readonly thinkDelayMs: number;
}

/** Slot whose turn / answer window this decision input represents. */
export function actingSlot(input: CpuDecisionInput): PlayerSlot {
  if (input.phase === 'envido_betting' && input.envidoAwaiting) {
    return input.envidoAwaiting.responder;
  }
  if (input.phase === 'truco_betting' && input.trucoAwaiting) {
    return input.trucoAwaiting.responder;
  }
  return input.playerToAct;
}

/** Legal options for the acting CPU — engine-derived, never hand-rolled rules. */
export function cpuOptions(input: CpuDecisionInput): TrucoAction[] {
  return legalActions(input, actingSlot(input));
}

export function cardTier(card: CardId): number {
  return TIER_TABLE[card];
}

export function maxTier(hand: readonly CardId[]): number {
  return Math.max(...hand.map(cardTier));
}

/** Uniform pick driven by the injected rng (reproducible across runs). */
export function pick<T>(items: readonly T[], rng: Rng): T {
  const index = Math.floor(rng() * items.length);
  return items[index] as T;
}

/** Stable ascending order: tier first, id second (deterministic tie-breaks). */
export function byStrength(a: CardId, b: CardId): number {
  return cardTier(a) - cardTier(b) || (a < b ? -1 : a > b ? 1 : 0);
}
