import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useMultiplayerStore } from '../store/multiplayerStore';
import type { QuizQuestion, MatchResult, PlayerStats } from '@geotano/shared';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

vi.mock('../lib/socket', () => ({
  getSocket: vi.fn(() => mockSocket),
}));

import { useMultiplayerSocket } from '../features/multiplayer/useMultiplayerSocket';
import { getSocket } from '../lib/socket';

describe('useMultiplayerSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({
      matchId: null, screen: 'lobby', opponent: null, question: null,
      score: 0, streak: 0, opponentAnswered: false, remainingMs: 180_000,
      result: null, challengeNotification: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should register five socket listeners on mount', () => {
    renderHook(() => useMultiplayerSocket('match-1'));

    expect(mockSocket.on).toHaveBeenCalledWith('match:start', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('match:question', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('match:opponent_answered', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('match:timer_tick', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('match:end', expect.any(Function));
  });

  it('should not crash when getSocket returns null', () => {
    vi.mocked(getSocket).mockReturnValueOnce(null as any);

    expect(() => {
      renderHook(() => useMultiplayerSocket('match-1'));
    }).not.toThrow();
  });

  it('should unregister all listeners on unmount', () => {
    const { unmount } = renderHook(() => useMultiplayerSocket('match-1'));
    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('match:start', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('match:question', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('match:opponent_answered', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('match:timer_tick', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('match:end', expect.any(Function));
  });

  it('should re-register listeners when matchId changes', () => {
    const { rerender } = renderHook(
      (p: { matchId: string }) => useMultiplayerSocket(p.matchId),
      { initialProps: { matchId: 'match-1' } },
    );

    expect(mockSocket.on).toHaveBeenCalledTimes(5);
    const onCount = mockSocket.on.mock.calls.length;

    rerender({ matchId: 'match-2' });

    expect(mockSocket.off).toHaveBeenCalledTimes(5);
    expect(mockSocket.on.mock.calls.length).toBe(onCount + 5);
  });

  describe('match:start handler', () => {
    it('should transition to playing screen with opponent and first question', () => {
      renderHook(() => useMultiplayerSocket('match-1'));

      const cb = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:start',
      )![1];

      const payload = {
        matchId: 'match-1',
        opponent: { id: 'user-2', username: 'bob', email: '', language: 'en' as const, joinCode: '', createdAt: '' },
        timeLimitMs: 180_000,
        question: { id: 'q-1', countryId: 'c-1', questionType: 'free', questionText: 'Test?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, timeLimitMs: 3000, questionNumber: 1 },
      };

      cb(payload);

      const state = useMultiplayerStore.getState();
      expect(state.screen).toBe('playing');
      expect(state.matchId).toBe('match-1');
      expect(state.opponent?.username).toBe('bob');
      expect(state.question?.id).toBe('q-1');
      expect(state.remainingMs).toBe(180_000);
    });
  });

  describe('match:question handler', () => {
    it('should set question and reset opponentAnswered', () => {
      renderHook(() => useMultiplayerSocket('match-1'));

      const questionCallback = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:question',
      )![1];

      const question: QuizQuestion = {
        id: 'q-3', countryId: 'c-3', questionType: 'free',
        questionText: 'New question?', options: ['A', 'B', 'C', 'D'],
        correctIndex: 1, timeLimitMs: 3000, questionNumber: 3,
      };

      // Set opponentAnswered to true first
      useMultiplayerStore.getState().showOpponentAnswered(true);
      expect(useMultiplayerStore.getState().opponentAnswered).toBe(true);

      questionCallback({ matchId: 'match-1', question });

      const state = useMultiplayerStore.getState();
      expect(state.question?.id).toBe('q-3');
      expect(state.opponentAnswered).toBe(false);
    });
  });

  describe('match:opponent_answered handler', () => {
    it('should set opponentAnswered to true, then auto-reset after 2s', () => {
      vi.useFakeTimers();
      renderHook(() => useMultiplayerSocket('match-1'));

      const cb = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:opponent_answered',
      )![1];

      cb({ matchId: 'match-1' });
      expect(useMultiplayerStore.getState().opponentAnswered).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(useMultiplayerStore.getState().opponentAnswered).toBe(false);

      vi.useRealTimers();
    });

    it('should clear previous timeout on rapid successive calls', () => {
      vi.useFakeTimers();
      renderHook(() => useMultiplayerSocket('match-1'));

      const cb = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:opponent_answered',
      )![1];

      cb({ matchId: 'match-1' });
      cb({ matchId: 'match-1' }); // second call clears first timeout

      vi.advanceTimersByTime(2000);
      expect(useMultiplayerStore.getState().opponentAnswered).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('match:timer_tick handler', () => {
    it('should update remaining time in store', () => {
      renderHook(() => useMultiplayerSocket('match-1'));

      const cb = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:timer_tick',
      )![1];

      cb({ matchId: 'match-1', remainingMs: 120_000 });
      expect(useMultiplayerStore.getState().remainingMs).toBe(120_000);

      cb({ matchId: 'match-1', remainingMs: 90_000 });
      expect(useMultiplayerStore.getState().remainingMs).toBe(90_000);
    });
  });

  describe('match:end handler', () => {
    it('should end match with result in store', () => {
      renderHook(() => useMultiplayerSocket('match-1'));

      const cb = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'match:end',
      )![1];

      const result: MatchResult = {
        matchId: 'match-1', winnerId: 'user-1',
        reason: 'timer_expired',
        players: [
          { userId: 'user-1', username: 'alice', score: 600, correctCount: 6, totalAnswered: 8, maxStreak: 4 },
          { userId: 'user-2', username: 'bob', score: 400, correctCount: 4, totalAnswered: 7, maxStreak: 3 },
        ],
      };

      cb({ matchId: 'match-1', result });

      const state = useMultiplayerStore.getState();
      expect(state.screen).toBe('ended');
      expect(state.result?.winnerId).toBe('user-1');
    });
  });
});
