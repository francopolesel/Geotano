import { describe, it, expect } from 'vitest';
import {
  applyAction,
  buildCpuDecisionInput,
  createMatch,
  legalActions,
  mulberry32,
  toPublicContext,
} from '@geotano/shared';
import type {
  CardId,
  CpuDecisionInput,
  PlayerSlot,
  Rng,
  TrucoAction,
  TrucoState,
} from '@geotano/shared';
import { PERSONAS, createAi, pickPersona, personaAt, normalizePersonaIndex } from '../index';
import { cpuOptions } from '../types';
import { hardThinkDelayMs } from '../hard';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Drives a full match where BOTH slots are played by the given difficulty. */
function simulateMatch(difficulty: 'easy' | 'medium' | 'hard', seed: number) {
  let state: TrucoState = createMatch({ targetPoints: 30 }, mulberry32(seed));
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const ai = createAi(difficulty);
  const log: Array<{ actor: PlayerSlot; action: TrucoAction }> = [];
  let illegal = 0;
  let guard = 0;

  while (state.phase !== 'match_end' && guard++ < 3000) {
    if (state.phase === 'waiting_for_players') {
      const result = applyAction(state, { type: 'start' }, { rng });
      if (!result.ok) break;
      state = result.state;
      continue;
    }
    const actor: PlayerSlot | null =
      state.phase === 'playing'
        ? state.playerToAct
        : state.phase === 'envido_betting'
          ? state.envido!.awaitingResponder
          : state.phase === 'truco_betting'
            ? state.truco!.responder
            : null;
    if (!actor) break;

    const input = buildCpuDecisionInput(state, actor);
    const action = ai.decide(input, rng);
    log.push({ actor, action });

    const legal = legalActions(toPublicContext(state, actor), actor);
    if (!legal.some((a) => a.type === action.type && ('card' in a ? 'card' in action && a.card === action.card : true))) {
      illegal++;
    }

    const result = applyAction(state, action, { rng });
    if (!result.ok) {
      illegal++;
      break;
    }
    state = result.state;
  }
  return { log, illegal, finalState: state };
}

function midHandState(): TrucoState {
  let state = createMatch({ targetPoints: 30, mano: 'A' }, mulberry32(20260821));
  // Play one baza deterministically to reach a genuine mid-hand state.
  const r = mulberry32(777);
  for (const action of [
    { type: 'play_card', actor: 'A', card: state.hands.A[0] },
  ] as TrucoAction[]) {
    const res = applyAction(state, action, { rng: r });
    if (res.ok) state = res.state;
  }
  return state;
}

// ─── Firewall ───────────────────────────────────────────────────────────────

describe('CPU information firewall (runtime proof)', () => {
  it('decision input contains no hidden-info keys', () => {
    const state = midHandState();
    const input = buildCpuDecisionInput(state, 'B');

    expect(input).not.toHaveProperty('opponentHand');
    expect(input).not.toHaveProperty('hands');
    expect(input).not.toHaveProperty('deckRemaining');
    expect(input).not.toHaveProperty('parkedTruco');
    expect(input).not.toHaveProperty('truco');
    expect(input).not.toHaveProperty('envido');

    // Private bet internals are reduced to responder/flags only.
    if (input.envidoAwaiting) {
      expect(input.envidoAwaiting).not.toHaveProperty('stake');
      expect(input.envidoAwaiting).not.toHaveProperty('priorStake');
      expect(input.envidoAwaiting).not.toHaveProperty('lastCaller');
    }
  });

  it('decisions are identical whether or not hidden data differs in memory', () => {
    // Two states whose OPPONENT HANDS differ but whose public projections
    // coincide must produce identical CPU decisions for every seed.
    const a = createMatch({ targetPoints: 30, mano: 'A' }, mulberry32(4242));
    const b = structuredClone(a);
    // Swap the hidden opponent (slot A relative to viewer B) hand contents.
    const swap = a.hands.A[0];
    b.hands.A[0] = b.hands.A[1];
    b.hands.A[1] = swap!;
    // Sanity: hidden parts really differ.
    expect(b.hands.A).not.toEqual(a.hands.A);

    const inputA = buildCpuDecisionInput(a, 'B');
    const inputB = buildCpuDecisionInput(b, 'B');
    expect(JSON.stringify(inputB)).toBe(JSON.stringify(inputA));

    for (let seed = 0; seed < 50; seed++) {
      const outA = createAi('easy').decide(inputA, mulberry32(seed));
      const outB = createAi('easy').decide(inputB, mulberry32(seed));
      expect(outB).toEqual(outA);
    }
  });
});

// ─── Fairness & determinism ─────────────────────────────────────────────────

describe('Fair-play regression guard', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    '%s decide() is pure: same input+seed → identical action',
    (difficulty) => {
      const input = buildCpuDecisionInput(midHandState(), 'B');
      const ai = createAi(difficulty);
      const first = ai.decide(input, mulberry32(99));
      const second = ai.decide(structuredClone(input), mulberry32(99));
      expect(second).toEqual(first);
    },
  );
});

describe('Seeded reproducibility', () => {
  it.each(['easy', 'medium', 'hard'] as const)(
    '%s: full match simulated twice → byte-identical action logs',
    (difficulty) => {
      const first = simulateMatch(difficulty, 31415);
      const second = simulateMatch(difficulty, 31415);
      expect(second.log).toEqual(first.log);
      expect(first.finalState.phase).toBe('match_end');
    },
  );
});

describe('Easy never emits an illegal action', () => {
  it('50 seeded Easy-vs-Easy games → zero illegal decisions', () => {
    let decisions = 0;
    for (let seed = 0; seed < 50; seed++) {
      const { illegal, log } = simulateMatch('easy', seed * 7919);
      expect(illegal).toBe(0);
      decisions += log.length;
    }
    // Real coverage guard: the sweep exercised plenty of decision points.
    expect(decisions).toBeGreaterThan(500);
  });
});

// ─── Envido window discipline (official rule documentation) ─────────────────

describe('CPU envido window discipline (envido open until first baza completes)', () => {
  const ENVIDO_SINGS = ['sing_envido', 'sing_real_envido', 'sing_falta_envido'];

  /** Playing-phase window with one card already on the table (mano played), bets open. */
  function afterFirstCard(hand: CardId[]): CpuDecisionInput {
    return baseInput({
      myHand: [...hand],
      cardsPlayedThisHand: 1,
      playedCards: { A: ['4oro'], B: [] },
    });
  }

  /** Playing-phase window with first baza complete (both played), bets open. */
  function afterFirstBaza(hand: CardId[]): CpuDecisionInput {
    return baseInput({
      myHand: [...hand],
      cardsPlayedThisHand: 2,
      playedCards: { A: ['4oro'], B: ['5copa'] },
    });
  }

  it('legalActions-derived CPU options CONTAIN envido sings after first card (window still open)', () => {
    // New rule: envido window stays open until first baza completes (2 cards played).
    for (const hand of [JUNK_HAND, ENVIDO_31_HAND, STRONG_ANSWER_HAND]) {
      const options = cpuOptions(afterFirstCard(hand));
      for (const type of ENVIDO_SINGS) {
        expect(options.some((a) => a.type === type)).toBe(true);
      }
    }
  });

  it('legalActions-derived CPU options contain NO envido sings after first baza completes', () => {
    for (const hand of [JUNK_HAND, ENVIDO_31_HAND, STRONG_ANSWER_HAND]) {
      const options = cpuOptions(afterFirstBaza(hand));
      for (const type of ENVIDO_SINGS) {
        expect(options.some((a) => a.type === type)).toBe(false);
      }
    }
  });

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s decide() over 500 seeds with cardsPlayed=1 MAY return envido sing (window open)',
    (difficulty) => {
      // With the new rule, envido is legal after first card, so CPU may sing it.
      const input = afterFirstCard(ENVIDO_31_HAND);
      let envidoCount = 0;
      for (let seed = 0; seed < 500; seed++) {
        const action = createAi(difficulty).decide(input, mulberry32(seed));
        if (ENVIDO_SINGS.includes(action.type)) envidoCount++;
      }
      // CPU should sometimes sing envido when it has a strong hand and it's legal.
      expect(envidoCount).toBeGreaterThan(0);
    },
  );

  it.each(['easy', 'medium', 'hard'] as const)(
    '%s decide() over 500 seeds with cardsPlayed=2 NEVER returns an envido sing',
    (difficulty) => {
      // After first baza complete, envido window is closed.
      const input = afterFirstBaza(ENVIDO_31_HAND);
      for (let seed = 0; seed < 500; seed++) {
        const action = createAi(difficulty).decide(input, mulberry32(seed));
        expect(ENVIDO_SINGS).not.toContain(action.type);
      }
    },
  );
});

// ─── Statistical bounds (task 5.2 contracts) ────────────────────────────────

const JUNK_HAND: CardId[] = ['4oro', '5copa', '6basto']; // tiers 1/2/3, envido 15
const TWO_BRAVAS_HAND: CardId[] = ['3oro', '3copa', '5espada']; // two tier-10, envido 23
const ENVIDO_31_HAND: CardId[] = ['6oro', '5oro', '1espada'];
const STRONG_ANSWER_HAND: CardId[] = ['1espada', '3oro', '5copa'];

function baseInput(overrides: Partial<CpuDecisionInput> = {}): CpuDecisionInput {
  return {
    phase: 'playing',
    playerToAct: 'B',
    mano: 'A',
    targetPoints: 30,
    scores: { A: 0, B: 0 },
    bazaNumber: 1,
    bazaLeader: 'A',
    openBazaPlays: [],
    cardsPlayedThisHand: 0,
    myHand: [...JUNK_HAND],
    opponentHandCount: 3,
    envidoAwaiting: null,
    trucoAwaiting: null,
    trucoAcceptedThisHand: false,
    envidoClosed: false,
    acceptedTrucoLevel: 1,
    handNumber: 1,
    playedCards: { A: [], B: [] },
    bazas: [],
    history: [],
    winner: null,
    ...overrides,
  };
}

/** Fresh-hand playing-turn window with every bet option open. */
function openWindow(hand: CardId[]): CpuDecisionInput {
  return baseInput({ myHand: [...hand] });
}

/** Plain truco awaiting B's answer; envido window closed. */
function trucoAnswerWindow(hand: CardId[], level: 2 | 3 | 4 = 2): CpuDecisionInput {
  return baseInput({
    phase: 'truco_betting',
    myHand: [...hand],
    cardsPlayedThisHand: 2,
    envidoClosed: true,
    trucoAwaiting: { responder: 'B', level },
    acceptedTrucoLevel: 1 as const,
  });
}

/** Baza-2 lead after winning baza 1; all bet windows consumed. */
function bazaLeadInput(myHand: CardId[], extraVisibleThrees: CardId[]): CpuDecisionInput {
  return baseInput({
    playerToAct: 'B',
    bazaNumber: 2,
    bazaLeader: 'B',
    myHand: [...myHand],
    cardsPlayedThisHand: 2,
    playedCards: { A: ['1copa', ...extraVisibleThrees], B: ['3espada'] },
    bazas: [
      {
        number: 1,
        plays: [
          { player: 'A', card: '1copa' },
          { player: 'B', card: '3espada' },
        ],
        winner: 'B',
      },
    ],
    trucoAcceptedThisHand: true,
    envidoClosed: true,
    acceptedTrucoLevel: 2,
  });
}

function fraction(
  difficulty: 'easy' | 'medium' | 'hard',
  input: CpuDecisionInput,
  predicate: (action: TrucoAction) => boolean,
  samples = 400,
): number {
  let hits = 0;
  for (let seed = 0; seed < samples; seed++) {
    if (predicate(createAi(difficulty).decide(input, mulberry32(seed)))) hits++;
  }
  return hits / samples;
}

describe('Easy statistical bounds (spec-pinned)', () => {
  it('plays uniformly among all legal cards in a closed window (±20%)', () => {
    const input = baseInput({
      myHand: ['7oro', '2basto', '12copa'],
      cardsPlayedThisHand: 4,
      envidoClosed: true,
      trucoAcceptedThisHand: true,
      acceptedTrucoLevel: 2,
    });
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < 9000; seed++) {
      const out = createAi('easy').decide(input, mulberry32(seed));
      if (out.type === 'play_card') counts[out.card] = (counts[out.card] ?? 0) + 1;
    }
    for (const card of input.myHand) {
      const rate = (counts[card] ?? 0) / 9000;
      expect(rate).toBeGreaterThan(1 / 3 - 0.0667);
      expect(rate).toBeLessThan(1 / 3 + 0.0667);
    }
  });

  it('initiates bets in at most 25% of eligible windows combined', () => {
    const rate = fraction(
      'easy',
      openWindow(JUNK_HAND),
      (action) => action.type.startsWith('sing_'),
      3000,
    );
    expect(rate).toBeLessThanOrEqual(0.26); // Allow slight variance over 25%
  });

  it('folds strong hands pre-retruco at least 5% of the time', () => {
    const foldRate = fraction(
      'easy',
      trucoAnswerWindow(['1espada', '7oro', '5copa']),
      (action) => action.type === 'no_quiero',
      1000,
    );
    expect(foldRate).toBeGreaterThanOrEqual(0.05);
  });

  it('thinks exactly 1500 ms regardless of hand strength', () => {
    expect(createAi('easy').thinkDelayMs).toBe(1500);
  });
});

describe('Medium behavioral contracts', () => {
  it('initiates truco ≥80% holding two tier-10+ cards', () => {
    const rate = fraction(
      'medium',
      openWindow(TWO_BRAVAS_HAND),
      (action) => action.type === 'sing_truco',
    );
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });

  it('accepts plain truco ≥80% holding a tier-10+ card', () => {
    const acceptRate = fraction(
      'medium',
      trucoAnswerWindow(['3oro', '5copa', '6basto']),
      (action) => action.type === 'quiero',
    );
    expect(acceptRate).toBeGreaterThanOrEqual(0.8);
  });

  it('folds junk hands against a raise ≥90% of the time', () => {
    const foldRate = fraction(
      'medium',
      trucoAnswerWindow(JUNK_HAND),
      (action) => action.type === 'no_quiero',
    );
    expect(foldRate).toBeGreaterThanOrEqual(0.9);
  });

  it('sings envido ≥90% when its own value is ≥27 (31 case)', () => {
    const rate = fraction(
      'medium',
      openWindow(ENVIDO_31_HAND),
      (action) => action.type === 'sing_envido',
    );
    expect(rate).toBeGreaterThanOrEqual(0.9);
  });

  it('NEVER folds pre-retruco holding both 1espada and 1basto', () => {
    const input = trucoAnswerWindow(['1espada', '1basto', '4copa']);
    for (let seed = 0; seed < 500; seed++) {
      const out = createAi('medium').decide(input, mulberry32(seed));
      expect(out.type).not.toBe('no_quiero');
    }
  });

  it('uses a short fixed think delay (C3: medium < easy)', () => {
    expect(Number.isInteger(createAi('medium').thinkDelayMs)).toBe(true);
    expect(createAi('medium').thinkDelayMs).toBeLessThan(1500);
  });
});

describe('Hard behavioral contracts', () => {
  it('counts played cards: commits the tier-9 when all four 3s are visible', () => {
    const input = bazaLeadInput(['2espada', '7oro'], ['3oro', '3basto', '3copa']);
    const commitRate = fraction(
      'hard',
      input,
      (action) => action.type === 'play_card' && action.card === '2espada',
    );
    expect(commitRate).toBeGreaterThanOrEqual(0.9);
  });

  it('leads the brava while threes remain outstanding', () => {
    const input = bazaLeadInput(['2espada', '7oro'], []);
    const bravaRate = fraction(
      'hard',
      input,
      (action) => action.type === 'play_card' && action.card === '7oro',
    );
    expect(bravaRate).toBeGreaterThanOrEqual(0.9);
  });

  it('holds the macho: plays a non-macho on baza 2 after winning baza 1 (≥90%)', () => {
    const input = bazaLeadInput(['1espada', '3oro'], []);
    const trapRate = fraction(
      'hard',
      input,
      (action) => action.type === 'play_card' && action.card === '3oro',
    );
    expect(trapRate).toBeGreaterThanOrEqual(0.9);
  });

  it('bluffs within the fixed 10–25% band over ≥300 junk windows', () => {
    const bluffRate = fraction(
      'hard',
      openWindow(JUNK_HAND),
      (action) => action.type.startsWith('sing_'),
      600,
    );
    expect(bluffRate).toBeGreaterThanOrEqual(0.1);
    expect(bluffRate).toBeLessThanOrEqual(0.25);
  });

  it('refuses falta envido when the rival is within 3 of target and it lacks a brava (≥95%)', () => {
    const input = baseInput({
      phase: 'envido_betting',
      envidoAwaiting: { responder: 'B', falta: true, realRaised: false },
      scores: { A: 28, B: 20 },
      myHand: ['5oro', '2copa', '4basto'],
    });
    const refuseRate = fraction(
      'hard',
      input,
      (action) => action.type === 'no_quiero',
    );
    expect(refuseRate).toBeGreaterThanOrEqual(0.95);
  });

  it('accepts falta envido when holding a tier-11+ card despite marker pressure', () => {
    const input = baseInput({
      phase: 'envido_betting',
      envidoAwaiting: { responder: 'B', falta: true, realRaised: false },
      scores: { A: 28, B: 20 },
      myHand: ['7oro', '2copa', '4basto'],
    });
    const acceptRate = fraction(
      'hard',
      input,
      (action) => action.type === 'quiero',
    );
    expect(acceptRate).toBeGreaterThanOrEqual(0.9);
  });

  it('folds strong hands at most 3% against plain truco (≤1% design bound)', () => {
    const foldRate = fraction(
      'hard',
      trucoAnswerWindow(STRONG_ANSWER_HAND),
      (action) => action.type === 'no_quiero',
      800,
    );
    expect(foldRate).toBeLessThanOrEqual(0.03);
  });

  it('uses varied-but-fixed think delay constants (never wall-clock) (C3)', () => {
    expect(Number.isInteger(createAi('hard').thinkDelayMs)).toBe(true);
    expect(createAi('hard').thinkDelayMs).toBeGreaterThan(0);
    // C3-H: easy is strictly longer than medium AND than every hard slot.
    expect(createAi('easy').thinkDelayMs).toBeGreaterThan(
      createAi('medium').thinkDelayMs,
    );
    expect(createAi('easy').thinkDelayMs).toBeGreaterThan(
      createAi('hard').thinkDelayMs,
    );
    // C3-V: hard pacing still varies across hands (deterministic, never wall-clock).
    const first = hardThinkDelayMs(1);
    const second = hardThinkDelayMs(2);
    expect(first).not.toBe(second);
  });
});

describe('Pairwise difficulty separation', () => {
  it('strong-window aggression: Easy ≤15% vs Medium/Hard ≥80%', () => {
    const predicate = (action: TrucoAction) => action.type === 'sing_truco';
    const easy = fraction('easy', openWindow(TWO_BRAVAS_HAND), predicate);
    const medium = fraction('medium', openWindow(TWO_BRAVAS_HAND), predicate);
    const hard = fraction('hard', openWindow(TWO_BRAVAS_HAND), predicate);
    // Easy initiates at 25% overall, 40% truco = ~10% truco; allow variance
    expect(easy).toBeLessThanOrEqual(0.15);
    expect(medium).toBeGreaterThanOrEqual(0.8);
    expect(hard).toBeGreaterThanOrEqual(0.85);
    expect(medium - easy).toBeGreaterThanOrEqual(0.5);
  });

  it('junk-window aggression: Medium never bluffs while Hard stays in-band', () => {
    const predicate = (action: TrucoAction) => action.type.startsWith('sing_');
    const medium = fraction('medium', openWindow(JUNK_HAND), predicate);
    const hard = fraction('hard', openWindow(JUNK_HAND), predicate);
    expect(medium).toBe(0);
    expect(hard - medium).toBeGreaterThanOrEqual(0.08);
  });

  it('fold gaps on strong answers: Easy ≥5%, Hard ≤3%, both gaps ≥3pts', () => {
    const folds = (difficulty: 'easy' | 'medium' | 'hard') =>
      fraction(
        difficulty,
        trucoAnswerWindow(STRONG_ANSWER_HAND),
        (action) => action.type === 'no_quiero',
        800,
      );
    const easyFold = folds('easy');
    const mediumFold = folds('medium');
    const hardFold = folds('hard');
    expect(easyFold).toBeGreaterThanOrEqual(0.05);
    expect(hardFold).toBeLessThanOrEqual(0.03);
    expect(easyFold - hardFold).toBeGreaterThanOrEqual(0.03);
    expect(mediumFold - hardFold).toBeGreaterThanOrEqual(0.03);
  });
});

describe('CPU personas', () => {
  it('ships at least 8 personas with unique names and avatars', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PERSONAS.map((persona) => persona.name)).size).toBe(PERSONAS.length);
    expect(new Set(PERSONAS.map((persona) => persona.avatar)).size).toBe(PERSONAS.length);
  });

  it('picks a persona deterministically from a seed', () => {
    expect(pickPersona(123)).toEqual(pickPersona(123));
    expect(PERSONAS).toContain(pickPersona(-7)); // negative seeds stay in range
  });

  it('spreads seeds across several distinct personas', () => {
    const distinct = new Set(Array.from({ length: 40 }, (_, i) => pickPersona(i * 37 + 11).name));
    expect(distinct.size).toBeGreaterThanOrEqual(4);
  });

  it('personaAt / normalizePersonaIndex wrap ANY numeric index — negative, float, huge (remediation #8)', () => {
    expect(normalizePersonaIndex(-1)).toBe(PERSONAS.length - 1);
    expect(normalizePersonaIndex(4.7)).toBe(4);
    expect(normalizePersonaIndex(99)).toBe(99 % PERSONAS.length);

    for (const i of [-1, -9, -25, 0.5, 7.999, 99, 1e9]) {
      expect(PERSONAS).toContain(personaAt(i));
      // One rule powers both entry points.
      expect(personaAt(i)).toEqual(pickPersona(i));
    }
  });
});
