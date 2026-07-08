import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock the api module for authStore
vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

// Mock i18n for authStore
vi.mock('../i18n/i18n', () => ({
  default: {
    t: vi.fn((key: string) => key),
  },
}));

import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useThemeStore } from '../store/themeStore';
import { useFriendsStore } from '../store/friendsStore';
import { api } from '../lib/api';

// ─── Auth Store ─────────────────────────────────────────────────────────────

describe('authStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset store state
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('should start unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should login and persist token + user', async () => {
    const mockResponse = {
      token: 'jwt-abc-123',
      user: { id: '1', username: 'testuser', email: 'test@test.com', displayName: 'Test' },
    };
    vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

    await useAuthStore.getState().login('testuser', 'password123');

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-abc-123');
    expect(state.user?.username).toBe('testuser');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'jwt-abc-123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_user', expect.any(String));
  });

  it('should handle login failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      useAuthStore.getState().login('testuser', 'wrong'),
    ).rejects.toThrow('Invalid credentials');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Invalid credentials');
  });

  it('should handle login failure with non-Error rejection', async () => {
    vi.mocked(api.post).mockRejectedValueOnce('string error');

    await expect(
      useAuthStore.getState().login('testuser', 'password123'),
    ).rejects.toBe('string error');

    const state = useAuthStore.getState();
    expect(state.error).toBe('errors.common.loginFailed');
  });

  it('should register and persist token + user', async () => {
    const mockResponse = {
      token: 'jwt-xyz-789',
      user: { id: '2', username: 'newuser', email: 'new@test.com', displayName: 'New User' },
    };
    vi.mocked(api.post).mockResolvedValueOnce(mockResponse);

    await useAuthStore.getState().register('newuser', 'new@test.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-xyz-789');
    expect(state.user?.username).toBe('newuser');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should handle registration failure with ApiError 409', async () => {
    const { ApiError } = await import('../lib/api');
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Conflict', 409));

    await expect(
      useAuthStore.getState().register('existing', 'e@mail.com', 'password123'),
    ).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.error).toBe('auth.validation.usernameTaken');
  });

  it('should logout and clear state', () => {
    // Set up authenticated state
    useAuthStore.setState({
      token: 'jwt-abc',
      user: { id: '1', username: 'testuser' } as any,
      isAuthenticated: true,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
  });

  it('should hydrate from localStorage', () => {
    const user = { id: '1', username: 'testuser', email: 'test@test.com' };
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', JSON.stringify(user));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBe('stored-token');
    expect(state.user?.username).toBe('testuser');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should hydrate bio from localStorage when present', () => {
    const user = { id: '1', username: 'testuser', email: 'test@test.com', bio: 'Geo enthusiast' };
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', JSON.stringify(user));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.user?.bio).toBe('Geo enthusiast');
  });

  it('should hydrate bio as undefined when not in stored user', () => {
    const user = { id: '1', username: 'testuser', email: 'test@test.com' };
    localStorageMock.setItem('auth_token', 'stored-token');
    localStorageMock.setItem('auth_user', JSON.stringify(user));

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.user?.bio).toBeUndefined();
  });

  it('should handle corrupted localStorage on hydrate', () => {
    localStorageMock.setItem('auth_token', 'some-token');
    localStorageMock.setItem('auth_user', 'not-valid-json');

    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
  });

  it('should setAuth directly', () => {
    const user = { id: '1', username: 'direct', email: 'd@test.com' } as any;
    useAuthStore.getState().setAuth('direct-token', user);

    const state = useAuthStore.getState();
    expect(state.token).toBe('direct-token');
    expect(state.user?.username).toBe('direct');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should clear error', () => {
    useAuthStore.setState({ error: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should handle registration failure with generic Error', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Generic error'));

    await expect(
      useAuthStore.getState().register('user', 'e@mail.com', 'password123'),
    ).rejects.toThrow('Generic error');

    const state = useAuthStore.getState();
    expect(state.error).toBe('Generic error');
  });

  it('should handle registration failure with non-Error rejection', async () => {
    vi.mocked(api.post).mockRejectedValueOnce('string error');

    await expect(
      useAuthStore.getState().register('user', 'e@mail.com', 'password123'),
    ).rejects.toBe('string error');

    const state = useAuthStore.getState();
    expect(state.error).toBe('errors.common.registrationFailed');
  });
});

// ─── Game Store ──────────────────────────────────────────────────────────────

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      mode: null,
      sessionId: null,
      currentQuestion: null,
      score: 0,
      lives: 3,
      streak: 0,
      isPlaying: false,
    });
  });

  it('should start with default values', () => {
    const state = useGameStore.getState();
    expect(state.mode).toBeNull();
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.streak).toBe(0);
    expect(state.isPlaying).toBe(false);
  });

  it('should set game mode', () => {
    useGameStore.getState().setMode('flag-guess');
    expect(useGameStore.getState().mode).toBe('flag-guess');
  });

  it('should start a session', () => {
    useGameStore.getState().startSession('session-1');
    const state = useGameStore.getState();
    expect(state.sessionId).toBe('session-1');
    expect(state.isPlaying).toBe(true);
  });

  it('should set current question', () => {
    const question: any = { id: 'q-1', options: ['A', 'B', 'C', 'D'] };
    useGameStore.getState().setQuestion(question);
    expect(useGameStore.getState().currentQuestion?.id).toBe('q-1');
  });

  it('should update score', () => {
    useGameStore.getState().updateScore(150);
    expect(useGameStore.getState().score).toBe(150);

    useGameStore.getState().updateScore(50);
    expect(useGameStore.getState().score).toBe(200);
  });

  it('should lose a life', () => {
    useGameStore.getState().loseLife();
    expect(useGameStore.getState().lives).toBe(2);

    useGameStore.getState().loseLife();
    expect(useGameStore.getState().lives).toBe(1);
  });

  it('should update lives to a specific value', () => {
    useGameStore.getState().updateLives(5);
    expect(useGameStore.getState().lives).toBe(5);

    useGameStore.getState().updateLives(1);
    expect(useGameStore.getState().lives).toBe(1);
  });

  it('should not go below 0 lives (handled server-side)', () => {
    useGameStore.setState({ lives: 0 });
    useGameStore.getState().loseLife();
    expect(useGameStore.getState().lives).toBe(-1); // client doesn't clamp, server does
  });

  it('should increment streak', () => {
    useGameStore.getState().incrementStreak();
    expect(useGameStore.getState().streak).toBe(1);
    useGameStore.getState().incrementStreak();
    expect(useGameStore.getState().streak).toBe(2);
  });

  it('should reset streak', () => {
    useGameStore.setState({ streak: 5 });
    useGameStore.getState().resetStreak();
    expect(useGameStore.getState().streak).toBe(0);
  });

  it('should end game', () => {
    useGameStore.setState({
      sessionId: 'session-1',
      currentQuestion: { id: 'q-1' } as any,
      isPlaying: true,
    });

    useGameStore.getState().endGame();

    const state = useGameStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentQuestion).toBeNull();
    // sessionId should persist (reset clears it)
    expect(state.sessionId).toBe('session-1');
  });

  it('should reset all game state', () => {
    useGameStore.setState({
      sessionId: 'session-1',
      currentQuestion: { id: 'q-1' } as any,
      score: 500,
      lives: 1,
      streak: 10,
      isPlaying: true,
    });

    useGameStore.getState().reset();

    const state = useGameStore.getState();
    expect(state.sessionId).toBeNull();
    expect(state.currentQuestion).toBeNull();
    expect(state.score).toBe(0);
    expect(state.lives).toBe(3);
    expect(state.streak).toBe(0);
    expect(state.isPlaying).toBe(false);
  });
});

// ─── Theme Store ─────────────────────────────────────────────────────────────

describe('themeStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Reset
    useThemeStore.setState({ theme: 'light' });

    // Remove dark class if present
    document.documentElement.classList.remove('dark');
  });

  it('should start with light theme', () => {
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('should toggle theme and persist', () => {
    useThemeStore.getState().toggle();

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');

    // Toggle back
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('should hydrate from stored preference', () => {
    localStorageMock.setItem('theme', 'dark');

    useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should fall back to system preference when no stored theme', () => {
    // matchMedia mock returns false for prefers-color-scheme: dark → light
    useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should apply dark class when hydrating dark theme', () => {
    localStorageMock.setItem('theme', 'dark');

    useThemeStore.getState().hydrate();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme dark stores and applies theme', () => {
    useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('setTheme light stores and applies theme', () => {
    useThemeStore.setState({ theme: 'dark' });
    document.documentElement.classList.add('dark');

    useThemeStore.getState().setTheme('light');

    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
  });

  it('getSystemTheme returns dark when system prefers dark', () => {
    const originalMatchMedia = window.matchMedia;
    (window as any).matchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    useThemeStore.getState().hydrate();

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    (window as any).matchMedia = originalMatchMedia;
  });

  it('should return light when window is undefined (SSR guard)', () => {
    // Temporarily remove window to test the SSR branch in getSystemTheme
    localStorageMock.clear();

    const desc = Object.getOwnPropertyDescriptor(globalThis, 'window')!;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });

    try {
      useThemeStore.getState().hydrate();

      expect(useThemeStore.getState().theme).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'window', desc);
    }
  });
});

// ─── Friends Store ───────────────────────────────────────────────────────────

describe('friendsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.setState({
      friends: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      searchResults: [],
      onlineUsers: new Set<string>(),
      isLoading: false,
      error: null,
    });
  });

  describe('fetchFriends', () => {
    it('should fetch and set friends list on success', async () => {
      const mockData = {
        friends: [
          { id: 'f-1', friendId: 'user-2', username: 'alice', displayName: 'Alice', status: 'accepted', createdAt: '2025-01-01T00:00:00Z' },
        ],
        pendingIncoming: [
          { id: 'r-1', senderId: 'user-3', username: 'bob', displayName: 'Bob', status: 'pending', createdAt: '2025-01-02T00:00:00Z' },
        ],
        pendingOutgoing: [],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockData);

      await useFriendsStore.getState().fetchFriends();

      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].username).toBe('alice');
      expect(state.pendingIncoming).toHaveLength(1);
      expect(state.pendingIncoming[0].username).toBe('bob');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set isLoading during fetch', async () => {
      // Capture loading state before resolution
      const mockData = { friends: [], pendingIncoming: [], pendingOutgoing: [] };
      vi.mocked(api.get).mockResolvedValueOnce(mockData);

      // Start fetch but don't await yet — check loading state synchronously
      const promise = useFriendsStore.getState().fetchFriends();
      expect(useFriendsStore.getState().isLoading).toBe(true);

      await promise;
      expect(useFriendsStore.getState().isLoading).toBe(false);
    });

    it('should set error on fetch failure', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

      await useFriendsStore.getState().fetchFriends();

      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('should use i18n fallback on fetch failure with non-Error rejection', async () => {
      vi.mocked(api.get).mockRejectedValueOnce('string error');

      await useFriendsStore.getState().fetchFriends();

      expect(useFriendsStore.getState().error).toBe('errors.friends.loadFailed');
    });
  });

  describe('searchUsers', () => {
    it('should set searchResults from API response', async () => {
      const mockUsers = {
        users: [
          { id: 'u-1', username: 'geotano_fan', displayName: 'Geotano Fan' },
          { id: 'u-2', username: 'geo_master', displayName: 'Geo Master' },
        ],
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockUsers);

      await useFriendsStore.getState().searchUsers('geo');

      const state = useFriendsStore.getState();
      expect(state.searchResults).toHaveLength(2);
      expect(state.searchResults[0].username).toBe('geotano_fan');
    });

    it('should return empty results when query is too short', async () => {
      useFriendsStore.setState({ searchResults: [{ id: 'u-1', username: 'old' }] });

      await useFriendsStore.getState().searchUsers('a');

      const state = useFriendsStore.getState();
      expect(state.searchResults).toHaveLength(0);
      expect(api.get).not.toHaveBeenCalled();
    });

    it('should return empty results when API returns no users', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ users: [] });

      await useFriendsStore.getState().searchUsers('xyz');

      const state = useFriendsStore.getState();
      expect(state.searchResults).toHaveLength(0);
    });

    it('should return empty results on API failure', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Server error'));

      await useFriendsStore.getState().searchUsers('geo');

      expect(useFriendsStore.getState().searchResults).toHaveLength(0);
    });
  });

  describe('sendRequest', () => {
    it('should send friend request and refresh friends list on success', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ id: 'req-1', status: 'pending' });
      // fetchFriends is called after sendRequest succeeds — mock it too
      vi.mocked(api.get).mockResolvedValueOnce({ friends: [], pendingIncoming: [], pendingOutgoing: [{ id: 'req-1', receiverId: 'user-2', username: 'alice', status: 'pending', createdAt: '' }] });

      await useFriendsStore.getState().sendRequest('alice');

      expect(api.post).toHaveBeenCalledWith('/friends/request', { username: 'alice' });
      expect(api.get).toHaveBeenCalledWith('/friends'); // refetch
      const state = useFriendsStore.getState();
      expect(state.pendingOutgoing).toHaveLength(1);
      expect(state.error).toBeNull();
    });

    it('should set error and throw on 409 conflict', async () => {
      const { ApiError } = await import('../lib/api');
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Already friends', 409));

      await expect(
        useFriendsStore.getState().sendRequest('alice'),
      ).rejects.toThrow('Already friends');

      const state = useFriendsStore.getState();
      expect(state.error).toBe('Already friends');
    });
  });

  describe('acceptRequest', () => {
    it('should accept request and refresh friends list', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ status: 'accepted', friendId: 'user-3' });
      vi.mocked(api.get).mockResolvedValueOnce({
        friends: [{ id: 'f-2', friendId: 'user-3', username: 'bob', status: 'accepted', createdAt: '' }],
        pendingIncoming: [],
        pendingOutgoing: [],
      });

      await useFriendsStore.getState().acceptRequest('req-1');

      expect(api.post).toHaveBeenCalledWith('/friends/accept', { requestId: 'req-1' });
      expect(api.get).toHaveBeenCalledWith('/friends');
      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].username).toBe('bob');
    });

    it('should set error on accept failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Request not found'));

      await useFriendsStore.getState().acceptRequest('invalid-id');

      expect(useFriendsStore.getState().error).toBe('Request not found');
    });
  });

  describe('declineRequest', () => {
    it('should decline request and refresh friends list', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true });
      vi.mocked(api.get).mockResolvedValueOnce({ friends: [], pendingIncoming: [], pendingOutgoing: [] });

      await useFriendsStore.getState().declineRequest('req-1');

      expect(api.post).toHaveBeenCalledWith('/friends/decline', { requestId: 'req-1' });
      expect(api.get).toHaveBeenCalledWith('/friends');
    });

    it('should set error on decline failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Already responded'));

      await useFriendsStore.getState().declineRequest('req-1');

      expect(useFriendsStore.getState().error).toBe('Already responded');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a pending outgoing request and refresh friends', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true });
      vi.mocked(api.get).mockResolvedValueOnce({
        friends: [],
        pendingIncoming: [],
        pendingOutgoing: [],
      });

      await useFriendsStore.getState().cancelRequest('req-1');

      expect(api.post).toHaveBeenCalledWith('/friends/cancel', { requestId: 'req-1' });
      expect(api.get).toHaveBeenCalledWith('/friends');
    });

    it('should set error on cancel failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Request not found'));

      await useFriendsStore.getState().cancelRequest('invalid-id');

      expect(useFriendsStore.getState().error).toBe('Request not found');
    });
  });

  describe('inviteLink', () => {
    it('should return the invite link from API', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        code: 'abc123',
        inviteLink: 'http://localhost:5173/invite/abc123',
      });

      const link = await useFriendsStore.getState().getInviteLink();

      expect(link).toBe('http://localhost:5173/invite/abc123');
      expect(api.get).toHaveBeenCalledWith('/invite-link');
    });

    it('should return empty string on failure and set error', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Server error'));

      const link = await useFriendsStore.getState().getInviteLink();

      expect(link).toBe('');
      expect(useFriendsStore.getState().error).toBe('Server error');
    });
  });

  describe('redeemInvite', () => {
    it('should redeem invite code and refresh friends', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ status: 'accepted', friend: { id: 'user-2', username: 'alice' } });
      vi.mocked(api.get).mockResolvedValueOnce({
        friends: [{ id: 'f-3', friendId: 'user-2', username: 'alice', status: 'accepted', createdAt: '' }],
        pendingIncoming: [],
        pendingOutgoing: [],
      });

      await useFriendsStore.getState().redeemInvite('abc123');

      expect(api.post).toHaveBeenCalledWith('/friends/invite', { code: 'abc123' });
      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].username).toBe('alice');
    });

    it('should set error and throw on invalid code', async () => {
      const { ApiError } = await import('../lib/api');
      vi.mocked(api.post).mockRejectedValueOnce(new ApiError('Invalid invite code', 404));

      await expect(
        useFriendsStore.getState().redeemInvite('bad-code'),
      ).rejects.toThrow('Invalid invite code');

      expect(useFriendsStore.getState().error).toBe('Invalid invite code');
    });
  });

  describe('onlineUsers tracking', () => {
    it('should add userId to onlineUsers set', () => {
      useFriendsStore.getState().setOnline('user-1');
      useFriendsStore.getState().setOnline('user-2');

      const online = useFriendsStore.getState().onlineUsers;
      expect(online.has('user-1')).toBe(true);
      expect(online.has('user-2')).toBe(true);
      expect(online.size).toBe(2);
    });

    it('should remove userId from onlineUsers set', () => {
      useFriendsStore.getState().setOnline('user-1');
      useFriendsStore.getState().setOnline('user-2');

      useFriendsStore.getState().setOffline('user-1');

      const online = useFriendsStore.getState().onlineUsers;
      expect(online.has('user-1')).toBe(false);
      expect(online.has('user-2')).toBe(true);
      expect(online.size).toBe(1);
    });

    it('should not throw when removing non-existent userId', () => {
      expect(() => {
        useFriendsStore.getState().setOffline('nonexistent');
      }).not.toThrow();
    });

    it('should create a new Set reference on each mutation', () => {
      useFriendsStore.getState().setOnline('user-1');
      const firstRef = useFriendsStore.getState().onlineUsers;

      useFriendsStore.getState().setOnline('user-2');
      const secondRef = useFriendsStore.getState().onlineUsers;

      expect(firstRef).not.toBe(secondRef);
    });
  });

  describe('clearSearch and clearError', () => {
    it('should clear search results', () => {
      useFriendsStore.setState({ searchResults: [{ id: 'u-1', username: 'test' }] });
      useFriendsStore.getState().clearSearch();
      expect(useFriendsStore.getState().searchResults).toHaveLength(0);
    });

    it('should clear error', () => {
      useFriendsStore.setState({ error: 'Some error' });
      useFriendsStore.getState().clearError();
      expect(useFriendsStore.getState().error).toBeNull();
    });
  });

  describe('unblockUser', () => {
    it('should unblock user and refresh both lists', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true });
      vi.mocked(api.get)
        .mockResolvedValueOnce([]) // fetchBlocked
        .mockResolvedValueOnce({ friends: [], pendingIncoming: [], pendingOutgoing: [] }); // fetchFriends

      await useFriendsStore.getState().unblockUser('user-1');

      expect(api.post).toHaveBeenCalledWith('/friends/unblock', { friendId: 'user-1' });
      expect(api.get).toHaveBeenCalledWith('/friends/blocked');
      expect(api.get).toHaveBeenCalledWith('/friends');
    });

    it('should set error on unblock failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Cannot unblock'));

      await useFriendsStore.getState().unblockUser('user-1');

      expect(useFriendsStore.getState().error).toBe('Cannot unblock');
    });
  });

  describe('removeFriend', () => {
    it('should remove friend and refresh list', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true });
      vi.mocked(api.get).mockResolvedValueOnce({ friends: [], pendingIncoming: [], pendingOutgoing: [] });

      await useFriendsStore.getState().removeFriend('friend-1');

      expect(api.post).toHaveBeenCalledWith('/friends/remove', { friendId: 'friend-1' });
      expect(api.get).toHaveBeenCalledWith('/friends');
    });

    it('should set error on remove failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Not friends'));

      await useFriendsStore.getState().removeFriend('friend-1');

      expect(useFriendsStore.getState().error).toBe('Not friends');
    });
  });

  describe('fetchBlocked', () => {
    it('should fetch and set blocked users on success', async () => {
      vi.mocked(api.get).mockResolvedValueOnce([
        { id: 'b-1', userId: 'u-5', username: 'blocked_user', blockedAt: '2025-01-01T00:00:00Z' },
      ]);

      await useFriendsStore.getState().fetchBlocked();

      expect(useFriendsStore.getState().blockedUsers).toHaveLength(1);
      expect(useFriendsStore.getState().blockedUsers[0].username).toBe('blocked_user');
    });

    it('should set error on fetch failure', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Not authorized'));

      await useFriendsStore.getState().fetchBlocked();

      expect(useFriendsStore.getState().error).toBe('Not authorized');
    });
  });

  describe('blockUser', () => {
    it('should block user and refresh friends + blocked lists', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ success: true });
      vi.mocked(api.get)
        .mockResolvedValueOnce({ friends: [], pendingIncoming: [], pendingOutgoing: [] }) // fetchFriends
        .mockResolvedValueOnce([]); // fetchBlocked

      await useFriendsStore.getState().blockUser('friend-1');

      expect(api.post).toHaveBeenCalledWith('/friends/block', { friendId: 'friend-1' });
      expect(api.get).toHaveBeenCalledWith('/friends');
      expect(api.get).toHaveBeenCalledWith('/friends/blocked');
    });

    it('should set error on block failure', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Already blocked'));

      await useFriendsStore.getState().blockUser('friend-1');

      expect(useFriendsStore.getState().error).toBe('Already blocked');
    });
  });
});
