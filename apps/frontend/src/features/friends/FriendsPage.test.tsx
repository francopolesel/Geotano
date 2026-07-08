import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string, params?: Record<string, any>) => {
  const dict: Record<string, string> = {
    'friends.title': 'Friends',
    'friends.pending': 'Requests',
    'friends.search': 'Search',
    'friends.blocked': 'Blocked',
    'friends.noFriends': 'No friends yet',
    'friends.noFriendsHint': 'Find friends to play with!',
    'friends.findFriends': 'Find Friends',
    'friends.friendCount': '{count} friends',
    'friends.onlineCount': '{count} online',
    'friends.chat': '💬',
    'friends.remove': 'Remove',
    'friends.block': 'Block',
    'friends.incoming': 'Incoming Requests',
    'friends.outgoing': 'Outgoing Requests',
    'friends.accept': 'Accept',
    'friends.reject': 'Reject',
    'friends.cancel': 'Cancel',
    'friends.noRequests': 'No pending requests',
    'friends.noRequestsHint': 'Share your invite code to connect!',
    'friends.sendRequest': 'Add Friend',
    'friends.redeemLoading': 'Redeeming...',
    'friends.searchPlaceholder': 'Search by username...',
    'friends.noUsersFound': 'No users found',
    'friends.inviteYourCode': 'Your Invite Code',
    'friends.inviteShareDesc': 'Share this code with friends',
    'friends.inviteCopy': 'Copy',
    'friends.inviteCopied': 'Copied!',
    'friends.addByCode': 'Add by Code',
    'friends.addByCodeDesc': 'Enter a friend\'s invite code',
    'friends.redeemPlaceholder': 'Enter invite code',
    'friends.redeemSuccess': 'Friend added!',
    'friends.noBlocked': 'No blocked users',
    'friends.unblock': 'Unblock',
    'friends.confirmRemoveTitle': 'Remove friend?',
    'friends.confirmRemoveBody': 'Are you sure you want to remove {username} from your friends?',
    'friends.confirmBlockTitle': 'Block user?',
    'friends.confirmBlockBody': 'Are you sure you want to block {username}?',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'errors.friends.inviteInvalid': 'Invalid invite code',
  };
  let text = dict[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  return text;
};

// ─── Shared mutable store state ────────────────────────────────────────────
const storeState = vi.hoisted(() => ({
  friends: [] as any[],
  pendingIncoming: [] as any[],
  pendingOutgoing: [] as any[],
  searchResults: [] as any[],
  blockedUsers: [] as any[],
  onlineUsers: new Set<string>(),
  isLoading: false,
  error: null as string | null,
  fetchFriends: vi.fn(),
  searchUsers: vi.fn(),
  sendRequest: vi.fn(),
  cancelRequest: vi.fn(),
  acceptRequest: vi.fn(),
  declineRequest: vi.fn(),
  getInviteLink: vi.fn(() => Promise.resolve('https://geotano.com/invite/abc123')),
  redeemInvite: vi.fn(),
  fetchBlocked: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  removeFriend: vi.fn(),
  clearSearch: vi.fn(),
  clearError: vi.fn(),
}));

const mockToken = vi.hoisted(() => ({ current: 'test-token' }));
const mockNavigate = vi.hoisted(() => vi.fn());
const mockConnectSocket = vi.hoisted(() => vi.fn());
const mockDisconnectSocket = vi.hoisted(() => vi.fn());

// ─── Mock data ─────────────────────────────────────────────────────────────
const sampleFriend = {
  id: 'rel-1',
  friendId: 'friend-1',
  username: 'bestie',
  displayName: 'Best Friend',
  avatarUrl: null,
  status: 'accepted',
};

const sampleIncoming = {
  id: 'req-1',
  senderId: 'stranger-1',
  username: 'stranger1',
  displayName: 'Stranger One',
  avatarUrl: null,
};

const sampleOutgoing = {
  id: 'req-2',
  receiverId: 'pending-1',
  username: 'pendinguser',
  displayName: null,
  avatarUrl: null,
};

const sampleSearchResult = {
  id: 'user-found',
  username: 'founduser',
  displayName: 'Found User',
  avatarUrl: null,
};

const sampleBlocked = {
  id: 'block-1',
  userId: 'blocked-1',
  username: 'badactor',
  displayName: 'Bad Actor',
};

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => T(key, params) }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const authStore = { token: mockToken.current, user: { id: 'user-1' } };
    return selector ? selector(authStore) : authStore;
  },
}));

vi.mock('../../store/friendsStore', () => ({
  useFriendsStore: (selector?: (s: any) => any) => {
    const store = {
      friends: storeState.friends,
      pendingIncoming: storeState.pendingIncoming,
      pendingOutgoing: storeState.pendingOutgoing,
      searchResults: storeState.searchResults,
      blockedUsers: storeState.blockedUsers,
      onlineUsers: storeState.onlineUsers,
      isLoading: storeState.isLoading,
      error: storeState.error,
      fetchFriends: storeState.fetchFriends,
      searchUsers: storeState.searchUsers,
      sendRequest: storeState.sendRequest,
      cancelRequest: storeState.cancelRequest,
      acceptRequest: storeState.acceptRequest,
      declineRequest: storeState.declineRequest,
      getInviteLink: storeState.getInviteLink,
      redeemInvite: storeState.redeemInvite,
      fetchBlocked: storeState.fetchBlocked,
      blockUser: storeState.blockUser,
      unblockUser: storeState.unblockUser,
      removeFriend: storeState.removeFriend,
      clearSearch: storeState.clearSearch,
      clearError: storeState.clearError,
    };
    return selector ? selector(store) : store;
  },
}));

vi.mock('../../lib/socket', () => ({
  connectSocket: mockConnectSocket,
  disconnectSocket: mockDisconnectSocket,
}));

vi.mock('../../components/ui/UserAvatar', () => ({
  UserAvatar: ({ username, displayName }: any) => (
    <div data-testid="friend-avatar">{displayName ?? username}</div>
  ),
}));

import { FriendsPage } from './FriendsPage';

describe('FriendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.friends = [sampleFriend];
    storeState.pendingIncoming = [];
    storeState.pendingOutgoing = [];
    storeState.searchResults = [];
    storeState.blockedUsers = [];
    storeState.onlineUsers = new Set(['friend-1']);
    storeState.isLoading = false;
    storeState.error = null;
  });

  // ── Layout ───────────────────────────────────────────────────────────────

  it('should render title and tabs', () => {
    render(<FriendsPage />);
    expect(screen.getByRole('heading', { name: 'Friends' })).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    storeState.isLoading = true;
    render(<FriendsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error banner', () => {
    storeState.error = 'Something went wrong';
    render(<FriendsPage />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should fetch friends on mount', () => {
    render(<FriendsPage />);
    expect(storeState.fetchFriends).toHaveBeenCalled();
  });

  it('should connect socket on mount', () => {
    render(<FriendsPage />);
    expect(mockConnectSocket).toHaveBeenCalledWith('test-token');
  });

  // ── Friends tab ──────────────────────────────────────────────────────────

  it('should render friend list', () => {
    render(<FriendsPage />);
    expect(screen.getByText('Best Friend', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('@bestie')).toBeInTheDocument();
  });

  it('should show online indicator for online friends', () => {
    render(<FriendsPage />);
    expect(screen.getByText(/1 friends/)).toBeInTheDocument();
  });

  it('should show empty friends state', () => {
    storeState.friends = [];
    render(<FriendsPage />);
    expect(screen.getByText('No friends yet')).toBeInTheDocument();
  });

  it('should navigate to chat on chat button click', () => {
    render(<FriendsPage />);
    const chatBtn = screen.getByTitle('💬');
    fireEvent.click(chatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/friends/chat/friend-1');
  });

  it('should navigate to profile on friend name click', () => {
    render(<FriendsPage />);
    fireEvent.click(screen.getAllByText('Best Friend')[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/profile/friend-1');
  });

  it('should call removeFriend after confirming modal', async () => {
    storeState.removeFriend.mockResolvedValueOnce(undefined);
    render(<FriendsPage />);
    // Click Remove button → modal opens
    fireEvent.click(screen.getByText('Remove'));
    // Click confirm button inside modal (the second Remove)
    fireEvent.click(screen.getAllByText('Remove')[1]);
    await waitFor(() => {
      expect(storeState.removeFriend).toHaveBeenCalledWith('friend-1');
    });
  });

  it('should call blockUser after confirming modal', async () => {
    storeState.blockUser.mockResolvedValueOnce(undefined);
    render(<FriendsPage />);
    // Click Block button → modal opens
    fireEvent.click(screen.getByText('Block'));
    // Click confirm button inside modal (the second Block)
    fireEvent.click(screen.getAllByText('Block')[1]);
    await waitFor(() => {
      expect(storeState.blockUser).toHaveBeenCalledWith('friend-1');
    });
  });

  // ── Requests tab ─────────────────────────────────────────────────────────

  it('should show incoming requests with accept/reject', () => {
    storeState.pendingIncoming = [sampleIncoming];
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Requests'));
    expect(screen.getByText('Stranger One', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Accept'));
    expect(storeState.acceptRequest).toHaveBeenCalledWith('req-1');

    fireEvent.click(screen.getByText('Reject'));
    expect(storeState.declineRequest).toHaveBeenCalledWith('req-1');
  });

  it('should show outgoing requests with cancel', async () => {
    storeState.pendingOutgoing = [sampleOutgoing];
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Requests'));
    expect(screen.getByText('pendinguser', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(storeState.cancelRequest).toHaveBeenCalledWith('req-2');
    });
  });

  it('should show empty requests state', () => {
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Requests'));
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
  });

  // ── Search tab ───────────────────────────────────────────────────────────

  it('should show search input', () => {
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));
    expect(screen.getByPlaceholderText('Search by username...')).toBeInTheDocument();
  });

  it('should show search results', async () => {
    storeState.searchResults = [sampleSearchResult];
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByPlaceholderText('Search by username...');
    fireEvent.change(searchInput, { target: { value: 'found' } });

    // Debounced search fires after 300ms
    await waitFor(() => {
      expect(storeState.searchUsers).toHaveBeenCalledWith('found');
    });

    expect(screen.getByText('Found User', { selector: 'p' })).toBeInTheDocument();
  });

  it('should show no results message', async () => {
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByPlaceholderText('Search by username...');
    fireEvent.change(searchInput, { target: { value: 'xx' } });

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  it('should send friend request from search results', () => {
    storeState.searchResults = [sampleSearchResult];
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Search'));
    const searchInput = screen.getByPlaceholderText('Search by username...');
    fireEvent.change(searchInput, { target: { value: 'found' } });

    fireEvent.click(screen.getAllByText('Add Friend')[0]);
    expect(storeState.sendRequest).toHaveBeenCalledWith('founduser');
  });

  // ── Invite code ──────────────────────────────────────────────────────────

  it('should fetch invite code on search tab', async () => {
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(storeState.getInviteLink).toHaveBeenCalled();
    });
  });

  it('should show invite code', async () => {
    storeState.getInviteLink.mockResolvedValue('https://geotano.com/invite/xyz789');
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      const codeInput = screen.getByDisplayValue('xyz789');
      expect(codeInput).toBeInTheDocument();
    });
  });

  it('should copy invite code to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copy'));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  // ── Redeem invite ────────────────────────────────────────────────────────

  it('should redeem invite code on submit', async () => {
    storeState.redeemInvite.mockResolvedValueOnce(undefined);
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter invite code')).toBeInTheDocument();
    });

    const redeemInput = screen.getByPlaceholderText('Enter invite code');
    fireEvent.change(redeemInput, { target: { value: 'mycode' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }));

    await waitFor(() => {
      expect(storeState.redeemInvite).toHaveBeenCalledWith('mycode');
    });
  });

  it('should show redeem success message', async () => {
    storeState.redeemInvite.mockResolvedValueOnce(undefined);
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      const redeemInput = screen.getByPlaceholderText('Enter invite code');
      fireEvent.change(redeemInput, { target: { value: 'mycode' } });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }));

    await waitFor(() => {
      expect(screen.getByText('Friend added!')).toBeInTheDocument();
    });
  });

  it('should show redeem error message', async () => {
    storeState.redeemInvite.mockRejectedValueOnce(new Error('Invalid invite code'));
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      const redeemInput = screen.getByPlaceholderText('Enter invite code');
      fireEvent.change(redeemInput, { target: { value: 'badcode' } });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
    });
  });

  // ── Blocked tab ──────────────────────────────────────────────────────────

  it('should show blocked users', () => {
    storeState.blockedUsers = [sampleBlocked];
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Blocked'));

    expect(screen.getByText('Bad Actor')).toBeInTheDocument();
    expect(screen.getByText('@badactor')).toBeInTheDocument();
  });

  it('should unblock user', async () => {
    storeState.blockedUsers = [sampleBlocked];
    storeState.unblockUser.mockResolvedValueOnce(undefined);
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Blocked'));

    fireEvent.click(screen.getByText('Unblock'));
    await waitFor(() => {
      expect(storeState.unblockUser).toHaveBeenCalledWith('blocked-1');
    });
  });

  it('should show empty blocked state', () => {
    render(<FriendsPage />);
    fireEvent.click(screen.getByText('Blocked'));
    expect(screen.getByText('No blocked users')).toBeInTheDocument();
  });

  // ── Tab switching ────────────────────────────────────────────────────────

  it('should switch to search tab from empty friends CTA', () => {
    storeState.friends = [];
    render(<FriendsPage />);

    fireEvent.click(screen.getByText('Find Friends'));
    // Search tab should now be active — search input should be visible
    expect(screen.getByPlaceholderText('Search by username...')).toBeInTheDocument();
  });
});
