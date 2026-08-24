// ---------------------------------------------------------------------------
// Slice 6c-i RED — friend lobby on TrucoMenuPage (task 6.3)
// ---------------------------------------------------------------------------
// Pins the create-with-friend and join-by-code flows against EXACT backend
// reality:
//   POST /api/truco/matches {targetPoints?, friendId?} → {matchId, code, status}
//     403 NOT_FRIENDS when body.friendId is not an accepted friend
//   GET  /api/truco/matches/code/:code → {matchId, status} | 404 CODE_NOT_FOUND
//   POST /api/truco/matches/code/:code/join → {matchId} | 409 match_not_joinable
// S3 convenience: the UI pre-checks the code with the GET so a bad code gets a
// friendly message WITHOUT firing the join POST.
//
// Identifier contract (backend-checked): friendsService returns each row with
// friendId = the FRIEND'S user id; trucoService validates body.friendId
// against the friends table userId/friendId columns. So the picker MUST send
// FriendUser.friendId — never .id.

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

describe('TrucoMenuPage — friend lobby (CU6 slice 6c-i)', () => {
  beforeEach(() => {
    seedStores();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('enables the vs-friend entry point and reveals the lobby section', () => {
    renderMenu();

    const vsFriend = screen.getByTestId('truco-menu-vs-friend');
    expect(vsFriend).not.toBeDisabled();

    // Progressive disclosure: the lobby panel appears once the entry is used.
    expect(screen.queryByTestId('truco-menu-friend')).toBeNull();
    fireEvent.click(vsFriend);
    expect(screen.getByTestId('truco-menu-friend')).toBeTruthy();
  });

  it('lists friends with their USER id as value and honest online markers', () => {
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

    const select = screen.getByTestId('truco-multi-friend-select') as HTMLSelectElement;
    const maria = screen.getByRole('option', { name: /maria/ }) as HTMLOptionElement;
    const jose = screen.getByRole('option', { name: /jose/ }) as HTMLOptionElement;

    // Backend identity contract: option VALUE is the friend's user id.
    expect(maria.value).toBe('user-maria');
    expect(jose.value).toBe('user-jose');
    expect(maria.getAttribute('data-online')).toBe('true');
    expect(jose.getAttribute('data-online')).toBe('false');

    // Default selection is the explicit "open match" choice (value ''), NOT a
    // friend — creating without picking anyone must be a valid open challenge.
    expect(select.value).toBe('');
  });

  it('shows a no-friends hint instead of controls when the list is empty', () => {
    seedStores({ friends: [], online: [] });
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

    expect(screen.getByTestId('truco-multi-no-friends')).toBeTruthy();
    expect(screen.queryByTestId('truco-multi-create')).toBeNull();
    expect(screen.queryByTestId('truco-multi-join')).toBeNull();
  });

  it('create sends {targetPoints, friendId} and navigates to the match route', async () => {
    trucoApiMock.createTrucoMatch.mockResolvedValue({
      matchId: 'm-new',
      code: 'ABCD12',
      status: 'ready',
    });
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

    fireEvent.change(screen.getByTestId('truco-multi-friend-select'), {
      target: { value: 'user-maria' },
    });
    fireEvent.click(screen.getByTestId('truco-multi-create'));

    await screen.findByTestId('truco-match-route-probe');

    expect(trucoApiMock.createTrucoMatch).toHaveBeenCalledWith({
      targetPoints: 30,
      friendId: 'user-maria',
    });
  });

  it('create without a picked friend opens a code match (no friendId sent)', async () => {
    trucoApiMock.createTrucoMatch.mockResolvedValue({
      matchId: 'm-open',
      code: 'OPEN99',
      status: 'waiting',
    });
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

    // Default selection stays '' — nobody picked.
    fireEvent.click(screen.getByTestId('truco-multi-create'));
    await screen.findByTestId('truco-match-route-probe');

    const call = trucoApiMock.createTrucoMatch.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.targetPoints).toBe(30);
    expect('friendId' in call ? call.friendId : undefined).toBeUndefined();
  });

  it('NOT_FRIENDS (403) surfaces the friendly message and never navigates', async () => {
    trucoApiMock.createTrucoMatch.mockRejectedValue(
      Object.assign(new Error('You can only invite friends'), { status: 403 }),
    );
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

    fireEvent.click(screen.getByTestId('truco-multi-create'));

    await waitFor(() => {
      expect(screen.getByTestId('truco-multi-error')).toHaveTextContent(
        i18n.t('truco.error.notFriends'),
      );
    });
    expect(screen.queryByTestId('truco-match-route-probe')).toBeNull();
  });

  it('join-by-code pre-checks with the GET, then joins, then navigates (S3 order)', async () => {
    trucoApiMock.lookupTrucoMatchByCode.mockResolvedValue({ matchId: 'm-x', status: 'waiting' });
    trucoApiMock.joinTrucoMatchByCode.mockResolvedValue({ matchId: 'm-x' });
    renderMenu();
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

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
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

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
    fireEvent.click(screen.getByTestId('truco-menu-vs-friend'));

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
