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

describe('match:start listener', () => {
  it('should NOT register match:start listener on connect (async multiplayer)', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const callback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'match:start',
    );

    expect(callback).toBeUndefined();
  });
});

describe('socket challenge:invite listener', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({ challengeNotification: null });

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
      (call: any[]) => call[0] === 'challenge:invite',
    );

    expect(challengeCallback).toBeDefined();
  });

  it('should show challenge notification when challenge:invite fires', async () => {
    const { connectSocket } = await import('../lib/socket');
    connectSocket('test-token');

    const challengeCallback = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'challenge:invite',
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
      (call: any[]) => call[0] === 'challenge:invite',
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
});
