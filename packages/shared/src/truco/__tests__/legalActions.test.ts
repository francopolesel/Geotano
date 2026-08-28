import { describe, expect, it } from 'vitest';
import { applyAction, createMatch } from '../engine.js';
import { legalActions } from '../legalActions.js';
import { mulberry32 } from '../rng.js';
import { toPublicContext } from '../view.js';
import type { PlayerSlot, TrucoAction, TrucoState } from '../types.js';

const DEPS = () => ({ rng: mulberry32(23) });

function makeState(opts?: { mano?: PlayerSlot }): TrucoState {
  return createMatch({ mano: opts?.mano ?? 'A' }, mulberry32(7));
}

function acts(state: TrucoState, viewer: PlayerSlot): TrucoAction[] {
  return legalActions(toPublicContext(state, viewer), viewer);
}

const TYPES = (list: TrucoAction[]) => list.map((a) => a.type).sort();

describe('legalActions — per-phase enumeration', () => {
  it('waiting_for_players exposes only start', () => {
    const state = createMatch({}, mulberry32(1));
    // createMatch deals immediately in this engine; synthesize the pre-start phase.
    const waiting: TrucoState = { ...structuredClone(state), phase: 'waiting_for_players', hands: { A: [], B: [] } };
    expect(TYPES(acts(waiting, 'A'))).toEqual(['start']);
  });

  it('fresh playing hand for the actor: three card plays + envido trio + truco', () => {
    const state = makeState();
    const list = acts(state, 'A'); // A is mano/playerToAct
    const plays = list.filter((a) => a.type === 'play_card');
    expect(plays.map((a) => (a as { card: string }).card).sort()).toEqual([...state.hands.A].sort());
    expect(TYPES(list)).toEqual(
      [
        'play_card',
        'play_card',
        'play_card',
        'sing_envido',
        'sing_falta_envido',
        'sing_real_envido',
        'sing_truco',
      ].sort(),
    );
    // Every returned action carries the viewer as actor (engine-compatible).
    for (const a of list) {
      if ('actor' in a) expect(a.actor).toBe('A');
    }
  });

  it('not my turn during playing → empty', () => {
    const state = makeState({ mano: 'A' });
    expect(acts(state, 'B')).toEqual([]);
  });

  it('after the first card: envido family vanishes, truco and remaining cards stay', () => {
    let state = makeState();
    const r = applyAction(state, { type: 'play_card', actor: 'A', card: state.hands.A[0]! }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    state = r.state;
    const list = acts(state, 'B');
    const types = TYPES(list);
    expect(types).not.toContain('sing_envido');
    expect(types).not.toContain('sing_real_envido');
    expect(types).not.toContain('sing_falta_envido');
    expect(types).toContain('sing_truco');
    // B answered without playing yet: his full hand of 3 is playable.
    const plays = list.filter((a) => a.type === 'play_card');
    expect(plays).toHaveLength(3);
  });

  it('after truco accepted: envido calls closed, plain truco gone, card plays remain', () => {
    let state = makeState();
    let r = applyAction(state, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'quiero', actor: 'B' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    const list = acts(r.state, 'A');
    const types = TYPES(list);
    expect(types).toContain('play_card');
    expect(types).not.toContain('sing_envido');
    expect(types).not.toContain('sing_truco');
    expect(types).not.toContain('sing_retruco'); // raises ride on PENDING bets only
  });

  it('match_end and hand_end expose nothing', () => {
    const base = makeState();
    const ended: TrucoState = { ...structuredClone(base), phase: 'match_end', winner: 'A' };
    expect(acts(ended, 'A')).toEqual([]);
    expect(acts(ended, 'B')).toEqual([]);
    const handEnd: TrucoState = { ...structuredClone(base), phase: 'hand_end', handWinner: 'A' };
    expect(acts(handEnd, 'A')).toEqual([]);
  });
});

describe('legalActions — betting phases answer/raise rights', () => {
  function envidoOpen(state: TrucoState, call: 'sing_envido' | 'sing_real_envido' | 'sing_falta_envido') {
    const r = applyAction(state, { type: call, actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    return r.state;
  }

  it('plain envido pending: responder may answer + raise envido/real/falta; singer sees nothing', () => {
    const state = envidoOpen(makeState(), 'sing_envido');
    expect(TYPES(acts(state, 'B'))).toEqual(
      ['no_quiero', 'quiero', 'sing_envido', 'sing_falta_envido', 'sing_real_envido'].sort(),
    );
    expect(acts(state, 'A')).toEqual([]);
  });

  it('real envido pending: neither plain envido nor real envido raise is offered (bounded)', () => {
    const state = envidoOpen(makeState(), 'sing_real_envido');
    expect(TYPES(acts(state, 'B'))).toEqual(
      ['no_quiero', 'quiero', 'sing_falta_envido'].sort(),
    );
    // F1: a real envido cannot be called again once a real raise is pending.
    expect(acts(state, 'B').map((a) => a.type)).not.toContain('sing_real_envido');
  });

  it('falta envido pending: terminal — answers only', () => {
    const state = envidoOpen(makeState(), 'sing_falta_envido');
    expect(TYPES(acts(state, 'B'))).toEqual(['no_quiero', 'quiero'].sort());
  });

  it('truco pending (level 2): answers + retruco (+ envido family while window open)', () => {
    const state0 = makeState();
    const r = applyAction(state0, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    expect(TYPES(acts(r.state, 'B'))).toEqual(
      [
        'no_quiero',
        'quiero',
        'sing_retruco',
        'sing_envido',
        'sing_real_envido',
        'sing_falta_envido',
      ].sort(),
    );
  });

  it('retruco pending (level 3): vale cuatro available; level 4: answers only', () => {
    const state0 = makeState();
    let r = applyAction(state0, { type: 'sing_truco', actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    r = applyAction(r.state, { type: 'sing_retruco', actor: 'B' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    expect(TYPES(acts(r.state, 'A'))).toContain('sing_vale_cuatro');
    r = applyAction(r.state, { type: 'sing_vale_cuatro', actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    // Vale is terminal for raises, but envido precedence still lets B open
    // envido instead of answering (engine-tested in envidoBets).
    expect(TYPES(acts(r.state, 'B'))).toEqual(
      [
        'no_quiero',
        'quiero',
        'sing_envido',
        'sing_real_envido',
        'sing_falta_envido',
      ].sort(),
    );
  });
});

describe('legalActions — consistency with the engine', () => {
  it('every enumerated action is accepted by applyAction across sampled states', () => {
    const samples: TrucoState[] = [];
    let state = makeState();
    samples.push(state);
    let r = applyAction(state, { type: 'sing_envido', actor: 'A' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    samples.push(r.state);
    r = applyAction(r.state, { type: 'sing_real_envido', actor: 'B' }, DEPS());
    if (!r.ok) throw new Error(r.errorCode);
    samples.push(r.state);

    for (const s of samples) {
      const viewer: PlayerSlot =
        s.phase === 'playing' || s.phase === 'waiting_for_players'
          ? s.playerToAct
          : (s.envido?.awaitingResponder ?? s.truco?.responder ?? 'A');
      for (const action of acts(s, viewer)) {
        const result = applyAction(s, action, DEPS());
        if (!result.ok) {
          throw new Error(`legalActions emitted ${action.type} but engine rejected: ${result.errorCode}`);
        }
      }
    }
  });
});
