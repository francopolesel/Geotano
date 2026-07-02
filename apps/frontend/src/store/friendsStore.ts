import { create } from 'zustand';
import { api } from '../lib/api';
import type { UserProfile } from '@geotano/shared';

interface FriendUser {
  id: string;
  friendId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
}

interface PendingIncoming {
  id: string;
  senderId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
}

interface PendingOutgoing {
  id: string;
  receiverId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  status: string;
  createdAt: string;
}

interface SearchUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface BlockedUser {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  blockedAt: string;
}

interface FriendsState {
  friends: FriendUser[];
  pendingIncoming: PendingIncoming[];
  pendingOutgoing: PendingOutgoing[];
  searchResults: SearchUser[];
  blockedUsers: BlockedUser[];
  onlineUsers: Set<string>;
  isLoading: boolean;
  error: string | null;

  fetchFriends: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendRequest: (username: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getInviteLink: () => Promise<string>;
  redeemInvite: (code: string) => Promise<void>;
  fetchBlocked: () => Promise<void>;
  blockUser: (friendId: string) => Promise<void>;
  unblockUser: (friendId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;
  clearSearch: () => void;
  clearError: () => void;
}

export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  pendingIncoming: [],
  pendingOutgoing: [],
  searchResults: [],
  blockedUsers: [],
  onlineUsers: new Set<string>(),
  isLoading: false,
  error: null,

  fetchFriends: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<{
        friends: FriendUser[];
        pendingIncoming: PendingIncoming[];
        pendingOutgoing: PendingOutgoing[];
      }>('/friends');
      set({
        friends: data.friends,
        pendingIncoming: data.pendingIncoming,
        pendingOutgoing: data.pendingOutgoing,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load friends';
      set({ isLoading: false, error: message });
    }
  },

  searchUsers: async (query: string) => {
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }
    try {
      const data = await api.get<{ users: SearchUser[] }>(
        `/users/search?q=${encodeURIComponent(query.trim())}`,
      );
      set({ searchResults: data.users });
    } catch {
      set({ searchResults: [] });
    }
  },

  sendRequest: async (username: string) => {
    set({ error: null });
    try {
      await api.post('/friends/request', { username });
      // Remove the user from search results so the button doesn't show "Add friend"
      set((state) => ({
        searchResults: state.searchResults.filter((u) => u.username !== username),
      }));
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      set({ error: message });
      throw err;
    }
  },

  cancelRequest: async (requestId: string) => {
    try {
      await api.post('/friends/cancel', { requestId });
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel request';
      set({ error: message });
    }
  },

  acceptRequest: async (requestId: string) => {
    try {
      await api.post('/friends/accept', { requestId });
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept request';
      set({ error: message });
    }
  },

  declineRequest: async (requestId: string) => {
    try {
      await api.post('/friends/decline', { requestId });
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decline request';
      set({ error: message });
    }
  },

  getInviteLink: async () => {
    try {
      const data = await api.get<{ code: string; inviteLink: string }>('/invite-link');
      return data.inviteLink;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get invite link';
      set({ error: message });
      return '';
    }
  },

  redeemInvite: async (code: string) => {
    set({ error: null });
    try {
      await api.post('/friends/invite', { code });
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid invite code';
      set({ error: message });
      throw err;
    }
  },

  fetchBlocked: async () => {
    try {
      const data = await api.get<{ blocked: BlockedUser[] }>('/friends/blocked');
      set({ blockedUsers: data.blocked });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load blocked users';
      set({ error: message });
    }
  },

  blockUser: async (friendId: string) => {
    try {
      await api.post('/friends/block', { friendId });
      await get().fetchFriends();
      await get().fetchBlocked();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to block user';
      set({ error: message });
    }
  },

  unblockUser: async (friendId: string) => {
    try {
      await api.post('/friends/unblock', { friendId });
      await get().fetchBlocked();
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unblock user';
      set({ error: message });
    }
  },

  removeFriend: async (friendId: string) => {
    try {
      await api.post('/friends/remove', { friendId });
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove friend';
      set({ error: message });
    }
  },

  setOnline: (userId: string) => {
    const online = new Set(get().onlineUsers);
    online.add(userId);
    set({ onlineUsers: online });
  },

  setOffline: (userId: string) => {
    const online = new Set(get().onlineUsers);
    online.delete(userId);
    set({ onlineUsers: online });
  },

  clearSearch: () => set({ searchResults: [] }),
  clearError: () => set({ error: null }),
}));
