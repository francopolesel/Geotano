import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Achievement } from '@geotano/shared';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { AvatarLightbox } from '../../components/ui/AvatarLightbox';
import { AchievementBadge } from '../../components/ui/AchievementBadge';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useFriendsStore } from '../../store/friendsStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FriendshipStatus = 'self' | 'accepted' | 'outgoing' | 'incoming' | 'blocked' | 'none';

interface UserStats {
  totalScore: number;
  totalGames: number;
  bestScore: number;
  friends: number;
}

interface RecentGame {
  id: string;
  gameModeSlug: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

interface ProfileResponse {
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
  };
  stats: UserStats;
  recentGames: RecentGame[];
  achievements: Achievement[];
  friendshipStatus: FriendshipStatus;
  friendRequestId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, string> = {
  'flag-guess': 'modes.flagGuess',
  'capital-guess': 'modes.capitalGuess',
  'country-by-flag': 'modes.countryByFlag',
  continent: 'modes.continent',
  free: 'modes.free',
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const currentUser = useAuthStore((s) => s.user);
  const { sendRequest, acceptRequest, declineRequest, unblockUser } = useFriendsStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ProfileResponse>({
    queryKey: ['profile', userId],
    queryFn: () => api.get<ProfileResponse>(`/users/${userId}/profile`),
    enabled: !!userId,
    staleTime: 15_000,
  });

  if (!userId) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('profile.userIdMissing')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('common.loading')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sm text-[var(--color-destructive)]">
        {t('common.error')}
      </div>
    );
  }

  const { user, stats, recentGames, achievements, friendshipStatus, friendRequestId } = data;

  const earnedCount = achievements.filter((a) => a.earnedAt).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* User info header */}
      <div className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <UserAvatar
          avatarUrl={user.avatarUrl}
          username={user.username}
          displayName={user.displayName}
          className="h-16 w-16 text-2xl"
          onClick={user.avatarUrl ? () => setLightboxUrl(user.avatarUrl!) : undefined}
        />
        <div>
          <h1 className="text-xl font-bold text-[var(--color-foreground)]">
            {user.displayName ?? user.username}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            @{user.username}
          </p>
          {user.bio && (
            <p className="mt-2 max-w-md text-sm text-[var(--color-muted-foreground)]">
              {user.bio}
            </p>
          )}
        </div>

        {/* Friend action / badge — only shown for OTHER users' profiles */}
        {friendshipStatus !== 'self' && currentUser?.id !== user.id && (
          <div className="ml-auto shrink-0">
            {friendshipStatus === 'none' && (
              <button
                onClick={async () => {
                  setActionLoading(true);
                  setActionFeedback(null);
                  try {
                    await sendRequest(user.username);
                    setActionFeedback(t('profile.requestSent'));
                    // Optimistically update the cached profile
                    queryClient.setQueryData(['profile', userId], {
                      ...data,
                      friendshipStatus: 'outgoing' as FriendshipStatus,
                    });
                  } catch {
                    setActionFeedback(null);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
                className="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading ? t('common.loading') : t('profile.addFriend')}
              </button>
            )}

            {friendshipStatus === 'accepted' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('profile.friendshipAccepted')}
              </span>
            )}

            {friendshipStatus === 'outgoing' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {t('profile.friendshipOutgoing')}
              </span>
            )}

            {friendshipStatus === 'incoming' && friendRequestId && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await acceptRequest(friendRequestId);
                      queryClient.setQueryData(['profile', userId], {
                        ...data,
                        friendshipStatus: 'accepted' as FriendshipStatus,
                      });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
                >
                  {t('profile.acceptRequest')}
                </button>
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await declineRequest(friendRequestId);
                      queryClient.setQueryData(['profile', userId], {
                        ...data,
                        friendshipStatus: 'none' as FriendshipStatus,
                        friendRequestId: null,
                      });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50"
                >
                  {t('profile.rejectRequest')}
                </button>
              </div>
            )}

            {friendshipStatus === 'blocked' && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  {t('friends.blocked')}
                </span>
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await unblockUser(user.id);
                      queryClient.setQueryData(['profile', userId], {
                        ...data,
                        friendshipStatus: 'none' as FriendshipStatus,
                      });
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="min-h-[44px] rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50"
                >
                  {actionLoading ? t('common.loading') : t('profile.unblock')}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Friend action feedback */}
      {actionFeedback && (
        <p className="-mt-4 text-center text-xs text-emerald-600 dark:text-emerald-400">
          {actionFeedback}
        </p>
      )}

      {/* Stats grid */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.stats')}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t('profile.bestScore')} value={stats.bestScore.toLocaleString()} highlight />
          <StatCard label={t('profile.totalGames')} value={stats.totalGames.toLocaleString()} />
          <StatCard label={t('profile.friends')} value={stats.friends.toLocaleString()} />
        </div>
      </section>

      {/* Achievements */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.achievements')}
        </h2>
        {achievements.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('profile.noAchievements')}
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              {earnedCount} / {achievements.length} {t('profile.achievementsEarned')}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {achievements.map((ach) => (
                <AchievementBadge key={ach.slug} achievement={ach} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Recent games */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-foreground)]">
          {t('profile.recentGames')}
        </h2>
        {recentGames.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('profile.noGames')}
          </p>
        ) : (
          <div className="space-y-2">
            {recentGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    {t(MODE_LABELS[game.gameModeSlug] ?? game.gameModeSlug)}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {game.correctCount}/{game.totalQuestions} &middot; {formatDate(game.completedAt)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-[var(--color-primary)]">
                  {game.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {lightboxUrl && (
        <AvatarLightbox
          avatarUrl={lightboxUrl}
          displayName={user?.displayName ?? user?.username ?? ''}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${
      highlight
        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
        : 'border-[var(--color-border)] bg-[var(--color-card)]'
    }`}>
      <p className={`font-bold ${
        highlight ? 'text-2xl text-[var(--color-primary)]' : 'text-lg text-[var(--color-foreground)]'
      }`}>
        {value}
      </p>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}
