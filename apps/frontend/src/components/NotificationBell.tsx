import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAvatar } from './ui/UserAvatar';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { connectSocket } from '../lib/socket';
import { useTranslation } from 'react-i18next';

const NOTIFICATION_LABELS: Record<string, string> = {
  friend_request: 'notifications.friendRequest',
  friend_request_accepted: 'notifications.friendRequestAccepted',
  new_message: 'notifications.newMessage',
};

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } =
    useNotificationStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Connect socket and fetch notifications on mount
  useEffect(() => {
    if (!token) return;
    connectSocket(token);
    fetchNotifications();
  }, [token, fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleNotificationClick = (notification: (typeof notifications)[0]) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setOpen(false);

    // Navigate based on type
    if (notification.type === 'new_message') {
      navigate(`/friends/chat/${notification.fromUserId}`);
    } else {
      navigate('/friends');
    }
  };

  const getLabel = (type: string) => {
    const key = NOTIFICATION_LABELS[type];
    return key ? t(key) : type;
  };

  const getDescription = (notification: (typeof notifications)[0]) => {
    const fromName = notification.fromDisplayName || notification.fromUsername || 'Someone';
    const label = getLabel(notification.type);

    if (notification.type === 'new_message') {
      const preview = (notification.metadata?.content as string) || '';
      return `${fromName}: ${preview}`;
    }
    if (notification.type === 'friend_request') {
      return t('notifications.friendRequestFrom', { name: fromName });
    }
    if (notification.type === 'friend_request_accepted') {
      return t('notifications.friendAccepted', { name: fromName });
    }
    return `${fromName} — ${label}`;
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 min-h-[44px] min-w-[44px] hover:bg-[var(--color-muted)]"
        aria-label={t('notifications.title')}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-destructive)] text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
              {t('notifications.title')}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  markAllAsRead();
                }}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                {t('notifications.empty')}
              </p>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full min-h-[44px] border-b border-[var(--color-border)] px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-[var(--color-muted)] ${
                    !n.read ? 'bg-[var(--color-muted)]/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {/* Avatar */}
                    <UserAvatar
                      avatarUrl={n.fromAvatarUrl}
                      username={n.fromUsername || '?'}
                      displayName={n.fromDisplayName}
                      className="mt-0.5 h-8 w-8 text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate ${
                          !n.read ? 'font-semibold text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'
                        }`}
                      >
                        {getDescription(n)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                        {new Date(n.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
