import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFriendsStore } from '../../store/friendsStore';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket';

type Tab = 'friends' | 'requests' | 'search';

export function FriendsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const {
    friends,
    pendingIncoming,
    pendingOutgoing,
    searchResults,
    onlineUsers,
    isLoading,
    error,
    fetchFriends,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    getInviteLink,
    clearSearch,
    clearError,
  } = useFriendsStore();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Connect socket for online presence
  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
    return () => {
      disconnectSocket();
    };
  }, [token]);

  useEffect(() => {
    if (activeTab === 'search') {
      getInviteLink().then((link) => {
        const match = link.match(/\/invite\/(.+)$/);
        setInviteCode(match ? match[1] : '');
      });
    }
  }, [activeTab, getInviteLink]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        searchUsers(value);
      }, 300);
    },
    [searchUsers],
  );

  const handleSendRequest = async (username: string) => {
    setActionLoading(username);
    try {
      await sendRequest(username);
    } catch {
      // Error is set in store
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.getElementById('invite-code-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('friends.title')}
      </h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
        {(['friends', 'requests', 'search'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'search') clearSearch();
              clearError();
            }}
            className={`flex-1 rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'
            }`}
          >
            {tab === 'friends' && t('friends.title')}
            {tab === 'requests' && t('friends.pending')}
            {tab === 'search' && t('friends.search')}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('common.loading')}
        </div>
      )}

      {/* Tab: Friends List */}
      {activeTab === 'friends' && !isLoading && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('friends.noFriends')}
            </p>
          ) : (
            friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => navigate(`/friends/chat/${friend.friendId}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]"
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                  {(friend.displayName ?? friend.username).charAt(0).toUpperCase()}
                  {onlineUsers.has(friend.friendId) && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-card)] bg-green-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    {friend.displayName ?? friend.username}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    @{friend.username}
                  </p>
                </div>
                {onlineUsers.has(friend.friendId) && (
                  <span className="text-xs text-green-500">Online</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {/* Tab: Requests */}
      {activeTab === 'requests' && !isLoading && (
        <div className="space-y-6">
          {/* Incoming requests */}
          {pendingIncoming.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                Incoming
              </h3>
              <div className="space-y-2">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                      {(req.displayName ?? req.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">
                        {req.displayName ?? req.username}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        @{req.username}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          acceptRequest(req.id);
                        }}
                        className="rounded-md min-h-[44px] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
                      >
                        {t('friends.accept')}
                      </button>
                      <button
                        onClick={() => {
                          declineRequest(req.id);
                        }}
                        className="rounded-md min-h-[44px] border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                      >
                        {t('friends.reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing requests */}
          {pendingOutgoing.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium text-[var(--color-muted-foreground)]">
                Outgoing
              </h3>
              <div className="space-y-2">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                      {(req.displayName ?? req.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">
                        {req.displayName ?? req.username}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        @{req.username}
                      </p>
                    </div>
                    <span className="rounded-md bg-[var(--color-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
                      {t('friends.pending')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No pending requests
            </p>
          )}
        </div>
      )}

      {/* Tab: Search + Invite */}
      {activeTab === 'search' && !isLoading && (
        <div className="space-y-6">
          {/* Search users */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-foreground)]">
              {t('friends.search')}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by username..."
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
            />
          </div>

          {/* Search results */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
                  No users found
                </p>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
                      {(user.displayName ?? user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">
                        {user.displayName ?? user.username}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        @{user.username}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSendRequest(user.username)}
                      disabled={actionLoading === user.username}
                      className="rounded-md min-h-[44px] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
                    >
                      {actionLoading === user.username
                        ? t('common.loading')
                        : t('friends.sendRequest')}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Invite link section */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
              Invite friends
            </h3>
            <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              Share your invite code with friends to instantly connect!
            </p>
            <div className="flex gap-2">
              <input
                id="invite-code-input"
                type="text"
                value={inviteCode}
                readOnly
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-mono text-[var(--color-foreground)]"
              />
              <button
                onClick={handleCopyInvite}
                className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
