// ---------------------------------------------------------------------------
// Friend lobby tests — REWRITTEN for the v2 step flow (batch C redesign)
// ---------------------------------------------------------------------------
// The old single-panel lobby (friend <select> + create/join) became a dedicated
// "friends" STEP that leads with EXISTING friends (presence + inline invite
// confirm) and demotes the open-code lobby to a secondary collapsed section.
//
// Pinned backend reality is UNCHANGED:
//   POST /api/truco/matches {targetPoints?, friendId?} → {matchId, code, status}
//     403 NOT_FRIENDS when body.friendId is not an accepted friend
//   GET  /api/truco/matches/code/:code → {matchId, status} | 404 CODE_NOT_FOUND
//   POST /api/truco/matches/code/:code/join → {matchId} | 409 match_not_joinable
// S3 convenience: the UI pre-checks the code with the GET so a bad code gets a
// friendly message WITHOUT firing the join POST.
//
// Identifier contract (backend-checked): friendsService returns each row with
// friendId = the FRIEND'S user id; trucoService validates body.friendId
// against the friends table userId/friendId columns. So the invite MUST send
// FriendUser.friendId — never .id (asserted via row data-user-id + API call).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { useTrucoPrefsStore } from '../../../store/trucoPrefsStore';
import { useFriendsStore } from '../../../store/friendsStore';
import { TrucoMenuPage } from '../TrucoMenuPage';

const trucoApiMock = vi.hoisted(() => ({
  createTrucoMatch: vi.fn(),
  lookupTrucoMatchByCode: vi.fn(),
  joinTrucoMatchByCode: vi.fn(),
  startTrucoMatch: vi.fn(),
}));

vi.mock('../../../lib/trucoApi', () => trucoApiMock);

const FRIEND_ONLINE = {
  id: 'fr-row-1',
  friendId: 'user-maria',
  username: 'maria',
  status: 'accepted',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const FRIEND_OFFLINE = {
  id: 'fr-row-2',
  friendId: 'user-jose',
  username: 'jose',
  status: 'accepted',
  createdAt: '2026-01-02T00:00:00.000Z',
};

function seedStores({
  friends = [FRIEND_ONLINE, FRIEND_OFFLINE],
  online = ['user-maria'],
}: {
  friends?: Array<typeof FRIEND_ONLINE | typeof FRIEND_OFFLINE>;
  online?: string[];
} = {}) {
  localStorage.clear();
  useTrucoPrefsStore.setState({ difficulty: 'easy', targetPoints: 30, personaIndex: 0 });
  useFriendsStore.setState({
    friends: friends,
    onlineUsers: new Set(online),
  });
}

function renderMenu() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/truco']}>
        <Routes>
          <Route path="/truco" element={<TrucoMenuPage />} />
          <Route path="/friends" element={<div data-testid="friends-route-probe" />} />
          <Route
            path="/truco/match/:matchId"
            element={<div data-testid="truco-match-route-probe" />}
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

/** Step-flow helper: enter the friends step from the mode screen. */
function enterFriendsScreen() {
  fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));
  expect(screen.getByTestId('truco-menu-friend')).toBeTruthy();
}

/** Secondary code lobby is collapsed by default — expand it. */
function openCodeSection() {
  const toggle = screen.getByTestId('truco-code-toggle');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(screen.getByTestId('truco-code-toggle').getAttribute('aria-expanded')).toBe(
    'true',
  );
}

describe('TrucoMenuPage — friends step (v2 batch C)', () => {
  beforeEach(() => {
    seedStores();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('vs-friend opens the friends step listing EXISTING friends first', () => {
    renderMenu();
    enterFriendsScreen();

    expect(screen.getByTestId('truco-friend-row-user-maria')).toBeTruthy();
    expect(screen.getByTestId('truco-friend-row-user-jose')).toBeTruthy();
  });

  it('rows carry the USER id and honest presence markers; offline friends have NO invite button', () => {
    renderMenu();
    enterFriendsScreen();

    // Backend identity contract exposed on the row: data-user-id = friendId.
    expect(screen.getByTestId('truco-friend-row-user-maria').getAttribute('data-user-id')).toBe(
      'user-maria',
    );
    const mariaPresence = screen.getByTestId('truco-friend-presence-user-maria');
    expect(mariaPresence.getAttribute('data-presence')).toBe('online');
    expect(screen.getByTestId('truco-friend-presence-user-jose').getAttribute('data-presence')).toBe(
      'offline',
    );

    // Invite action only for available friends.
    expect(screen.getByTestId('truco-invite-user-maria')).toBeTruthy();
    expect(screen.queryByTestId('truco-invite-user-jose')).toBeNull();
  });

  it('empty list shows the no-friends state AND keeps the code section accessible', () => {
    seedStores({ friends: [], online: [] });
    renderMenu();
    enterFriendsScreen();

    expect(screen.getByTestId('truco-multi-no-friends')).toBeTruthy();

    // Secondary code lobby stays reachable even with no friends (v2 change:
    // the old panel hid create/join entirely on an empty list).
    openCodeSection();
    expect(screen.getByTestId('truco-multi-create')).toBeTruthy();
    expect(screen.getByTestId('truco-multi-code-input')).toBeTruthy();
    expect(screen.getByTestId('truco-multi-join')).toBeTruthy();

    // Add-friends link navigates to Geotano's friends management.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('truco.multi.addFriends') }));
    expect(screen.getByTestId('friends-route-probe')).toBeTruthy();
  });

  it('INVITAR asks for confirmation before firing any request', () => {
    renderMenu();
    enterFriendsScreen();

    fireEvent.click(screen.getByTestId('truco-invite-user-maria'));

    const confirm = screen.getByTestId('truco-invite-confirm');
    expect(confirm.textContent).toContain(i18n.t('truco.multi.inviteConfirm', { name: 'maria' }));
    expect(trucoApiMock.createTrucoMatch).not.toHaveBeenCalled();

    // Cancel dismisses without any API traffic.
    fireEvent.click(screen.getByTestId('truco-invite-cancel'));
    expect(screen.queryByTestId('truco-invite-confirm')).toBeNull();
    expect(trucoApiMock.createTrucoMatch).not.toHaveBeenCalled();
  });

  it('confirming the invite sends {targetPoints, friendId} and navigates to the match route', async () => {
    trucoApiMock.createTrucoMatch.mockResolvedValue({
      matchId: 'm-new',
      code: 'ABCD12',
      status: 'ready',
    });
    renderMenu();
    enterFriendsScreen();

    fireEvent.click(screen.getByTestId('truco-invite-user-maria'));
    fireEvent.click(screen.getByTestId('truco-invite-confirm-accept'));

    await screen.findByTestId('truco-match-route-probe');

    expect(trucoApiMock.createTrucoMatch).toHaveBeenCalledWith({
      targetPoints: 30,
      friendId: 'user-maria',
    });
  });

  it('NOT_FRIENDS (403) surfaces the friendly message and never navigates', async () => {
    trucoApiMock.createTrucoMatch.mockRejectedValue(
      Object.assign(new Error('You can only invite friends'), { status: 403 }),
    );
    renderMenu();
    enterFriendsScreen();

    fireEvent.click(screen.getByTestId('truco-invite-user-maria'));
    fireEvent.click(screen.getByTestId('truco-invite-confirm-accept'));

    await waitFor(() => {
      expect(screen.getByTestId('truco-multi-error')).toHaveTextContent(
        i18n.t('truco.error.notFriends'),
      );
    });
    expect(screen.queryByTestId('truco-match-route-probe')).toBeNull();
  });

  it('creating an open match from the secondary section sends targetPoints with NO friendId', async () => {
    trucoApiMock.createTrucoMatch.mockResolvedValue({
      matchId: 'm-open',
      code: 'OPEN99',
      status: 'waiting',
    });
    renderMenu();
    enterFriendsScreen();
    openCodeSection();

    fireEvent.click(screen.getByTestId('truco-multi-create'));
    await screen.findByTestId('truco-match-route-probe');

    const call = trucoApiMock.createTrucoMatch.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.targetPoints).toBe(30);
    expect('friendId' in call ? call.friendId : undefined).toBeUndefined();
  });

  it('join-by-code pre-checks with the GET, then joins, then navigates (S3 order)', async () => {
    trucoApiMock.lookupTrucoMatchByCode.mockResolvedValue({ matchId: 'm-x', status: 'waiting' });
    trucoApiMock.joinTrucoMatchByCode.mockResolvedValue({ matchId: 'm-x' });
    renderMenu();
    enterFriendsScreen();
    openCodeSection();

    fireEvent.change(screen.getByTestId('truco-multi-code-input'), {
      target: { value: 'ABCD12' },
    });
    fireEvent.click(screen.getByTestId('truco-multi-join'));

    await screen.findByTestId('truco-match-route-probe');

    const lookupOrder = trucoApiMock.lookupTrucoMatchByCode.mock.invocationCallOrder[0]!;
    const joinOrder = trucoApiMock.joinTrucoMatchByCode.mock.invocationCallOrder[0]!;
    expect(lookupOrder).toBeLessThan(joinOrder);
    expect(trucoApiMock.lookupTrucoMatchByCode).toHaveBeenCalledWith('ABCD12');
    expect(trucoApiMock.joinTrucoMatchByCode).toHaveBeenCalledWith('ABCD12');
  });

  it('CODE_NOT_FOUND surfaces the friendly message and never fires the join POST', async () => {
    trucoApiMock.lookupTrucoMatchByCode.mockRejectedValue(
      Object.assign(new Error('code not found'), { status: 404 }),
    );
    renderMenu();
    enterFriendsScreen();
    openCodeSection();

    fireEvent.change(screen.getByTestId('truco-multi-code-input'), {
      target: { value: 'ZZZZZZ' },
    });
    fireEvent.click(screen.getByTestId('truco-multi-join'));

    await waitFor(() => {
      expect(screen.getByTestId('truco-multi-error')).toHaveTextContent(
        i18n.t('truco.error.codeNotFound'),
      );
    });
    expect(trucoApiMock.joinTrucoMatchByCode).not.toHaveBeenCalled();
    expect(screen.queryByTestId('truco-match-route-probe')).toBeNull();
  });

  it('disables the join control while a request is in flight', async () => {
    // Never-resolving promise pins the pending state without timing games.
    trucoApiMock.lookupTrucoMatchByCode.mockReturnValue(new Promise(() => {}));
    renderMenu();
    enterFriendsScreen();
    openCodeSection();

    fireEvent.change(screen.getByTestId('truco-multi-code-input'), {
      target: { value: 'SLOW11' },
    });
    fireEvent.click(screen.getByTestId('truco-multi-join'));

    await waitFor(() => {
      expect(
        (screen.getByTestId('truco-multi-join') as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });
});
