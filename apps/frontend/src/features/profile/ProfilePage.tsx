import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Achievement } from '@geotano/shared';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { AvatarLightbox } from '../../components/ui/AvatarLightbox';
import { AchievementBadge } from '../../components/ui/AchievementBadge';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';
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
  globalRank?: number;
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
    isVerified?: boolean;
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
  'flag-guess-hardcore': 'modes.flagGuessHardcore',
  'flag-guess-unlimited': 'modes.flagGuessUnlimited',
  'capital-guess': 'modes.capitalGuess',
  'capital-guess-hardcore': 'modes.capitalGuessHardcore',
  'capital-guess-unlimited': 'modes.capitalGuessUnlimited',
  'country-by-flag': 'modes.countryByFlag',
  'country-by-flag-hardcore': 'modes.countryByFlagHardcore',
  'country-by-flag-unlimited': 'modes.countryByFlagUnlimited',
  continent: 'modes.continent',
  'continent-hardcore': 'modes.continentHardcore',
  'continent-unlimited': 'modes.continentUnlimited',
  free: 'modes.free',
  'free-hardcore': 'modes.freeHardcore',
  'free-unlimited': 'modes.freeUnlimited',
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
      <div className="mx-auto max-w-2xl py-12 text-center">
        <img src="/error_image.png" alt="" className="mx-auto mb-4 h-20 w-20 rounded-xl" />
        <p className="text-sm text-[var(--color-destructive)]">{t('common.error')}</p>
      </div>
    );
  }

  const { user, stats, recentGames, achievements, friendshipStatus, friendRequestId } = data;

  const earnedCount = achievements.filter((a) => a.earnedAt).length;

  const isOtherProfile = friendshipStatus !== 'self' && currentUser?.id !== user.id;

  // Renders the friend action for the given friendship status. Shared between
  // the desktop (inline, right-aligned) and mobile (own full-width row) wrappers.
  const renderFriendAction = () => {
    if (friendshipStatus === 'none') {
      return (
        <button
          onClick={async () => {
            setActionLoading(true);
            setActionFeedback(null);
            try {
              await sendRequest(user.username);
              setActionFeedback(t('profile.requestSent'));
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
          className="min-h-[44px] w-full sm:w-auto rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {actionLoading ? t('common.loading') : t('profile.addFriend')}
        </button>
      );
    }

    if (friendshipStatus === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {t('profile.friendshipAccepted')}
        </span>
      );
    }

    if (friendshipStatus === 'outgoing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {t('profile.friendshipOutgoing')}
        </span>
      );
    }

    if (friendshipStatus === 'incoming' && friendRequestId) {
      return (
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
            className="min-h-[44px] flex-1 sm:flex-none rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
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
            className="min-h-[44px] flex-1 sm:flex-none rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {t('profile.rejectRequest')}
          </button>
        </div>
      );
    }

    if (friendshipStatus === 'blocked') {
      return (
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
      );
    }

    return null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* User info header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        {/* Grid: [avatar | name/bio+solid action] on desktop →
            [avatar | name/bio] over [full-width action] on mobile */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-4 sm:grid-cols-[auto_1fr_auto]">
          <UserAvatar
            avatarUrl={user.avatarUrl}
            username={user.username}
            displayName={user.displayName}
            className="h-16 w-16 shrink-0 text-2xl"
            onClick={user.avatarUrl ? () => setLightboxUrl(user.avatarUrl!) : undefined}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-foreground)]">
              {user.displayName ?? user.username}
              {user.isVerified && <VerifiedBadge className="ml-1" />}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              @{user.username}
            </p>
            {user.bio && (
              <p className="mt-2 max-w-md break-words text-sm text-[var(--color-muted-foreground)]">
                {user.bio}
              </p>
            )}
          </div>

          {/* Friend action — inline right on desktop, own full-width row on mobile */}
          {isOtherProfile && (
            <div className="col-span-2 flex justify-center border-t border-[var(--color-border)] pt-4 sm:col-span-1 sm:justify-end sm:border-0 sm:pt-0">
              {renderFriendAction()}
            </div>
          )}
        </div>
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

          {/* Best Player rank — only for global top 3 */}
          {stats.globalRank !== undefined && stats.globalRank <= 3 && (
            <div className={`mb-3 rounded-lg border-2 px-4 py-3 text-center ${
              stats.globalRank === 1
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : stats.globalRank === 2
                  ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900/20'
                  : 'border-amber-700/50 bg-amber-50/50 dark:border-amber-600/50 dark:bg-amber-950/20'
            }`}>
              <p className={`font-bold text-xl ${
                stats.globalRank === 1
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : stats.globalRank === 2
                    ? 'text-gray-400 dark:text-gray-300'
                    : 'text-amber-700 dark:text-amber-500'
              }`}>
                {stats.globalRank === 1 ? '👑 ' : ''}{t('profile.bestPlayer', { position: stats.globalRank })}
              </p>
            </div>
          )}

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
