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
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

import { useAuthStore } from '../../../store/authStore';
import { useFriendsStore } from '../../../store/friendsStore';
import { TrucoMatchPage } from '../TrucoMatchPage';

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

function renderMatchPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/truco/match/m-1']}>
          <Routes>
            <Route path="/truco/match/:matchId" element={<TrucoMatchPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return render(<Wrapper />);
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
});
