import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// CU6 task 6.1 — truco:* socket listener plumbing (D9)
// ---------------------------------------------------------------------------
// Contract under test:
// 1. Listener hygiene — register-on-connect delegation via ONE setTrucoHandlers
//    object; mount/unmount/remount across reconnects never duplicates handlers
//    (exactly one listener per truco event per live connection).
// 2. Redaction guard — any push smuggling hand data is dropped before it can
//    reach feature code (hands travel exclusively through the REST DTO).

// ─── Fake socket factory (fresh instance per io() call) ─────────────────────

interface FakeSocket {
  connected: boolean;
  on: (event: string, cb: (payload?: unknown) => void) => void;
  emit: (event: string, payload?: unknown) => void;
  disconnect: () => void;
  __fire: (event: string, payload?: unknown) => void;
  __listenerCount: (event: string) => number;
}

const sockets: FakeSocket[] = [];

function makeFakeSocket(): FakeSocket {
  const listeners = new Map<string, Array<(payload?: unknown) => void>>();
  return {
    connected: true,
    on(event, cb) {
      listeners.set(event, [...(listeners.get(event) ?? []), cb]);
    },
    emit: () => undefined,
    disconnect: () => undefined,
    __fire(event, payload) {
      for (const cb of listeners.get(event) ?? []) cb(payload);
    },
    __listenerCount(event) {
      return (listeners.get(event) ?? []).length;
    },
  };
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = makeFakeSocket();
    sockets.push(socket);
    return socket;
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRUCO_EVENTS = [
  'truco:state-changed',
  'truco:invite',
  'truco:player-joined',
  'truco:finished',
] as const;

async function boot() {
  const mod = await import('../socket');
  return mod;
}

describe('truco socket listener plumbing', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sockets.length = 0;
    const { disconnectSocket } = await import('../socket');
    disconnectSocket();
  });

  it('registers EXACTLY one listener per truco event on connect', async () => {
    const { connectSocket } = await boot();
    connectSocket('token-a');

    expect(sockets).toHaveLength(1);
    for (const event of TRUCO_EVENTS) {
      expect(sockets[0]!.__listenerCount(event)).toBe(1);
    }
  });

  it('mount/unmount/remount across a reconnect keeps one handler set per event', async () => {
    const { connectSocket, disconnectSocket, setTrucoHandlers } = await boot();

    // ── mount #1 ──
    connectSocket('token-a');
    const h1 = { onStateChanged: vi.fn() };
    setTrucoHandlers(h1);

    // ── unmount (page cleanup nulls the handler object) ──
    setTrucoHandlers(null);

    // ── server-side drop + remount → fresh connection ──
    disconnectSocket();
    connectSocket('token-a');
    expect(sockets).toHaveLength(2);

    // Remount #2 swaps in its own handler; no re-registration storm.
    const h2 = { onStateChanged: vi.fn() };
    setTrucoHandlers(h2);

    sockets[1]!.__fire('truco:state-changed', { matchId: 'm-1', version: 3, reason: 'action' });

    expect(h2.onStateChanged).toHaveBeenCalledTimes(1);
    expect(h1.onStateChanged).not.toHaveBeenCalled();
    expect(sockets[1]!.__listenerCount('truco:state-changed')).toBe(1);
  });

  it('repeated connectSocket calls while connected do not duplicate registrations', async () => {
    const { connectSocket } = await boot();
    connectSocket('token-a');
    connectSocket('token-a');

    expect(sockets).toHaveLength(1);
    for (const event of TRUCO_EVENTS) {
      expect(sockets[0]!.__listenerCount(event)).toBe(1);
    }
  });

  it('forwards all four legit push payloads to the matching handler', async () => {
    const { connectSocket, setTrucoHandlers } = await boot();
    connectSocket('token-a');

    const handlers = {
      onStateChanged: vi.fn(),
      onInvite: vi.fn(),
      onPlayerJoined: vi.fn(),
      onFinished: vi.fn(),
    };
    setTrucoHandlers(handlers);

    sockets[0]!.__fire('truco:state-changed', { matchId: 'm-1', version: 7, reason: 'finish' });
    sockets[0]!.__fire('truco:invite', { matchId: 'm-2', code: 'TRQ5X2', fromUser: 'user-9' });
    sockets[0]!.__fire('truco:player-joined', {
      matchId: 'm-1',
      players: [
        { userId: 'u-1', nickname: 'ana' },
        { userId: 'u-2', nickname: 'beto' },
      ],
    });
    sockets[0]!.__fire('truco:finished', { matchId: 'm-1', winnerUserId: 'u-2' });

    expect(handlers.onStateChanged).toHaveBeenCalledWith({
      matchId: 'm-1',
      version: 7,
      reason: 'finish',
    });
    expect(handlers.onInvite).toHaveBeenCalledWith({
      matchId: 'm-2',
      code: 'TRQ5X2',
      fromUser: 'user-9',
    });
    expect(handlers.onPlayerJoined).toHaveBeenCalledWith({
      matchId: 'm-1',
      players: [
        { userId: 'u-1', nickname: 'ana' },
        { userId: 'u-2', nickname: 'beto' },
      ],
    });
    expect(handlers.onFinished).toHaveBeenCalledWith({ matchId: 'm-1', winnerUserId: 'u-2' });
  });

  it('setTrucoHandlers(null) cleanup makes pushes a no-op', async () => {
    const { connectSocket, setTrucoHandlers } = await boot();
    connectSocket('token-a');

    const onStateChanged = vi.fn();
    setTrucoHandlers({ onStateChanged });
    setTrucoHandlers(null);

    expect(() =>
      sockets[0]!.__fire('truco:state-changed', { matchId: 'm-1', version: 1, reason: 'start' }),
    ).not.toThrow();
    expect(onStateChanged).not.toHaveBeenCalled();
  });

  it('does not throw when no handler object was ever set', async () => {
    const { connectSocket } = await boot();
    connectSocket('token-a');

    expect(() =>
      sockets[0]!.__fire('truco:invite', { matchId: 'm-1', code: 'TRQ5X2', fromUser: 'u-1' }),
    ).not.toThrow();
  });

  // ─── D9 redaction guard: hand data never reaches feature code ──────────────

  it('drops a state-changed push carrying hand-shaped fields', async () => {
    const { connectSocket, setTrucoHandlers } = await boot();
    connectSocket('token-a');

    const onStateChanged = vi.fn();
    setTrucoHandlers({ onStateChanged });

    sockets[0]!.__fire('truco:state-changed', {
      matchId: 'm-1',
      version: 4,
      reason: 'action',
      hands: { A: ['1espada'], B: ['2basto'] },
    });
    sockets[0]!.__fire('truco:state-changed', {
      matchId: 'm-1',
      version: 5,
      reason: 'action',
      myHand: ['3oro'],
    });

    expect(onStateChanged).not.toHaveBeenCalled();
  });

  it('drops any other truco push carrying hand data too', async () => {
    const { connectSocket, setTrucoHandlers } = await boot();
    connectSocket('token-a');

    const handlers = {
      onStateChanged: vi.fn(),
      onInvite: vi.fn(),
      onPlayerJoined: vi.fn(),
      onFinished: vi.fn(),
    };
    setTrucoHandlers(handlers);

    sockets[0]!.__fire('truco:invite', {
      matchId: 'm-1',
      code: 'TRQ5X2',
      fromUser: 'u-1',
      deckRemaining: ['1espada'],
    });
    sockets[0]!.__fire('truco:player-joined', {
      matchId: 'm-1',
      players: [{ userId: 'u-1', nickname: 'ana' }],
      opponentHand: ['4copa'],
    });

    expect(handlers.onInvite).not.toHaveBeenCalled();
    expect(handlers.onPlayerJoined).not.toHaveBeenCalled();
  });
});

describe('truco:invite feeds the global invite banner store', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sockets.length = 0;
    const { disconnectSocket } = await import('../socket');
    disconnectSocket();
  });

  it('a truco:invite push populates the store even with NO page handlers set (remediation #11)', async () => {
    const { useTrucoInviteStore } = await import('../../store/trucoInviteStore');
    useTrucoInviteStore.setState({ invite: null });

    const { connectSocket } = await boot();
    connectSocket('token-a');

    sockets[0]!.__fire('truco:invite', {
      matchId: 'm-77',
      code: 'TRQ5X2',
      fromUser: 'user-9',
    });

    expect(useTrucoInviteStore.getState().invite).toEqual({
      matchId: 'm-77',
      code: 'TRQ5X2',
      fromUser: 'user-9',
    });
  });
});
