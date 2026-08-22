import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TrucoAction } from '@geotano/shared';

// ---------------------------------------------------------------------------
// CU6 task 6.2 — useTrucoMultiplayer (D9/D11 server-state contract)
// ---------------------------------------------------------------------------
// Pinned behaviors:
// - TanStack Query ['truco-match', id] with S5 poll fallback ON THE QUERY
//   (refetchInterval ≤10s, deliberately NOT setInterval like MultiplayerPage)
// - postAction mutation carries {expectedVersion, action}; server response is
//   truth (merged into cache); 409 version_conflict → refetch, NO local write
// - truco:* pushes trigger query invalidation ONLY
// - ONE setTrucoHandlers object registered exactly once across re-renders;
//   cleanup nulls it on unmount (MultiplayerPage setter precedent)
// - Reload/resume restores everything from GET
// - Honest presence: reliable only when the opponent is a tracked friend

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

// vi.mock factories are hoisted above top-level declarations — the error class
// must live inside vi.hoisted to be reachable from the factory.
const MockApiError = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;
    errorCode?: string;
    constructor(message: string, status: number, errorCode?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errorCode = errorCode;
    }
  }
  return MockApiError;
});

vi.mock('../../../../lib/api', () => ({
  api: apiMock,
  ApiError: MockApiError,
}));

const socketMocks = vi.hoisted(() => ({
  connectSocket: vi.fn(),
  setTrucoHandlers: vi.fn(),
}));

vi.mock('../../../../lib/socket', () => socketMocks);

import { useAuthStore } from '../../../../store/authStore';
import { useFriendsStore } from '../../../../store/friendsStore';
import type { TrucoFinishedPayload, TrucoPlayerJoinedPayload } from '../../../../lib/socket';
import { useTrucoMultiplayer } from '../useTrucoMultiplayer';

const HOST_ID = 'user-host';
const GUEST_ID = 'user-guest';
const MATCH_ID = 'm-1';

type SnapshotFixture = Record<string, unknown>;

function makeView(version = 3): Record<string, unknown> {
  return {
    phase: 'playing',
    playerToAct: 'A',
    mano: 'A',
    targetPoints: 30,
    scores: { A: 0, B: 0 },
    bazaNumber: 1,
    bazaLeader: 'A',
    openBazaPlays: [],
    cardsPlayedThisHand: 0,
    myHand: ['1espada', '2basto', '3oro'],
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
    matchId: MATCH_ID,
    version,
  };
}

function makeSnapshot(overrides: SnapshotFixture = {}): Record<string, unknown> {
  return {
    ok: true,
    matchId: MATCH_ID,
    code: 'TRQ5X2',
    status: 'playing',
    version: 3,
    targetPoints: 30,
    hostPlayerId: HOST_ID,
    guestPlayerId: GUEST_ID,
    winnerUserId: null,
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:01:00.000Z',
    view: makeView(3),
    ...overrides,
  };
}

const PLAY_ACTION: TrucoAction = { type: 'play_card', actor: 'A', card: '1espada' };

/** Flushes pending queries/microtasks under fake timers. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

function seedAuth(userId: string) {
  useAuthStore.setState({
    token: 'tok-1',
    user: { id: userId, username: `u-${userId}` } as never,
  });
}

describe('useTrucoMultiplayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    seedAuth(HOST_ID);
    useFriendsStore.setState({ friends: [], onlineUsers: new Set<string>() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches the authoritative snapshot on mount and derives host slot A', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    expect(apiMock.get).toHaveBeenCalledWith(`/truco/matches/${MATCH_ID}`);
    expect(result.current.snapshot?.matchId).toBe(MATCH_ID);
    expect(result.current.snapshot?.view).not.toBeNull();
    expect(result.current.mySlot).toBe('A');
    expect(result.current.opponentUserId).toBe(GUEST_ID);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps the guest viewer onto slot B with the host as opponent', async () => {
    seedAuth(GUEST_ID);
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    expect(result.current.mySlot).toBe('B');
    expect(result.current.opponentUserId).toBe(HOST_ID);
  });

  // ─── S5 DO-NOT-REVERT: poll fallback lives ON THE QUERY ────────────────────

  it('S5: refetches every ≤10s without any push (socket-down convergence)', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    expect(apiMock.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(apiMock.get.mock.calls.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(apiMock.get.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(result.current.snapshot?.version).toBe(3);
  });

  it('S5: poll config lives ON THE QUERY (≤10s) and leaks nothing after unmount', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper, queryClient } = createWrapper();

    const { unmount } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    // DO-NOT-REVERT pin: the poll is QUERY-NATIVE (refetchInterval option),
    // deliberately NOT a page-level setInterval like MultiplayerPage's
    // waiting screen. Library internals may use whatever timers they want;
    // what this pins is WHERE the polling lives.
    const cachedQuery = queryClient.getQueryCache().find({ queryKey: ['truco-match', MATCH_ID] });
    // Structural read — Query.options' static type hides observer-only fields.
    expect((cachedQuery?.options as { refetchInterval?: number | false }).refetchInterval).toBe(
      10_000,
    );

    unmount();
    const countAtUnmount = apiMock.get.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Unmount cancels polling automatically (no timer leak class).
    expect(apiMock.get.mock.calls.length).toBe(countAtUnmount);
  });

  // ─── Actions: CAS mutation, merge-on-success, conflict recovery ────────────

  it('postAction POSTs {expectedVersion, action} and merges the server response as truth', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const nextView = makeView(4);
    apiMock.post.mockResolvedValue({
      matchId: MATCH_ID,
      view: nextView,
      matchEnded: false,
      version: 4,
      winnerUserId: null,
    });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    const readsAfterMount = apiMock.get.mock.calls.length;

    await act(async () => {
      await result.current.postAction.mutateAsync({
        expectedVersion: 3,
        action: PLAY_ACTION,
      });
    });
    // TanStack notifyManager batches cache→React notifications on a timer;
    // drain it before asserting merged state.
    await flush();

    expect(apiMock.post).toHaveBeenCalledWith(`/truco/matches/${MATCH_ID}/actions`, {
      expectedVersion: 3,
      action: PLAY_ACTION,
    });
    // Server truth merged into cache…
    expect(result.current.snapshot?.version).toBe(4);
    expect(result.current.view?.myHand).toEqual(nextView.myHand);
    // …without an extra fetch (merge, not invalidate).
    expect(apiMock.get.mock.calls.length).toBe(readsAfterMount);
  });

  it('a matchEnded action response flips cached status to finished with the winner', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    apiMock.post.mockResolvedValue({
      matchId: MATCH_ID,
      view: makeView(4),
      matchEnded: true,
      version: 4,
      winnerUserId: GUEST_ID,
    });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    await act(async () => {
      await result.current.postAction.mutateAsync({
        expectedVersion: 3,
        action: PLAY_ACTION,
      });
    });
    await flush();

    expect(result.current.snapshot?.status).toBe('finished');
    expect(result.current.snapshot?.winnerUserId).toBe(GUEST_ID);
  });

  it('409 version_conflict recovers by refetching authority — zero local mutation', async () => {
    apiMock.get.mockResolvedValueOnce(makeSnapshot());
    apiMock.get.mockResolvedValueOnce(makeSnapshot({ version: 7, view: makeView(7) }));
    apiMock.post.mockRejectedValue(new MockApiError('stale', 409, 'version_conflict'));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    expect(result.current.view?.version).toBe(3);

    let threw = false;
    await act(async () => {
      try {
        await result.current.postAction.mutateAsync({
          expectedVersion: 3,
          action: PLAY_ACTION,
        });
      } catch {
        threw = true;
      }
    });
    await flush();

    // The stale request surfaces as an error…
    expect(threw).toBe(true);
    expect(result.current.actionError?.status).toBe(409);
    // …and recovery came from the AUTHORITATIVE refetch (v7), never a local write.
    expect(result.current.view?.version).toBe(7);
  });

  it('non-conflict errors surface without touching the cache', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    apiMock.post.mockRejectedValue(new MockApiError('engine said no', 400, 'E_OUT_OF_TURN'));
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    const readsAfterMount = apiMock.get.mock.calls.length;

    let threw = false;
    await act(async () => {
      try {
        await result.current.postAction.mutateAsync({
          expectedVersion: 3,
          action: PLAY_ACTION,
        });
      } catch {
        threw = true;
      }
    });
    await flush();

    expect(threw).toBe(true);
    expect(result.current.actionError?.errorCode).toBe('E_OUT_OF_TURN');
    expect(result.current.view?.version).toBe(3);
    expect(apiMock.get.mock.calls.length).toBe(readsAfterMount);
  });

  // ─── Push plumbing: invalidation ONLY ──────────────────────────────────────

  it('truco:state-changed for THIS match invalidates the query; others are ignored', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    const handlers = socketMocks.setTrucoHandlers.mock.calls[0]![0] as {
      onStateChanged: (p: { matchId: string; version: number; reason: string }) => void;
    };
    const readsAfterMount = apiMock.get.mock.calls.length;

    await act(async () => {
      handlers.onStateChanged({ matchId: MATCH_ID, version: 5, reason: 'action' });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMock.get.mock.calls.length).toBeGreaterThan(readsAfterMount);

    const readsAfterMine = apiMock.get.mock.calls.length;
    await act(async () => {
      handlers.onStateChanged({ matchId: 'other-match', version: 9, reason: 'action' });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMock.get.mock.calls.length).toBe(readsAfterMine);
    expect(result.current.snapshot?.version).toBe(3);
  });

  it('player-joined and finished pushes invalidate as well (lobby→ready, end sync)', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();
    const handlers = socketMocks.setTrucoHandlers.mock.calls[0]![0] as {
      onPlayerJoined: (p: TrucoPlayerJoinedPayload) => void;
      onFinished: (p: TrucoFinishedPayload) => void;
    };
    const base = apiMock.get.mock.calls.length;

    await act(async () => {
      handlers.onPlayerJoined({ matchId: MATCH_ID, players: [] });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMock.get.mock.calls.length).toBe(base + 1);

    await act(async () => {
      handlers.onFinished({ matchId: MATCH_ID, winnerUserId: HOST_ID });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(apiMock.get.mock.calls.length).toBe(base + 2);
  });

  it('registers ONE handler object exactly once across re-renders and nulls on unmount', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { rerender, unmount } = renderHook(() => useTrucoMultiplayer(MATCH_ID), {
      wrapper: Wrapper,
    });
    await flush();

    rerender();
    rerender();

    // Registration happens exactly ONCE (stable effect deps) — the regression
    // the MultiplayerPage setter pattern exists to prevent.
    expect(socketMocks.connectSocket).toHaveBeenCalledTimes(1);
    expect(socketMocks.setTrucoHandlers).toHaveBeenCalledTimes(1);
    expect(socketMocks.setTrucoHandlers).toHaveBeenCalledWith(
      expect.objectContaining({
        onStateChanged: expect.any(Function),
        onPlayerJoined: expect.any(Function),
        onFinished: expect.any(Function),
      }),
    );

    unmount();
    expect(socketMocks.setTrucoHandlers).toHaveBeenLastCalledWith(null);
  });

  // ─── Presence (honest, friend-scoped reality) ──────────────────────────────

  it('presence: friend opponent seen online reports online', async () => {
    useFriendsStore.setState({
      friends: [{ id: GUEST_ID }] as never,
      onlineUsers: new Set([GUEST_ID]),
    });
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    expect(result.current.opponentPresence).toBe('online');
  });

  it('presence: friend opponent not in the online set reports offline', async () => {
    useFriendsStore.setState({ friends: [{ id: GUEST_ID }] as never, onlineUsers: new Set() });
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    expect(result.current.opponentPresence).toBe('offline');
  });

  it('presence: stranger opponent (code join) reports unknown — never a lie', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTrucoMultiplayer(MATCH_ID), { wrapper: Wrapper });
    await flush();

    expect(result.current.opponentPresence).toBe('unknown');
  });
});
