import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Shared state via vi.hoisted (required for vi.mock factories) ────────

const { mockToken, mockNotifications, mockUnreadCount, mockConnectSocket, mockNavigate } = vi.hoisted(() => ({
  mockToken: { value: 'test-token' as string | null },
  mockNotifications: { value: [] as any[] },
  mockUnreadCount: { value: 0 },
  mockConnectSocket: vi.fn(),
  mockNavigate: vi.fn(),
}));

const mockFetchNotifications = vi.fn();
const mockDismissNotification = vi.fn();
const mockMarkAllAsRead = vi.fn();

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => mockNavigate),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const keys: Record<string, string> = {
        'notifications.title': 'Notifications',
        'notifications.empty': 'No notifications',
        'notifications.markAllRead': 'Mark all as read',
        'notifications.someone': 'Someone',
        'notifications.friendRequest': 'Friend Request',
        'notifications.newMessage': 'New Message',
        'notifications.friendRequestAccepted': 'Friend Request Accepted',
        'notifications.friendRequestFrom': 'Friend request from {name}',
        'notifications.friendAccepted': '{name} accepted your request',
        'notifications.descriptionFormat': '{fromName} — {label}',
      };
      let result = keys[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, v);
        }
      }
      return result;
    },
    i18n: {
      get language() { return 'en'; },
    },
  }),
}));

vi.mock('../i18n/i18n', () => ({
  default: {
    language: 'en',
    on: vi.fn(),
    changeLanguage: vi.fn(),
  },
}));

vi.mock('../store/notificationStore', () => ({
  useNotificationStore: () => ({
    notifications: mockNotifications.value,
    unreadCount: mockUnreadCount.value,
    fetchNotifications: mockFetchNotifications,
    dismissNotification: mockDismissNotification,
    markAllAsRead: mockMarkAllAsRead,
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ token: mockToken.value }),
}));

vi.mock('../lib/socket', () => ({
  connectSocket: mockConnectSocket,
}));

vi.mock('./ui/UserAvatar', () => ({
  UserAvatar: ({ username }: { username: string }) => (
    <div data-testid="user-avatar" data-username={username} />
  ),
}));

import { NotificationBell } from './NotificationBell';

function createNotification(overrides: Record<string, any> = {}) {
  return {
    id: 'notif-1',
    type: 'friend_request',
    message: 'Friend request',
    read: false,
    createdAt: '2025-01-15T10:30:00.000Z',
    fromUserId: 'u-2',
    fromUsername: 'alice',
    fromDisplayName: 'Alice',
    fromAvatarUrl: null,
    metadata: null,
    ...overrides,
  };
}

describe('NotificationBell', () => {
  beforeEach(() => {
    mockToken.value = 'test-token';
    mockNotifications.value = [];
    mockUnreadCount.value = 0;
    vi.clearAllMocks();
  });

  it('should connect socket and fetch notifications on mount', () => {
    render(<NotificationBell />);

    expect(mockConnectSocket).toHaveBeenCalledWith('test-token');
    expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('should not connect socket when no token', () => {
    mockToken.value = null;

    render(<NotificationBell />);

    expect(mockConnectSocket).not.toHaveBeenCalled();
    expect(mockFetchNotifications).not.toHaveBeenCalled();
  });

  it('should render the bell button', () => {
    render(<NotificationBell />);

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('should show unread count badge when there are unread notifications', () => {
    mockUnreadCount.value = 3;
    render(<NotificationBell />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show 9+ when unread count exceeds 9', () => {
    mockUnreadCount.value = 15;
    render(<NotificationBell />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('should not show badge when unread count is 0', () => {
    render(<NotificationBell />);

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('should open dropdown when bell button is clicked', () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('should show notification list in dropdown', () => {
    mockNotifications.value = [createNotification()];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText(/Friend request from/)).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-username', 'alice');
  });

  it('should dismiss and navigate on notification click for friend_request', () => {
    mockNotifications.value = [createNotification()];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    const notifButton = screen.getByText(/Friend request from/).closest('button')!;
    fireEvent.click(notifButton);

    expect(mockDismissNotification).toHaveBeenCalledWith('notif-1');
    expect(mockNavigate).toHaveBeenCalledWith('/friends');
  });

  it('should navigate to chat for new_message type', () => {
    mockNotifications.value = [
      createNotification({ type: 'new_message', fromUserId: 'u-3', metadata: { content: 'Hello!' } }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    const notifButton = screen.getByText(/Alice/).closest('button')!;
    fireEvent.click(notifButton);

    expect(mockNavigate).toHaveBeenCalledWith('/friends/chat/u-3');
  });

  it('should show mark all read button when there are unread notifications', () => {
    mockNotifications.value = [createNotification()];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    const markAllBtn = screen.getByText('Mark all as read');
    expect(markAllBtn).toBeInTheDocument();

    fireEvent.click(markAllBtn);
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('should not show mark all read when unread is 0', () => {
    mockNotifications.value = [createNotification({ read: true })];
    mockUnreadCount.value = 0;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
  });

  it('should handle new_message description with content preview', () => {
    mockNotifications.value = [
      createNotification({
        type: 'new_message',
        fromDisplayName: 'Alice',
        metadata: { content: 'Hey there!' },
      }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Hey there!/)).toBeInTheDocument();
  });

  it('should handle friend_request_accepted type', () => {
    mockNotifications.value = [
      createNotification({
        type: 'friend_request_accepted',
        fromDisplayName: 'Bob',
      }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    expect(screen.getByText(/Bob accepted/)).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside (lines 37-45)', () => {
    mockNotifications.value = [createNotification()];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    // Dropdown should be open
    expect(screen.getByText(/Friend request from/)).toBeInTheDocument();

    // Click outside (on document.body)
    fireEvent.mouseDown(document.body);

    // Dropdown should close — content should no longer be visible
    expect(screen.queryByText(/Friend request from/)).not.toBeInTheDocument();
  });

  it('should use fallback description for unknown notification type (line 81)', () => {
    mockNotifications.value = [
      createNotification({
        type: 'custom_unknown',
        fromDisplayName: 'Charlie',
        metadata: null,
      }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    // getLabel('custom_unknown') returns the raw type string
    // getDescription falls through to the line 81 return
    expect(screen.getByText(/Charlie/)).toBeInTheDocument();
    expect(screen.getByText(/custom_unknown/)).toBeInTheDocument();
  });

  it('should fall back to "Someone" when both displayName and username are null (line 68)', () => {
    mockNotifications.value = [
      createNotification({
        fromDisplayName: null,
        fromUsername: null,
      }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    // fromDisplayName || fromUsername || t('notifications.someone') → 'Someone'
    expect(screen.getByText(/Someone/)).toBeInTheDocument();
    // Avatar username also falls back to '?'
    expect(screen.getByTestId('user-avatar')).toHaveAttribute('data-username', '?');
  });

  it('should show empty preview for new_message with null metadata (line 72)', () => {
    mockNotifications.value = [
      createNotification({
        type: 'new_message',
        fromDisplayName: 'Alice',
        metadata: null,
      }),
    ];
    mockUnreadCount.value = 1;

    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));

    // (notification.metadata?.content as string) || '' → ''
    // Description becomes "Alice: " with empty preview
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });
});
