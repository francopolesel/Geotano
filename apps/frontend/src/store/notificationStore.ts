import { create } from 'zustand';
import type { Notification } from '@geotano/shared';
import { api } from '../lib/api';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;

  fetchNotifications: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  /** Mark as read on backend AND remove from local list immediately */
  dismissNotification: (id: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const data = await api.get<{
        notifications: Notification[];
        unreadCount: number;
      }>('/notifications');
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
      });
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      set({ loading: false });
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: async (id) => {
    try {
      await api.post(`/notifications/read/${id}`, {});
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      await api.post('/notifications/read-all', {});
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  dismissNotification: async (id) => {
    // Optimistically remove from local list immediately
    const prev = get().notifications;
    const removed = prev.find((n) => n.id === id);
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (removed && !removed.read ? 1 : 0)),
    }));

    try {
      // Mark as read on backend
      await api.post(`/notifications/read/${id}`, {});
      // Then delete it so it doesn't come back on refresh
      await api.delete(`/notifications/${id}`);
    } catch {
      // Restore on failure
      if (removed) {
        set((state) => ({
          notifications: [...state.notifications, removed],
          unreadCount: state.unreadCount + (removed.read ? 0 : 1),
        }));
      }
    }
  },
}));
