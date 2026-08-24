import { describe, expect, it } from 'vitest';
import { createMatch, applyAction } from '../engine.js';
import { mulberry32 } from '../rng.js';
import type { CardId, PlayerSlot, TrucoState } from '../types.js';

const DEPS = () => ({ rng: mulberry32(31) });
const other = (p: PlayerSlot): PlayerSlot => (p === 'A' ? 'B' : 'A');

function makeState(opts?: {
  mano?: PlayerSlot;
  targetPoints?: 15 | 30;
  scores?: Record<PlayerSlot, number>;
}): TrucoState {
  const base = createMatch(
    { mano: opts?.mano ?? 'A', targetPoints: opts?.targetPoints ?? 30 },
    mulberry32(77),
  );
  return opts?.scores ? { ...base, scores: { ...opts.scores } } : base;
}

function withHands(state: TrucoState, a: CardId[], b: CardId[]): TrucoState {
  return { ...state, hands: { A: [...a], B: [...b] } };
}

/** A holds the strongest comparison hand (33), B junk (6). */
function strongAvsWeakB(state: TrucoState): TrucoState {
  return withHands(state, ['7espada', '6espada', '1oro'], ['4oro', '5copa', '12espada']);
}

type SingCall = 'sing_envido' | 'sing_real_envido' | 'sing_falta_envido';
type AnswerCall = 'quiero' | 'no_quiero';

interface MatrixRow {
  name: string;
  /** Calls in order; call i is sung by A when i is even, else B. */
  calls: SingCall[];
  acceptedPays: number;
  refusedPays: number;
}

// Normative stake matrix (spec: "Envido betting chain and exact stake matrix").
const MATRIX: MatrixRow[] = [
  { name: 'Envido', calls: ['sing_envido'], acceptedPays: 2, refusedPays: 1 },
  { name: 'Real Envido (direct)', calls: ['sing_real_envido'], acceptedPays: 3, refusedPays: 1 },
  { name: 'Falta Envido (direct)', calls: ['sing_falta_envido'], acceptedPays: 30, refusedPays: 1 },
  { name: 'Envido → Re-envido', calls: ['sing_envido', 'sing_envido'], acceptedPays: 4, refusedPays: 2 },
  { name: 'Envido → Real Envido', calls: ['sing_envido', 'sing_real_envido'], acceptedPays: 5, refusedPays: 2 },
  { name: 'Real Envido → Real Envido', calls: ['sing_real_envido', 'sing_real_envido'], acceptedPays: 6, refusedPays: 3 },
  {
    name: 'Envido → Re-envido → Real Envido',
    calls: ['sing_envido', 'sing_envido', 'sing_real_envido'],
    acceptedPays: 7,
    refusedPays: 4,
  },
  { name: 'Envido → Falta Envido', calls: ['sing_envido', 'sing_falta_envido'], acceptedPays: 30, refusedPays: 2 },
  {
    name: 'Envido → Real Envido → Falta Envido',
    calls: ['sing_envido', 'sing_real_envido', 'sing_falta_envido'],
    acceptedPays: 30,
    refusedPays: 5,
  },
];

/** Sings the whole chain alternating singers (even index → A), then answers. */
function runChain(state: TrucoState, calls: SingCall[], answer: AnswerCall) {
  let current = state;
  for (let i = 0; i < calls.length; i++) {
    const actor: PlayerSlot = i % 2 === 0 ? 'A' : 'B';
    const result = applyAction(current, { type: calls[i]!, actor }, DEPS());
    if (!result.ok) throw new Error(`call ${calls[i]} failed: ${result.errorCode}`);
    current = result.state;
  }
  const responderActor: PlayerSlot =
    current.envido === null ? 'A' : current.envido.awaitingResponder;
  const final = applyAction(current, { type: answer, actor: responderActor }, DEPS());
  if (!final.ok) throw new Error(`answer ${answer} failed: ${final.errorCode}`);
  return final;
}

describe('Betting sub-phase round trip (Explicit state machine)', () => {
  it('envido sung from playing moves to envido_betting with responder = non-singer', () => {
    const state = makeState();
    const result = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!result.ok) throw new Error(result.errorCode);
    expect(result.state.phase).toBe('envido_betting');
    expect(result.state.envido?.awaitingResponder).toBe('B');
    expect(result.state.envido?.lastCaller).toBe('A');
  });

  it('quiero returns the phase to playing and the result joins public history', () => {
    const state = strongAvsWeakB(makeState());
    const opened = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    expect(settled.state.phase).toBe('playing');
    expect(settled.state.envido).toBeNull();
    const showdowns = settled.state.history.filter((e) => e.type === 'envido_showdown');
    expect(showdowns).toHaveLength(1);
    expect(settled.state.scores.A).toBe(2);
  });
});

describe('Envido stake matrix (all 9 refusal rows + acceptance totals)', () => {
  for (const row of MATRIX) {
    const falta = row.name.includes('Falta');

    it(`${row.name}: accepted pays ${falta ? 'the falta formula (30 @ 0-0)' : row.acceptedPays}`, () => {
      // Falta rows are asserted against the formula target − max(scores) = 30 @ 0-0.
      const state = strongAvsWeakB(makeState({ scores: { A: 0, B: 0 } }));
      const final = runChain(state, row.calls, 'quiero');
      expect(final.state.scores.A).toBe(row.acceptedPays);
      expect(final.state.scores.B).toBe(0);
      expect(final.state.history.some((e) => e.type === 'envido_showdown')).toBe(true);
    });

    it(`${row.name}: refusal pays ${row.refusedPays} to the last caller`, () => {
      const state = makeState();
      const final = runChain(state, row.calls, 'no_quiero');
      const lastCallerIsA = row.calls.length % 2 === 1;
      const expectedSide: PlayerSlot = lastCallerIsA ? 'A' : 'B';
      expect(final.state.scores[expectedSide]).toBe(row.refusedPays);
      // Refusal reveals nothing: no showdown ever hits public history.
      expect(final.state.history.some((e) => e.type === 'envido_showdown')).toBe(false);
    });
  }

  it('Accept accumulates: Envido → Real → Real answered quiero = 8 points', () => {
    const state = strongAvsWeakB(makeState());
    const final = runChain(state, ['sing_envido', 'sing_real_envido', 'sing_real_envido'], 'quiero');
    expect(final.state.scores.A).toBe(8);
  });

  it('only the responder may raise; the singer acting early is rejected', () => {
    const state = makeState();
    const opened = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const selfRaise = applyAction(opened.state, { type: 'sing_real_envido', actor: 'A' }, DEPS());
    if (selfRaise.ok) throw new Error('must reject');
    expect(selfRaise.errorCode).toBe('E_NOT_RESPONDER');
  });

  it('post-answer envido bets are rejected permanently for the hand', () => {
    const state = strongAvsWeakB(makeState());
    const final = runChain(state, ['sing_envido'], 'quiero');
    const again = applyAction(final.state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (again.ok) throw new Error('must reject');
    expect(again.errorCode).toBe('E_ENVIDO_BETTING_CLOSED');
    expect(again.state).toBe(final.state);
  });

  it('illegal raise order: real envido cannot be answered with an envido raise', () => {
    const state = makeState();
    const opened = applyAction(state, { type: 'sing_real_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const illegal = applyAction(opened.state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (illegal.ok) throw new Error('must reject');
    expect(illegal.errorCode).toBe('E_ILLEGAL_RAISE_ORDER');
  });

  it('illegal raise order: envido raise after a real raise in the chain', () => {
    const state = strongAvsWeakB(makeState());
    const e = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!e.ok) throw new Error(e.errorCode);
    const r = applyAction(e.state, { type: 'sing_real_envido', actor: 'B' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    const backDown = applyAction(r.state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (backDown.ok) throw new Error('must reject');
    expect(backDown.errorCode).toBe('E_ILLEGAL_RAISE_ORDER');
  });

  it('falta envido is terminal: no raise may follow it', () => {
    const state = makeState();
    const opened = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const falta = applyAction(opened.state, { type: 'sing_falta_envido', actor: 'B' }, DEPS());
    if (!falta.ok) throw new Error(falta.errorCode);
    for (const raise of ['sing_envido', 'sing_real_envido'] as const) {
      const attempt = applyAction(falta.state, { type: raise, actor: 'A' }, DEPS());
      if (attempt.ok) throw new Error('must reject');
      expect(attempt.errorCode).toBe('E_ILLEGAL_RAISE_ORDER');
    }
    const doubleFalta = applyAction(falta.state, { type: 'sing_falta_envido', actor: 'A' }, DEPS());
    if (doubleFalta.ok) throw new Error('must reject');
    expect(doubleFalta.errorCode).toBe('E_ILLEGAL_RAISE_ORDER');
  });
});

describe('Falta envido settlement (formula computed at settlement time)', () => {
  it('trailer wins falta envido: receives what the leader lacked (target 30, 25/20 → +5)', () => {
    // B is the trailer (20) but holds the strong comparison hand → trailer wins.
    const swapped = withHands(
      makeState({ scores: { A: 25, B: 20 } }),
      ['4oro', '5copa', '12espada'],
      ['7espada', '6espada', '1oro'],
    );
    const opened = applyAction(swapped, { type: 'sing_falta_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    expect(settled.state.scores.B).toBe(25); // 20 + 5
    expect(settled.state.scores.A).toBe(25); // unchanged
    expect(settled.state.phase).toBe('playing'); // nobody reached 30
  });

  it('leader wins falta envido: reaches target and the match ends immediately', () => {
    const state = strongAvsWeakB(makeState({ scores: { A: 28, B: 22 } }));
    const opened = applyAction(state, { type: 'sing_falta_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    expect(settled.state.scores.A).toBe(30);
    expect(settled.state.phase).toBe('match_end');
    expect(settled.state.winner).toBe('A');
  });

  it('equal scores whole game: winner receives the full target (30 @ 0-0)', () => {
    const state = strongAvsWeakB(makeState({ scores: { A: 0, B: 0 } }));
    const opened = applyAction(state, { type: 'sing_falta_envido', actor: 'A' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    expect(settled.state.scores.A).toBe(30);
    expect(settled.state.phase).toBe('match_end');
    expect(settled.state.winner).toBe('A');
  });

  it('tie goes to mano: equal envido values hand the award to the mano side', () => {
    const tied = withHands(
      makeState({ mano: 'B', scores: { A: 10, B: 10 } }),
      ['5oro', '3oro', '12espada'], // 28
      ['5copa', '3copa', '11basto'], // 28
    );
    const opened = applyAction(tied, { type: 'sing_falta_envido', actor: 'B' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'A' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    // Mano is B; falta amount = 30 − max(10,10) = 20 → B reaches 30.
    // (B opens because playerToAct = mano; A answers as responder.)
    expect(settled.state.winner).toBe('B');
    expect(settled.state.scores.B).toBe(30);
    const showdown = settled.state.history.find((e) => e.type === 'envido_showdown');
    expect(showdown).toMatchObject({ type: 'envido_showdown', winner: 'B' });
  });
});

describe('Envido timing windows', () => {
  it('envido OPENING from the waiting seat is rejected with E_OUT_OF_TURN and leaves state untouched', () => {
    // Fresh hand, no cards played, windows fully open — the ONLY blocker is
    // turn order: playerToAct = A (mano), so B may not open the bet.
    const state = makeState({ mano: 'A' });
    expect(state.playerToAct).toBe('A');
    const attempt = applyAction(state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_OUT_OF_TURN');
    expect(attempt.state).toBe(state);
  });

  it('every envido opening variant is turn-guarded, while the on-turn seat still opens fine', () => {
    const waiting = makeState({ mano: 'A' });
    for (const type of ['sing_real_envido', 'sing_falta_envido'] as const) {
      const attempt = applyAction(waiting, { type, actor: 'B' }, DEPS());
      if (attempt.ok) throw new Error(`must reject ${type}`);
      expect(attempt.errorCode).toBe('E_OUT_OF_TURN');
    }
    // Triangulation: the on-turn seat (playerToAct = B) opens without issue.
    const onTurn = makeState({ mano: 'B' });
    const opened = applyAction(onTurn, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    expect(opened.state.phase).toBe('envido_betting');
    expect(opened.state.envido?.lastCaller).toBe('B');
  });

  it('after the first card hits the table, envido initiation is rejected and state unchanged', () => {
    const state = makeState();
    const led = applyAction(state, { type: 'play_card', actor: 'A', card: state.hands.A[0]! }, DEPS());
    if (!led.ok) throw new Error(led.errorCode);
    for (const actor of ['B', 'A'] as const) {
      const attempt = applyAction(led.state, { type: 'sing_envido', actor }, DEPS());
      if (attempt.ok) throw new Error('must reject');
      expect(attempt.errorCode).toBe('E_ENVIDO_WINDOW_CLOSED');
      expect(attempt.state).toBe(led.state);
    }
  });

  it('after a truco bet was accepted this hand, envido initiation is rejected', () => {
    const state = makeState();
    const truco = applyAction(state, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!truco.ok) throw new Error(truco.errorCode);
    const quiero = applyAction(truco.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!quiero.ok) throw new Error(quiero.errorCode);
    const attempt = applyAction(quiero.state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (attempt.ok) throw new Error('must reject');
    expect(attempt.errorCode).toBe('E_ENVIDO_WINDOW_CLOSED');
  });
});

describe('Envido takes precedence over pending truco', () => {
  function trucoPendingThenEnvido() {
    const state = strongAvsWeakB(makeState());
    const truco = applyAction(state, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!truco.ok) throw new Error(truco.errorCode);
    expect(truco.state.phase).toBe('truco_betting');
    // The challenged side answers by OPENING envido instead of quiero/no quiero.
    const opened = applyAction(truco.state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    return { parked: truco.state.truco, opened };
  }

  it('the truco bet stays parked while envido resolves, then resurfaces for the same responder', () => {
    const { parked, opened } = trucoPendingThenEnvido();
    expect(opened.state.phase).toBe('envido_betting');
    expect(opened.state.parkedTruco).toEqual(parked);

    // A (original truco singer) is now the ENVIDO responder and answers quiero.
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'A' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    // Envido settled FIRST (A won the comparison: +2)…
    expect(settled.state.scores.A).toBe(2);
    // …and the ORIGINAL truco still awaits B's answer.
    expect(settled.state.phase).toBe('truco_betting');
    expect(settled.state.truco).toMatchObject({ level: 2, singer: 'A', responder: 'B' });
    expect(settled.state.parkedTruco).toBeNull();
  });

  it('an envido award that ends the match VOIDS the pending truco', () => {
    const state = strongAvsWeakB(makeState({ targetPoints: 15, scores: { A: 14, B: 0 } }));
    const truco = applyAction(state, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!truco.ok) throw new Error(truco.errorCode);
    const opened = applyAction(truco.state, { type: 'sing_envido', actor: 'B' }, DEPS());
    if (!opened.ok) throw new Error(opened.errorCode);
    const settled = applyAction(opened.state, { type: 'quiero', actor: 'A' }, DEPS());
    if (!settled.ok) throw new Error(settled.errorCode);
    // A reached 16 ≥ 15: match over, pending truco never answered.
    expect(settled.state.phase).toBe('match_end');
    expect(settled.state.winner).toBe('A');
    expect(settled.state.scores.A).toBe(16);
    expect(settled.state.truco).toBeNull();
    expect(settled.state.parkedTruco).toBeNull();
    // No baza/truco prize was scored beyond the envido award.
    const awarded = settled.events.filter((e) => e.type === 'points_awarded');
    expect(awarded).toHaveLength(1);
    expect(awarded[0]).toMatchObject({ side: 'A', amount: 2 });
  });

  it('the truco singer cannot dodge his own pending bet by singing envido', () => {
    const state = strongAvsWeakB(makeState());
    const truco = applyAction(state, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!truco.ok) throw new Error(truco.errorCode);
    const dodge = applyAction(truco.state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (dodge.ok) throw new Error('must reject');
    expect(dodge.errorCode).toBe('E_AWAITING_OWN_BET');
  });
});
