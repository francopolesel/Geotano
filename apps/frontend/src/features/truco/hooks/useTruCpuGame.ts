// ---------------------------------------------------------------------------
// Truco CPU — game controller hook (D10: engine + AI + think delays only)
// ---------------------------------------------------------------------------
// Responsibilities:
// - Owns the TrucoState ref, the injected seeded rng and one AI instance.
// - Applies human/CPU actions through applyAction (the ONLY rules authority).
// - Schedules CPU decisions behind the difficulty's fixed think delay.
// - Projects public snapshots via buildView; emits raw event batches so the
//   page layer can drive sounds/analytics without re-deriving them.

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PlayerSlot,
  Rng,
  TrucoAction,
  TrucoEvent,
  TrucoState,
  TrucoView,
} from '@geotano/shared';
import {
  applyAction,
  buildCpuDecisionInput,
  buildView,
  createMatch,
  legalActions,
  mulberry32,
} from '@geotano/shared';
import { createAi, pickPersona } from '../ai';
import type { Difficulty, Persona } from '../ai';

const MY_SLOT: PlayerSlot = 'A';
const CPU_SLOT: PlayerSlot = 'B';

export interface UseTruCpuGameOptions {
  difficulty: Difficulty;
  targetPoints: 15 | 30;
  /** Deterministic seed (tests); defaults to wall-clock entropy. */
  seed?: number;
  /** Manual persona pick (menu); falls back to the seeded roster entry. */
  personaOverride?: Persona;
  /** Raw engine event batches, emitted after every successful applyAction. */
  onEvents?: (events: readonly TrucoEvent[]) => void;
}

export interface TruCpuGameSnapshot {
  view: TrucoView;
  scores: Record<PlayerSlot, number>;
  targetPoints: number;
  finished: boolean;
  winner: PlayerSlot | null;
  /** Engine-derived legal actions for the HUMAN right now (may be empty). */
  actions: TrucoAction[];
  awaitingOpponent: boolean;
}

function snapshotOf(state: TrucoState): TruCpuGameSnapshot {
  const view = buildView(state, MY_SLOT);
  const actions = legalActions(view, MY_SLOT);
  const awaitingOpponent =
    view.envidoAwaiting != null
      ? view.envidoAwaiting.responder !== MY_SLOT
      : view.trucoAwaiting != null
        ? view.trucoAwaiting.responder !== MY_SLOT
        : state.phase === 'playing' && state.playerToAct !== MY_SLOT;
  return {
    view,
    scores: { ...state.scores },
    targetPoints: state.targetPoints,
    finished: state.phase === 'match_end',
    winner: state.winner,
    actions,
    awaitingOpponent,
  };
}

/** Does the current phase owe its next action to the CPU slot? */
function cpuOwes(state: TrucoState): boolean {
  if (state.phase === 'playing') return state.playerToAct === CPU_SLOT;
  if (state.phase === 'envido_betting') return state.envido?.awaitingResponder === CPU_SLOT;
  if (state.phase === 'truco_betting') return state.truco?.responder === CPU_SLOT;
  return false;
}

export function useTruCpuGame({
  difficulty,
  targetPoints,
  seed,
  personaOverride,
  onEvents,
}: UseTruCpuGameOptions) {
  const aiRef = useRef(createAi(difficulty));
  const rngRef = useRef<Rng>(() => 0);
  const stateRef = useRef<TrucoState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventsRef = useRef(onEvents);
  eventsRef.current = onEvents;

  // Lazy one-time deal (idempotent across Strict Mode double renders).
  const initialSeed = seed ?? Date.now();
  if (!stateRef.current) {
    rngRef.current = mulberry32(initialSeed);
    // The human opens every fresh match as mano; the engine rotates mano on
    // subsequent dealt hands.
    stateRef.current = createMatch({ targetPoints, mano: MY_SLOT }, rngRef.current);
  }

  const [snapshot, setSnapshot] = useState<TruCpuGameSnapshot>(() =>
    snapshotOf(stateRef.current as TrucoState),
  );

  const persona: Persona = personaOverride ?? pickPersona(initialSeed);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const apply = useCallback((action: TrucoAction) => {
    const result = applyAction(stateRef.current as TrucoState, action, {
      rng: rngRef.current,
    });
    if (!result.ok) return; // defensive: engine-derived actions always apply
    stateRef.current = result.state;
    eventsRef.current?.(result.events);
    setSnapshot(snapshotOf(stateRef.current));
  }, []);

  const runCpuTurn = useCallback(() => {
    const state = stateRef.current as TrucoState;
    const input = buildCpuDecisionInput(state, CPU_SLOT);
    const action = aiRef.current.decide(input, rngRef.current);
    apply(action);
  }, [apply]);

  // Single scheduling path: after mount and after every applied action the
  // effect re-arms the pending CPU think timer (or lets the state rest).
  useEffect(() => {
    if (!snapshot.finished && cpuOwes(stateRef.current as TrucoState)) {
      clearTimer();
      timerRef.current = setTimeout(runCpuTurn, aiRef.current.thinkDelayMs);
    }
    return clearTimer;
  }, [snapshot, clearTimer, runCpuTurn]);

  const play = useCallback(
    (action: TrucoAction) => {
      const state = stateRef.current as TrucoState;
      if (state.phase === 'match_end' || cpuOwes(state)) return;
      if (action.type === 'start') return;
      apply(action);
    },
    [apply],
  );

  const restart = useCallback(() => {
    clearTimer();
    const nextSeed = Date.now() & 0x7fffffff;
    rngRef.current = mulberry32(nextSeed);
    stateRef.current = createMatch({ targetPoints, mano: MY_SLOT }, rngRef.current);
    setSnapshot(snapshotOf(stateRef.current));
  }, [clearTimer, targetPoints]);

  return {
    mySlot: MY_SLOT,
    cpuPersona: persona,
    difficulty,
    ...snapshot,
    play,
    restart,
  };
}
