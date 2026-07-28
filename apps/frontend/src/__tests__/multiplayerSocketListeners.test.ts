import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMultiplayerStore } from '../store/multiplayerStore';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

describe('challenge:accepted listener', () => {
  it('should register challenge:accepted listener on connect', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const callback = mockSocket.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'challenge:accepted',
    );

    expect(callback).toBeDefined();
  });
});

describe('socket challenge:invite listener', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({
      matchId: null, screen: 'lobby', opponent: null, question: null,
      score: 0, streak: 0, opponentAnswered: false, remainingMs: 180_000,
      result: null, challengeNotification: null,
    });

    // Reset socket state
    const { disconnectSocket } = await import('../lib/socket');
    disconnectSocket();
  });

  afterEach(() => {
    // Disconnect after each test to reset module state
  });

  it('should register challenge:invite listener on connect', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const challengeCallback = mockSocket.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'challenge:invite',
    );

    expect(challengeCallback).toBeDefined();
  });

  it('should show challenge notification when challenge:invite fires', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const challengeCallback = mockSocket.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'challenge:invite',
    )![1];

    const payload = {
      challengeId: 'ch-123',
      challenger: {
        id: 'user-5',
        username: 'challenger_user',
        email: '',
        language: 'en' as const,
        joinCode: '',
        createdAt: '',
      },
    };

    challengeCallback(payload);

    const state = useMultiplayerStore.getState();
    expect(state.challengeNotification).not.toBeNull();
    expect(state.challengeNotification?.challengeId).toBe('ch-123');
    expect(state.challengeNotification?.challenger.username).toBe('challenger_user');
  });

  it('should not throw when handler is not set (graceful fallback)', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const challengeCallback = mockSocket.on.mock.calls.find(
      (call: [string, Function]) => call[0] === 'challenge:invite',
    )![1];

    // Reset store to null first
    useMultiplayerStore.setState({ challengeNotification: null });

    expect(() => {
      challengeCallback({
        challengeId: 'ch-456',
        challenger: { id: 'u-6', username: 'test', email: '', language: 'en', joinCode: '', createdAt: '' },
      });
    }).not.toThrow();
  });

  describe('sendChallenge', () => {
    it('should emit challenge:send when connected', async () => {
      const { connectSocket, sendChallenge } = await import('../lib/socket');
      connectSocket('test-token');

      sendChallenge('user-2');

      expect(mockSocket.emit).toHaveBeenCalledWith('challenge:send', { receiverId: 'user-2' });
    });

    it('should not emit when not connected', async () => {
      const { sendChallenge } = await import('../lib/socket');

      sendChallenge('user-2');

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('cancelChallenge', () => {
    it('should emit challenge:cancel when connected', async () => {
      const { connectSocket, cancelChallenge } = await import('../lib/socket');
      connectSocket('test-token');

      cancelChallenge();

      expect(mockSocket.emit).toHaveBeenCalledWith('challenge:cancel', {});
    });
  });

  describe('acceptChallenge', () => {
    it('should emit challenge:accept when connected', async () => {
      const { connectSocket, acceptChallenge } = await import('../lib/socket');
      connectSocket('test-token');

      acceptChallenge('ch-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('challenge:accept', { challengeId: 'ch-123' });
    });
  });

  describe('declineChallenge', () => {
    it('should emit challenge:decline when connected', async () => {
      const { connectSocket, declineChallenge } = await import('../lib/socket');
      connectSocket('test-token');

      declineChallenge('ch-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('challenge:decline', { challengeId: 'ch-123' });
    });
  });

  describe('submitMatchAnswer', () => {
    it('should emit match:answer when connected', async () => {
      const { connectSocket, submitMatchAnswer } = await import('../lib/socket');
      connectSocket('test-token');

      submitMatchAnswer('match-1', 2);

      expect(mockSocket.emit).toHaveBeenCalledWith('match:answer', { matchId: 'match-1', optionIndex: 2 });
    });

    it('should not emit when not connected', async () => {
      const { submitMatchAnswer } = await import('../lib/socket');

      submitMatchAnswer('match-1', 0);

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });
});
