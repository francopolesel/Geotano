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

interface FriendsState {
  friends: FriendUser[];
  pendingIncoming: PendingIncoming[];
  pendingOutgoing: PendingOutgoing[];
  searchResults: SearchUser[];
  onlineUsers: Set<string>;
  isLoading: boolean;
  error: string | null;

  fetchFriends: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendRequest: (username: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getInviteLink: () => Promise<string>;
  redeemInvite: (code: string) => Promise<void>;
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
      await get().fetchFriends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      set({ error: message });
      throw err;
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
