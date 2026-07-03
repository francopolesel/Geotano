import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { AvatarLightbox } from '../../components/ui/AvatarLightbox';
import { useFriendsStore } from '../../store/friendsStore';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, disconnectSocket } from '../../lib/socket';

type Tab = 'friends' | 'requests' | 'search' | 'blocked';

export function FriendsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const {
    friends,
    pendingIncoming,
    pendingOutgoing,
    searchResults,
    blockedUsers,
    onlineUsers,
    isLoading,
    error,
    fetchFriends,
    searchUsers,
    sendRequest,
    cancelRequest,
    acceptRequest,
    declineRequest,
    getInviteLink,
    redeemInvite,
    fetchBlocked,
    blockUser,
    unblockUser,
    removeFriend,
    clearSearch,
    clearError,
  } = useFriendsStore();

  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
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

  const handleRedeemInvite = async () => {
    const code = redeemCode.trim();
    if (!code) return;
    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemSuccess(null);
    try {
      await redeemInvite(code);
      setRedeemSuccess('Friend added successfully! Check your friends list.');
      setRedeemCode('');
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-foreground)]">
        {t('friends.title')}
      </h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
        {(['friends', 'requests', 'search', 'blocked'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab !== 'search') clearSearch();
              if (tab === 'blocked') fetchBlocked();
              clearError();
              setRedeemError(null);
              setRedeemSuccess(null);
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
            {tab === 'blocked' && t('friends.blocked')}
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
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
              <p className="mb-2 text-sm text-[var(--color-muted-foreground)]">
                {t('friends.noFriends')}
              </p>
              <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
                Search for users or share your invite code to connect!
              </p>
              <button
                onClick={() => setActiveTab('search')}
                className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                Find friends
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
                  {onlineUsers.size > 0 && ` · ${onlineUsers.size} online`}
                </p>
              </div>
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
              >
              <button
                onClick={() => navigate(`/profile/${friend.friendId}`)}
                  className="flex items-center gap-3 flex-1 min-h-[44px] text-left"
                >
                    <div className="relative shrink-0">
                     <UserAvatar
                       avatarUrl={friend.avatarUrl}
                       username={friend.username}
                       displayName={friend.displayName}
                       className="h-10 w-10 text-sm"
                       onClick={friend.avatarUrl ? () => setLightboxUrl(friend.avatarUrl!) : undefined}
                     />
                     {onlineUsers.has(friend.friendId) && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-card)] bg-green-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-foreground)]">
                      {friend.displayName ?? friend.username}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      @{friend.username}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => navigate(`/friends/chat/${friend.friendId}`)}
                    className="rounded-md min-h-[44px] min-w-[44px] border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                    title="Chat"
                  >
                    💬
                  </button>
                  <button
                    onClick={async () => {
                      await removeFriend(friend.friendId);
                    }}
                    className="rounded-md min-h-[44px] border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
                  >
                    {t('friends.remove')}
                  </button>
                  <button
                    onClick={async () => {
                      await blockUser(friend.friendId);
                    }}
                    className="rounded-md min-h-[44px] border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                  >
                    {t('friends.block')}
                  </button>
                </div>
              </div>
            ))}
            </>
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
                    <UserAvatar
                      avatarUrl={req.avatarUrl}
                      username={req.username}
                      displayName={req.displayName}
                      className="h-10 w-10 text-sm"
                      onClick={req.avatarUrl ? () => setLightboxUrl(req.avatarUrl!) : undefined}
                    />
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
                    <UserAvatar
                      avatarUrl={req.avatarUrl}
                      username={req.username}
                      displayName={req.displayName}
                      className="h-10 w-10 text-sm"
                      onClick={req.avatarUrl ? () => setLightboxUrl(req.avatarUrl!) : undefined}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-foreground)]">
                        {req.displayName ?? req.username}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        @{req.username}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[var(--color-muted)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)]">
                        {t('friends.pending')}
                      </span>
                      <button
                        onClick={async () => {
                          await cancelRequest(req.id);
                        }}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
                      >
                        {t('friends.cancel')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingIncoming.length === 0 && pendingOutgoing.length === 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">No pending requests</p>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                Share your invite code or search for users to connect!
              </p>
            </div>
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
                    <UserAvatar
                      avatarUrl={user.avatarUrl}
                      username={user.username}
                      displayName={user.displayName}
                      className="h-10 w-10 text-sm"
                      onClick={user.avatarUrl ? () => setLightboxUrl(user.avatarUrl!) : undefined}
                    />
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
                )))}
            </div>
          )}
          {/* Invite link section — your code to share */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
              Your invite code
            </h3>
            <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              Share this code with friends so they can add you instantly!
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

          {/* Redeem invite code — enter someone else's code */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <h3 className="mb-2 text-sm font-medium text-[var(--color-foreground)]">
              Add by invite code
            </h3>
            <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              Paste a friend's invite code to connect with them immediately.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => {
                  setRedeemCode(e.target.value);
                  setRedeemError(null);
                  setRedeemSuccess(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRedeemInvite();
                  }
                }}
                placeholder="Paste invite code..."
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-mono text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
              />
              <button
                onClick={handleRedeemInvite}
                disabled={redeemLoading || !redeemCode.trim()}
                className="rounded-lg min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                {redeemLoading ? 'Adding...' : 'Add friend'}
              </button>
            </div>
            {redeemError && (
              <p className="mt-2 text-xs text-[var(--color-destructive)]">{redeemError}</p>
            )}
            {redeemSuccess && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">{redeemSuccess}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Blocked */}
      {activeTab === 'blocked' && !isLoading && (
        <div className="space-y-2">
          {blockedUsers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('friends.noBlocked')}
            </p>
          ) : (
            blockedUsers.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-destructive)]/10 text-sm font-bold text-[var(--color-destructive)]">
                  {(blocked.displayName ?? blocked.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    {blocked.displayName ?? blocked.username}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    @{blocked.username}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await unblockUser(blocked.userId);
                  }}
                  className="rounded-md min-h-[44px] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90"
                >
                  {t('friends.unblock')}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {lightboxUrl && (
        <AvatarLightbox
          avatarUrl={lightboxUrl}
          displayName=""
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}
