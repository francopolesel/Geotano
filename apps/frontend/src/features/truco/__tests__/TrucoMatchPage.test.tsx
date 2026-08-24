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
import { TrucoMatchPage } from '../TrucoMatchPage';

const HOST_ID = 'user-host';
const GUEST_ID = 'user-guest';

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
