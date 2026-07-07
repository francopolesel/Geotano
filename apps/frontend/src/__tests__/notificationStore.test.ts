import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { useNotificationStore } from '../store/notificationStore';
import { api } from '../lib/api';

const mockNotification = {
  id: 'notif-1',
  userId: 'u-1',
  type: 'friend_request' as const,
  fromUserId: 'u-2',
  fromUsername: 'alice',
  fromDisplayName: 'Alice',
  metadata: {} as Record<string, unknown>,
  read: false,
  createdAt: '2025-01-01T00:00:00Z',
};

// ─── Notification Store ─────────────────────────────────────────────────────

describe('notificationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      loading: false,
    });
  });

  it('should start with default state', () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.loading).toBe(false);
  });

  describe('fetchNotifications', () => {
    it('should fetch and set notifications on success', async () => {
      const mockData = {
        notifications: [mockNotification],
        unreadCount: 1,
      };
      vi.mocked(api.get).mockResolvedValueOnce(mockData);

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('notif-1');
      expect(state.unreadCount).toBe(1);
      expect(state.loading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ notifications: [], unreadCount: 0 });

      const promise = useNotificationStore.getState().fetchNotifications();
      expect(useNotificationStore.getState().loading).toBe(true);

      await promise;
      expect(useNotificationStore.getState().loading).toBe(false);
    });

    it('should silently fail on API error', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.loading).toBe(false);
    });
  });

  describe('addNotification', () => {
    it('should prepend notification and increment unreadCount', () => {
      useNotificationStore.getState().addNotification(mockNotification);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('notif-1');
      expect(state.unreadCount).toBe(1);
    });

    it('should keep newest notification first', () => {
      const older = { ...mockNotification, id: 'notif-0', read: true };
      useNotificationStore.setState({ notifications: [older], unreadCount: 0 });

      useNotificationStore.getState().addNotification(mockNotification);

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].id).toBe('notif-1');
      expect(state.notifications[1].id).toBe('notif-0');
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read on success', async () => {
      useNotificationStore.setState({ notifications: [mockNotification], unreadCount: 1 });
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useNotificationStore.getState().markAsRead('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should only mark matching notification as read when multiple exist', async () => {
      const n2 = { ...mockNotification, id: 'notif-2' };
      useNotificationStore.setState({ notifications: [mockNotification, n2], unreadCount: 2 });
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useNotificationStore.getState().markAsRead('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(true);
      expect(state.notifications[1].id).toBe('notif-2');
      expect(state.notifications[1].read).toBe(false); // unchanged
      expect(state.unreadCount).toBe(1);
    });

    it('should not update state on API failure', async () => {
      useNotificationStore.setState({ notifications: [mockNotification], unreadCount: 1 });
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

      // Should not throw
      await expect(
        useNotificationStore.getState().markAsRead('notif-1'),
      ).resolves.toBeUndefined();

      const state = useNotificationStore.getState();
      expect(state.notifications[0].read).toBe(false);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('markAllAsRead', () => {
    it('should clear all notifications on success', async () => {
      const n2 = { ...mockNotification, id: 'notif-2' };
      useNotificationStore.setState({ notifications: [mockNotification, n2], unreadCount: 2 });
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
    });

    it('should not clear state on API failure', async () => {
      useNotificationStore.setState({ notifications: [mockNotification], unreadCount: 1 });
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('dismissNotification', () => {
    it('should optimistically remove unread notification on success', async () => {
      useNotificationStore.setState({ notifications: [mockNotification], unreadCount: 1 });
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useNotificationStore.getState().dismissNotification('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('should restore notification on API failure', async () => {
      useNotificationStore.setState({ notifications: [mockNotification], unreadCount: 1 });
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

      await useNotificationStore.getState().dismissNotification('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('notif-1');
      expect(state.unreadCount).toBe(1);
    });

    it('should not adjust unreadCount for read notification on dismiss', async () => {
      const readNotification = { ...mockNotification, read: true };
      useNotificationStore.setState({ notifications: [readNotification], unreadCount: 0 });
      vi.mocked(api.post).mockResolvedValueOnce({});

      await useNotificationStore.getState().dismissNotification('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(0);
      expect(state.unreadCount).toBe(0);
    });

    it('should restore read notification without changing unreadCount', async () => {
      const readNotification = { ...mockNotification, read: true };
      useNotificationStore.setState({ notifications: [readNotification], unreadCount: 0 });
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

      await useNotificationStore.getState().dismissNotification('notif-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].read).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('should handle non-existent notification silently', async () => {
      useNotificationStore.setState({ notifications: [], unreadCount: 0 });
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

      // Should not throw — `removed` is undefined, restore branch skipped
      await expect(
        useNotificationStore.getState().dismissNotification('ghost'),
      ).resolves.toBeUndefined();

      expect(useNotificationStore.getState().notifications).toEqual([]);
    });
  });
});
