import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMultiplayerStore } from '../store/multiplayerStore';

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

describe('useMultiplayerSocket (async — no-op)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({
      matchId: null, screen: 'lobby', opponent: null, question: null,
      score: 0, streak: 0, opponentAnswered: false, remainingMs: 180_000,
      result: null, challengeNotification: null,
    });
  });

  it('should not register any socket listeners (async multiplayer)', () => {
    renderHook(() => useMultiplayerSocket('match-1'));

    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(mockSocket.off).not.toHaveBeenCalled();
  });

  it('should not crash when getSocket returns null', () => {
    vi.mocked(getSocket).mockReturnValueOnce(null as any);

    expect(() => {
      renderHook(() => useMultiplayerSocket('match-1'));
    }).not.toThrow();
  });

  it('should not modify the store', () => {
    renderHook(() => useMultiplayerSocket('match-1'));

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('lobby');
    expect(state.matchId).toBeNull();
  });
});
