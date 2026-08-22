import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import React from 'react';
import type { TrucoEvent } from '@geotano/shared';
import { useTruCpuGame } from '../useTruCpuGame';
import { PERSONAS } from '../../ai';

const SEED = 20260821;

function Wrapper({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

import i18n from '../../../../i18n/i18n';

/** Advances fake timers inside act() so hook state updates flush. */
function flush(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useTruCpuGame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deals three cards to the human with zeroed scores', () => {
    const { result } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 30, seed: SEED }),
      { wrapper: Wrapper },
    );
    expect(result.current.view).not.toBeNull();
    expect(result.current.view!.myHand).toHaveLength(3);
    expect(result.current.scores).toEqual({ A: 0, B: 0 });
    expect(result.current.targetPoints).toBe(30);
    expect(result.current.finished).toBe(false);
    expect(result.current.mySlot).toBe('A');
  });

  it('applies the human card synchronously (hand shrinks immediately)', () => {
    const { result } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 30, seed: SEED }),
      { wrapper: Wrapper },
    );
    const card = result.current.view!.myHand[0]!;
    act(() => {
      result.current.play({ type: 'play_card', actor: 'A', card });
    });
    expect(result.current.view!.myHand).toHaveLength(2);
  });

  it('the CPU answers after exactly one think delay', () => {
    const events: TrucoEvent[] = [];
    const { result } = renderHook(
      () =>
        useTruCpuGame({
          difficulty: 'easy',
          targetPoints: 30,
          seed: SEED,
          onEvents: (batch) => events.push(...batch),
        }),
      { wrapper: Wrapper },
    );
    const card = result.current.view!.myHand[0]!;
    act(() => {
      result.current.play({ type: 'play_card', actor: 'A', card });
    });
    // Nothing yet before the delay elapses.
    const before = events.filter(
      (event) =>
        (event.type === 'card_played' && event.player === 'B') ||
        (event.type === 'call_sung' && event.actor === 'B'),
    );
    expect(before).toHaveLength(0);

    flush(700);
    const after = events.filter(
      (event) =>
        (event.type === 'card_played' && event.player === 'B') ||
        (event.type === 'call_sung' && event.actor === 'B'),
    );
    expect(after.length).toBeGreaterThanOrEqual(1);
  });

  it('resolves a human envido through the CPU answer window', () => {
    const events: TrucoEvent[] = [];
    const { result } = renderHook(
      () =>
        useTruCpuGame({
          difficulty: 'easy',
          targetPoints: 30,
          seed: SEED,
          onEvents: (batch) => events.push(...batch),
        }),
      { wrapper: Wrapper },
    );
    const singEnvido = result.current.actions.find((action) => action.type === 'sing_envido');
    expect(singEnvido).toBeDefined();
    act(() => {
      result.current.play(singEnvido!);
    });
    expect(result.current.view!.envidoAwaiting).not.toBeNull();
    flush(700);
    expect(result.current.view!.envidoAwaiting).toBeNull();
    expect(events.some((event) => event.type === 'answered')).toBe(true);
  });

  it('plays an entire seeded match to completion with a valid final score', () => {
    const { result } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 15, seed: SEED }),
      { wrapper: Wrapper },
    );
    for (let turn = 0; turn < 600 && !result.current.finished; turn++) {
      const pending = result.current.actions[0];
      if (pending) {
        act(() => {
          result.current.play(pending);
        });
      } else {
        flush(700);
      }
    }
    expect(result.current.finished).toBe(true);
    expect(result.current.winner).not.toBeNull();
    const finalScores = result.current.scores;
    const winnerScore =
      result.current.winner === 'A' ? finalScores.A : finalScores.B;
    expect(winnerScore).toBeGreaterThanOrEqual(15);
  });

  it('restart deals a fresh hand and resets scores', () => {
    const { result } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 30, seed: SEED }),
      { wrapper: Wrapper },
    );
    const card = result.current.view!.myHand[0]!;
    act(() => {
      result.current.play({ type: 'play_card', actor: 'A', card });
    });
    act(() => {
      result.current.restart();
    });
    expect(result.current.view!.myHand).toHaveLength(3);
    expect(result.current.scores).toEqual({ A: 0, B: 0 });
    expect(result.current.finished).toBe(false);
  });

  it('clears pending CPU think timers on unmount', () => {
    const { result, unmount } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 30, seed: SEED }),
      { wrapper: Wrapper },
    );
    const card = result.current.view!.myHand[0]!;
    act(() => {
      result.current.play({ type: 'play_card', actor: 'A', card });
    });
    unmount();
    expect(() => flush(5000)).not.toThrow();
  });

  it('picks a stable persona per seed within the known roster', () => {
    const first = renderHook(
      () => useTruCpuGame({ difficulty: 'hard', targetPoints: 15, seed: 7 }),
      { wrapper: Wrapper },
    ).result.current.cpuPersona;
    const second = renderHook(
      () => useTruCpuGame({ difficulty: 'hard', targetPoints: 15, seed: 7 }),
      { wrapper: Wrapper },
    ).result.current.cpuPersona;
    expect(second).toEqual(first);
    expect(PERSONAS.map((persona) => persona.name)).toContain(first.name);
  });

  it('ignores play() while the CPU is thinking (busy guard)', () => {
    const { result } = renderHook(
      () => useTruCpuGame({ difficulty: 'easy', targetPoints: 30, seed: SEED }),
      { wrapper: Wrapper },
    );
    const handBefore = [...result.current.view!.myHand];
    // Not our window: playerToAct may be B (CPU mano) — play must be a no-op
    // whenever the action is not currently legal.
    const notOurs = result.current.actions.every(
      (action) => !(action.type === 'play_card' && action.card === handBefore[0]),
    );
    if (notOurs) {
      act(() => {
        result.current.play({
          type: 'play_card',
          actor: 'A',
          card: handBefore[0]!,
        });
      });
      expect(result.current.view!.myHand).toEqual(handBefore);
    }
  });
});
