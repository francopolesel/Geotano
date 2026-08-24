// ---------------------------------------------------------------------------
// CU6 task 6.3 slice i — TrucoMatchPage lobby states (waiting/ready/start)
// ---------------------------------------------------------------------------
// Pins the pre-game half of the match screen against EXACT backend reality:
//   GET  /api/truco/matches/:id        → snapshot {status, code, view|null}
//   POST /api/truco/matches/:id/start  → {matchId, version, status:'playing'}
//     | 403 FORBIDDEN (W1 creator-only) | 409 match_not_startable
//
// W1 MIRRORED IN UI: only the host (creator) ever sees a start control, and
// only while status === 'ready'; the guest gets honest waiting copy instead.
// The server remains authority — the UI merely hides controls it must not use.
//
// Mock strategy: only lib/api + lib/socket are mocked, so the REAL page →
// useTrucoMultiplayer hook → trucoApi client chain runs in these tests.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../../i18n/i18n';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({ api: apiMock }));

const socketMocks = vi.hoisted(() => ({
  connectSocket: vi.fn(),
  setTrucoHandlers: vi.fn(),
}));

vi.mock('../../../lib/socket', () => socketMocks);

// Sound pipeline is mocked at the module boundary so tests can spy on the
// shared sink and the event→sound mapping without touching real audio.
const soundMocks = vi.hoisted(() => {
  const sink = {
    cardPlayed: vi.fn(),
    callEnvido: vi.fn(),
    callTruco: vi.fn(),
    quiero: vi.fn(),
    noQuiero: vi.fn(),
    bazaWon: vi.fn(),
    handEnded: vi.fn(),
    matchWon: vi.fn(),
    matchLost: vi.fn(),
  };
  return {
    sink,
    createSoundSink: vi.fn(() => sink),
    mapEventsToSounds: vi.fn(),
  };
});

vi.mock('../lib/soundTriggers', () => soundMocks);

import { useAuthStore } from '../../../store/authStore';
import { useFriendsStore } from '../../../store/friendsStore';
import { TrucoMatchPage, REMATCH_ERROR_FALLBACK_MS } from '../TrucoMatchPage';

const HOST_ID = 'user-host';
const GUEST_ID = 'user-guest';

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
    matchId: 'm-1',
    version,
  };
}

function makeSnapshot(status: string, overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    matchId: 'm-1',
    code: 'TRQ5X2',
    status,
    version: status === 'playing' ? 1 : 0,
    targetPoints: 30,
    hostPlayerId: HOST_ID,
    guestPlayerId: status === 'waiting' ? null : GUEST_ID,
    winnerUserId: null,
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:01:00.000Z',
    view: null,
    ...overrides,
  };
}

function renderMatchPage({ withMenuProbe = false }: { withMenuProbe?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/truco/match/m-1']}>
          <Routes>
            <Route path="/truco/match/:matchId" element={<TrucoMatchPage />} />
            {withMenuProbe && (
              <Route path="/truco" element={<div data-testid="truco-menu-probe" />} />
            )}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return { ...render(<Wrapper />), queryClient };
}

function seedViewer(userId: string) {
  useAuthStore.setState({
    token: 'tok-1',
    isAuthenticated: true,
    isLoading: false,
    user: { id: userId, username: `u-${userId}`, email: 't@t.com' } as never,
  });
}

describe('TrucoMatchPage — lobby wait and creator-only start (CU6)', () => {
  beforeEach(() => {
    seedViewer(HOST_ID);
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('shows a loading probe while the snapshot is in flight', async () => {
    let resolveGet!: (value: unknown) => void;
    apiMock.get.mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));
    renderMatchPage();

    expect(screen.getByTestId('truco-match-loading')).toBeTruthy();
    resolveGet(makeSnapshot('waiting'));
  });

  it('waiting room shows the shareable code and NO start control', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot('waiting'));
    renderMatchPage();

    await screen.findByTestId('truco-match-waiting');
    expect(screen.getByTestId('truco-match-code').textContent).toBe('TRQ5X2');
    expect(screen.queryByTestId('truco-multi-start')).toBeNull();
  });

  it('host sees Start from ready; starting POSTs and lands in the game area', async () => {
    apiMock.get
      .mockResolvedValueOnce(makeSnapshot('ready'))
      .mockResolvedValueOnce(makeSnapshot('playing', { version: 1 }));
    apiMock.post.mockResolvedValue({ matchId: 'm-1', version: 1, status: 'playing' });
    renderMatchPage();

    const start = await screen.findByTestId('truco-multi-start');
    fireEvent.click(start);

    await screen.findByTestId('truco-match-playing');
    expect(apiMock.post).toHaveBeenCalledWith('/truco/matches/m-1/start', {});
  });

  it('guest sees waiting-for-host copy and NEVER a start control (W1 mirrored)', async () => {
    seedViewer(GUEST_ID);
    apiMock.get.mockResolvedValue(makeSnapshot('ready'));
    renderMatchPage();

    await screen.findByTestId('truco-match-guest-waiting');
    expect(screen.queryByTestId('truco-multi-start')).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('start failure surfaces a friendly message and stays out of the game area', async () => {
    apiMock.get.mockResolvedValue(makeSnapshot('ready'));
    apiMock.post.mockRejectedValue(
      Object.assign(new Error('not allowed'), { status: 403, errorCode: 'FORBIDDEN' }),
    );
    renderMatchPage();

    fireEvent.click(await screen.findByTestId('truco-multi-start'));

    await waitFor(() => {
      expect(screen.getByTestId('truco-multi-error')).toHaveTextContent(
        i18n.t('truco.error.notStartable'),
      );
    });
    expect(screen.queryByTestId('truco-match-playing')).toBeNull();
  });

  it('unknown/expired match shows the not-found message', async () => {
    apiMock.get.mockRejectedValue(
      Object.assign(new Error('gone'), { status: 404, errorCode: 'MATCH_NOT_FOUND' }),
    );
    renderMatchPage();

    await waitFor(() => {
      expect(screen.getByTestId('truco-match-error')).toHaveTextContent(
        i18n.t('truco.error.matchNotFound'),
      );
    });
  });

  it('non-participant GET shows the forbidden message', async () => {
    apiMock.get.mockRejectedValue(
      Object.assign(new Error('nope'), { status: 403, errorCode: 'FORBIDDEN' }),
    );
    renderMatchPage();

    await waitFor(() => {
      expect(screen.getByTestId('truco-match-error')).toHaveTextContent(
        i18n.t('truco.error.notParticipant'),
      );
    });
  });
});

describe('TrucoMatchPage — game view (CU6 slice 6c)', () => {
  beforeEach(() => {
    seedViewer(HOST_ID);
    useFriendsStore.setState({ friends: [], onlineUsers: new Set<string>() });
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  function playingSnapshot(overrides: Record<string, unknown> = {}) {
    return makeSnapshot('playing', { version: 3, view: makeView(3), ...overrides });
  }

  it('renders the shared table for a playing snapshot; tracked friend shown by name', async () => {
    useFriendsStore.setState({
      friends: [
        { id: 'fr-row-1', friendId: GUEST_ID, username: 'maria', status: 'accepted' },
      ] as never,
    });
    apiMock.get.mockResolvedValue(playingSnapshot());
    renderMatchPage();

    await screen.findByTestId('truco-table');
    expect(screen.getByTestId('rival-name').textContent).toBe('maria');
    expect(screen.getByTestId('my-score').textContent).toContain('0');
  });

  it('clicking a legal hand card POSTs {expectedVersion, action} and merges server truth', async () => {
    apiMock.get.mockResolvedValue(playingSnapshot());
    const nextView = makeView(4);
    (nextView.scores as Record<string, number>) = { A: 1, B: 0 };
    apiMock.post.mockResolvedValue({
      matchId: 'm-1',
      view: nextView,
      matchEnded: false,
      version: 4,
      winnerUserId: null,
    });
    renderMatchPage();

    fireEvent.click(await screen.findByTestId('playing-card-3oro'));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/truco/matches/m-1/actions', {
        expectedVersion: 3,
        action: expect.objectContaining({ type: 'play_card', card: '3oro' }),
      });
    });
    // Server truth merged: the authoritative post-action score is on screen.
    await waitFor(() => {
      expect(screen.getByTestId('my-score').textContent).toContain('1');
    });
  });

  it('stranger opponent falls back to the localized label with unknown presence', async () => {
    apiMock.get.mockResolvedValue(playingSnapshot());
    renderMatchPage();

    await screen.findByTestId('truco-table');
    expect(screen.getByTestId('rival-name').textContent).toBe(i18n.t('truco.multi.opponent'));
    const presence = screen.getByTestId('truco-match-presence');
    expect(presence.getAttribute('data-presence')).toBe('unknown');
    expect(presence.textContent).toContain(i18n.t('truco.multi.presence.unknown'));
  });

  it('tracked friend opponent shows the honest online presence marker', async () => {
    useFriendsStore.setState({
      friends: [
        { id: 'fr-row-1', friendId: GUEST_ID, username: 'maria', status: 'accepted' },
      ] as never,
      onlineUsers: new Set([GUEST_ID]),
    });
    apiMock.get.mockResolvedValue(playingSnapshot());
    renderMatchPage();

    await screen.findByTestId('truco-table');
    expect(screen.getByTestId('truco-match-presence').getAttribute('data-presence')).toBe(
      'online',
    );
  });

  it('409 conflict surfaces a syncing banner and converges to the authoritative hand', async () => {
    const authoritativeView = makeView(7);
    authoritativeView.myHand = ['7copa', '6copa', '12oro'];
    apiMock.get
      .mockResolvedValueOnce(playingSnapshot())
      // Authoritative refetch after the stale CAS rejection.
      .mockResolvedValueOnce(playingSnapshot({ version: 7, view: authoritativeView }));
    apiMock.post.mockRejectedValue(
      Object.assign(new Error('stale'), { status: 409, errorCode: 'version_conflict' }),
    );
    renderMatchPage();

    fireEvent.click(await screen.findByTestId('playing-card-3oro'));

    // Conflict UX: explicit banner while the client re-syncs…
    await screen.findByTestId('truco-match-syncing');
    // …and recovery came from authority: the opponent's committed move is
    // reflected by swapping to the server's hand, never a local patch.
    await screen.findByTestId('playing-card-7copa');
    expect(screen.queryByTestId('playing-card-3oro')).toBeNull();
    expect(screen.getByTestId('truco-match-syncing').getAttribute('data-persisted')).toBe(
      'true',
    );
  });

  it('benign lost-race rejections get the amber syncing banner, never a red error (#14b)', async () => {
    // A legal-at-render play rejected E_OUT_OF_TURN means the rival moved
    // concurrently: SAME treatment as 409 — refetch + syncing copy.
    apiMock.get
      .mockResolvedValueOnce(playingSnapshot())
      .mockResolvedValueOnce(playingSnapshot({ version: 8, view: makeView(8) }));
    apiMock.post.mockRejectedValue(
      Object.assign(new Error('race'), { status: 400, errorCode: 'E_OUT_OF_TURN' }),
    );
    renderMatchPage();

    fireEvent.click(await screen.findByTestId('playing-card-3oro'));

    await screen.findByTestId('truco-match-syncing');
    expect(screen.queryByTestId('truco-match-action-error')).toBeNull();
    // Converged to authority instead of scolding the player.
    await screen.findByTestId('playing-card-1espada');
  });

  it('a failed refresh over a cached board marks it stale instead of silently rotting (#13)', async () => {
    apiMock.get.mockResolvedValueOnce(playingSnapshot());
    const { queryClient } = renderMatchPage();
    await screen.findByTestId('truco-table');

    // Network dies AFTER the snapshot is cached: TanStack keeps rendering the
    // cached data with isError set — the board must say so honestly.
    apiMock.get.mockRejectedValue(Object.assign(new Error('offline'), { status: 0 }));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['truco-match', 'm-1'] });
    });

    expect(screen.getByTestId('truco-table')).toBeTruthy();
    await screen.findByTestId('truco-match-stale');
  });
});

describe('TrucoMatchPage — multiplayer sound watermark dedupe', () => {
  beforeEach(() => {
    seedViewer(HOST_ID);
    useFriendsStore.setState({ friends: [], onlineUsers: new Set<string>() });
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  // Append-only server log: these events stand in for real engine history.
  const evPlayed = { type: 'card_played', player: 'B', card: '1oro' };
  const evBaza = { type: 'baza_resolved', baza: 1, winner: 'A' };
  const evHand = { type: 'hand_ended', winner: 'B' };

  function playingWithHistory(history: unknown[], version = 3) {
    return makeSnapshot('playing', { version, view: { ...makeView(version), history } });
  }

  async function setSnapshot(queryClient: QueryClient, snapshot: Record<string, unknown>) {
    await act(async () => {
      queryClient.setQueryData(['truco-match', 'm-1'], snapshot);
    });
  }

  it('anchors silently on first sight, no-ops on equal-length refetches, fires only the appended suffix', async () => {
    apiMock.get.mockResolvedValue(playingWithHistory([evPlayed]));
    const { queryClient } = renderMatchPage();
    await screen.findByTestId('truco-table');

    // Fresh matchId first render (mount/reload/rematch): anchor silently —
    // the backlog must NEVER replay as a wall of cues.
    expect(soundMocks.mapEventsToSounds).not.toHaveBeenCalled();

    // Same-length refetch (10s poll / socket invalidation of an unchanged
    // log): watermark equal ⇒ nothing fires, even with different content.
    await setSnapshot(queryClient, playingWithHistory([evHand], 4));
    // Let any pending work settle, then confirm nothing fired.
    await act(async () => {});
    expect(soundMocks.mapEventsToSounds).not.toHaveBeenCalled();

    // Longer history: exactly the appended suffix reaches the sound mapping,
    // once — never the already-seen prefix.
    await setSnapshot(
      queryClient,
      playingWithHistory([evPlayed, evHand, evBaza], 5),
    );
    await waitFor(() => {
      expect(soundMocks.mapEventsToSounds).toHaveBeenCalledTimes(1);
    });
    expect(soundMocks.mapEventsToSounds).toHaveBeenCalledWith(
      [evHand, evBaza],
      'A',
      soundMocks.sink,
    );
    expect(soundMocks.sink.bazaWon).not.toHaveBeenCalled(); // mapping itself is mocked
  });
});

describe('TrucoMatchPage — end screen and rematch (CU6 slice 6d)', () => {
  beforeEach(() => {
    seedViewer(HOST_ID);
    useFriendsStore.setState({ friends: [], onlineUsers: new Set<string>() });
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  function makeFinishedView(version = 12): Record<string, unknown> {
    const view = makeView(version);
    view.phase = 'match_end';
    view.scores = { A: 30, B: 22 };
    view.myHand = [];
    return view;
  }

  function finishedSnapshot(winnerUserId: string | null): Record<string, unknown> {
    return makeSnapshot('finished', { version: 12, winnerUserId, view: makeFinishedView() });
  }

  it('won match replaces the table with the end screen showing outcome and final scores', async () => {
    apiMock.get.mockResolvedValue(finishedSnapshot(HOST_ID));
    renderMatchPage();

    await screen.findByTestId('truco-end-screen');
    expect(screen.getByTestId('truco-end-title').textContent).toBe(i18n.t('truco.end.win'));
    expect(screen.getByTestId('truco-end-scores').textContent).toContain('30');
    expect(screen.getByTestId('truco-end-scores').textContent).toContain('22');
    expect(screen.getByTestId('truco-end-target').textContent).toContain('30');
    // The live table is gone — only the end panel remains.
    expect(screen.queryByTestId('truco-table')).toBeNull();
  });

  it('lost match shows the lose title derived from the server-declared winner', async () => {
    apiMock.get.mockResolvedValue(finishedSnapshot(GUEST_ID));
    renderMatchPage();

    await screen.findByTestId('truco-end-screen');
    expect(screen.getByTestId('truco-end-title').textContent).toBe(i18n.t('truco.end.lose'));
  });

  it('Play Again rematches by re-creating with friendId and opens the new match (D8)', async () => {
    useFriendsStore.setState({
      friends: [
        { id: 'fr-row-1', friendId: GUEST_ID, username: 'maria', status: 'accepted' },
      ] as never,
    });
    apiMock.get.mockResolvedValue(finishedSnapshot(HOST_ID));
    apiMock.post.mockResolvedValue({
      matchId: 'm-new',
      code: 'NEWCD3',
      status: 'waiting',
    });
    renderMatchPage();

    fireEvent.click(await screen.findByTestId('truco-end-play-again'));

    // Rematch = client re-calls create with friendId; NO new endpoint.
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/truco/matches', { friendId: GUEST_ID });
    });
    // Navigation happened: the new match route fetched its own snapshot.
    await waitFor(() => {
      expect(apiMock.get).toHaveBeenCalledWith('/truco/matches/m-new');
    });
  });

  it('rematch refusal surfaces an error banner BEFORE the menu fallback (#15)', async () => {
    vi.useFakeTimers();
    try {
      apiMock.get.mockResolvedValue(finishedSnapshot(HOST_ID));
      apiMock.post.mockRejectedValue(
        Object.assign(new Error('not friends'), { status: 403, errorCode: 'NOT_FRIENDS' }),
      );
      renderMatchPage({ withMenuProbe: true });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      fireEvent.click(screen.getByTestId('truco-end-play-again'));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Code-joined strangers have no friendship row → server 403s the invite
      // create. The failure is SURFACED first — no silent bounce.
      expect(screen.getByTestId('truco-rematch-error')).toBeTruthy();
      expect(screen.queryByTestId('truco-menu-probe')).toBeNull();

      // …then the honest menu fallback (codes work there) lands after a
      // readable pause, and the double-click guard stays shut meanwhile.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(REMATCH_ERROR_FALLBACK_MS);
      });
      expect(screen.getByTestId('truco-menu-probe')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reload mid-betting restores the pending bet answerable immediately (no auto-forfeit)', async () => {
    const bettingView = makeView(6);
    bettingView.phase = 'truco_betting';
    bettingView.trucoAwaiting = { responder: 'A', level: 2 };
    apiMock.get.mockResolvedValue(makeSnapshot('playing', { version: 6, view: bettingView }));
    renderMatchPage();

    // Pure GET restore: the retruco answer controls are usable with zero
    // intervening mutations — reload never forfeits or auto-answers.
    await screen.findByTestId('truco-action-quiero');
    expect(screen.getByTestId('truco-action-no_quiero')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
