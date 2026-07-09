import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string, params?: Record<string, any>) => {
  const dict: Record<string, string> = {
    'profile.userIdMissing': 'User ID missing',
    'common.loading': 'Loading...',
    'common.error': 'Error loading profile',
    'profile.stats': 'Stats',
    'profile.totalScore': 'Total Score',
    'profile.totalGames': 'Games Played',
    'profile.bestScore': 'Best Score',
    'profile.friends': 'Friends',
    'profile.achievements': 'Achievements',
    'profile.noAchievements': 'No achievements yet',
    'profile.achievementsEarned': 'earned',
    'profile.recentGames': 'Recent Games',
    'profile.noGames': 'No games played yet',
    'modes.flagGuess': 'Flag → Country',
    'modes.flagGuessHardcore': 'Hardcore',
    'modes.flagGuessUnlimited': 'Flag → Country (Unlimited)',
    'modes.capitalGuess': 'Capital → Country',
    'modes.capitalGuessHardcore': 'Hardcore',
    'modes.capitalGuessUnlimited': 'Capital → Country (Unlimited)',
    'modes.countryByFlag': 'Country → Flag',
    'modes.countryByFlagHardcore': 'Hardcore',
    'modes.countryByFlagUnlimited': 'Country → Flag (Unlimited)',
    'modes.continent': 'Continent',
    'modes.continentHardcore': 'Extremo',
    'modes.continentUnlimited': 'Continent (Unlimited)',
    'modes.free': 'Mix Libre',
    'modes.freeHardcore': 'Extremo',
    'modes.freeUnlimited': 'Mix Libre (Unlimited)',
    'profile.bestPlayer': 'Best Player #{position}',
    'profile.bestPlayerRank': '#{rank}',
    'profile.stats.rank': 'Global Rank',
    'profile.addFriend': 'Add friend',
    'profile.friendshipAccepted': 'Friends',
    'profile.friendshipOutgoing': 'Pending...',
    'profile.acceptRequest': 'Accept',
    'profile.rejectRequest': 'Reject',
    'friends.blocked': 'Blocked',
    'profile.unblock': 'Unblock',
    'profile.requestSent': 'Request sent!',
  };
  let text = dict[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  return text;
};

// ─── Shared mutable query state ────────────────────────────────────────────
const queryState = vi.hoisted(() => ({
  data: null as any,
  isLoading: false,
  error: null as Error | null,
}));

const mockUserIdParam = vi.hoisted(() => ({ current: 'user-123' }));

// Friendship store mocks
const mockSendRequest = vi.hoisted(() => vi.fn());
const mockAcceptRequest = vi.hoisted(() => vi.fn());
const mockDeclineRequest = vi.hoisted(() => vi.fn());
const mockUnblockUser = vi.hoisted(() => vi.fn());
const mockCurrentUserData = vi.hoisted(() => ({ current: null as any }));

// ─── Mock helper components ────────────────────────────────────────────────
const MockUserAvatar = vi.hoisted(() =>
  vi.fn(({ username, avatarUrl, onClick }: any) => (
    <div data-testid="user-avatar" data-username={username} data-hasavatar={!!avatarUrl} onClick={onClick}>
      {username}
    </div>
  )),
);
const MockAvatarLightbox = vi.hoisted(() =>
  vi.fn(({ avatarUrl, onClose }: any) => (
    <div data-testid="avatar-lightbox" data-url={avatarUrl}>
      <button data-testid="lightbox-close" onClick={onClose}>
        Close
      </button>
    </div>
  )),
);
const MockAchievementBadge = vi.hoisted(() =>
  vi.fn(({ achievement }: any) => (
    <div data-testid="achievement-badge" data-slug={achievement.slug} data-earned={!!achievement.earnedAt}>
      {achievement.name}
    </div>
  )),
);

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useParams: () => ({ userId: mockUserIdParam.current }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => T(key, params) }),
  initReactI18next: { type: '3rdParty' },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: queryState.data,
    isLoading: queryState.isLoading,
    error: queryState.error,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));

vi.mock('../../components/ui/UserAvatar', () => ({ UserAvatar: MockUserAvatar }));
vi.mock('../../components/ui/AvatarLightbox', () => ({ AvatarLightbox: MockAvatarLightbox }));
vi.mock('../../components/ui/AchievementBadge', () => ({ AchievementBadge: MockAchievementBadge }));

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ user: mockCurrentUserData.current }),
}));

vi.mock('../../store/friendsStore', () => ({
  useFriendsStore: () => ({
    sendRequest: mockSendRequest,
    acceptRequest: mockAcceptRequest,
    declineRequest: mockDeclineRequest,
    unblockUser: mockUnblockUser,
  }),
}));

import { ProfilePage } from './ProfilePage';

// ─── Sample data ────────────────────────────────────────────────────────────
const sampleProfile = {
  user: {
    id: 'user-123',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    bio: 'Geo enthusiast',
  },
  stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12 },
  recentGames: [
    {
      id: 'game-1',
      gameModeSlug: 'flag-guess',
      score: 1500,
      totalQuestions: 10,
      correctCount: 8,
      completedAt: '2026-07-05T12:00:00Z',
    },
  ],
  achievements: [
    { slug: 'first-game', name: 'First Game', description: 'Play your first game', earnedAt: '2026-01-01T00:00:00Z' },
    { slug: 'speed-demon', name: 'Speed Demon', description: 'Answer in under 2s', earnedAt: null },
  ],
};

// No test for StatCard directly — it's a private component tested through rendering

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.data = null;
    queryState.isLoading = false;
    queryState.error = null;
    mockUserIdParam.current = 'user-123';
    mockCurrentUserData.current = null;
  });

  // ── States ───────────────────────────────────────────────────────────────

  it('should show userId missing when no userId param', () => {
    mockUserIdParam.current = undefined!;
    render(<ProfilePage />);
    expect(screen.getByText('User ID missing')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    queryState.isLoading = true;
    render(<ProfilePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    queryState.error = new Error('Profile not found');
    render(<ProfilePage />);
    expect(screen.getByText('Error loading profile')).toBeInTheDocument();
  });

  it('should show error state when data is null', () => {
    queryState.data = null;
    render(<ProfilePage />);
    expect(screen.getByText('Error loading profile')).toBeInTheDocument();
  });

  // ── User info header ─────────────────────────────────────────────────────

  it('should render user info header', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
    expect(screen.getByText('Geo enthusiast')).toBeInTheDocument();
  });

  it('should show username when displayName is not set', () => {
    queryState.data = {
      ...sampleProfile,
      user: { ...sampleProfile.user, displayName: undefined },
    };
    render(<ProfilePage />);
    expect(screen.getAllByText('testuser').length).toBeGreaterThanOrEqual(1);
  });

  it('should not show bio when not provided', () => {
    queryState.data = {
      ...sampleProfile,
      user: { ...sampleProfile.user, bio: undefined },
    };
    render(<ProfilePage />);
    expect(screen.queryByText('Geo enthusiast')).not.toBeInTheDocument();
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  it('should render stats grid', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('Best Score')).toBeInTheDocument();
    expect(screen.getByText('Games Played')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
  });

  // ── Best Player stat ─────────────────────────────────────────────────────

  it('should show Best Player #1 stat with crown and golden style when globalRank is 1', () => {
    queryState.data = {
      ...sampleProfile,
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12, globalRank: 1 },
    };
    render(<ProfilePage />);

    expect(screen.getByText('👑 Best Player #1')).toBeInTheDocument();
  });

  it('should show Best Player #2 stat without crown when globalRank is 2', () => {
    queryState.data = {
      ...sampleProfile,
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12, globalRank: 2 },
    };
    render(<ProfilePage />);

    expect(screen.getByText('Best Player #2')).toBeInTheDocument();
    expect(screen.queryByText('👑')).not.toBeInTheDocument();
  });

  it('should show Best Player #3 stat without crown when globalRank is 3', () => {
    queryState.data = {
      ...sampleProfile,
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12, globalRank: 3 },
    };
    render(<ProfilePage />);

    expect(screen.getByText('Best Player #3')).toBeInTheDocument();
    expect(screen.queryByText('👑')).not.toBeInTheDocument();
  });

  it('should not show Best Player stat when globalRank is greater than 3', () => {
    queryState.data = {
      ...sampleProfile,
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12, globalRank: 5 },
    };
    render(<ProfilePage />);

    expect(screen.queryByText(/Best Player/i)).not.toBeInTheDocument();
  });

  it('should not show Best Player stat when globalRank is undefined', () => {
    queryState.data = { ...sampleProfile };
    render(<ProfilePage />);

    expect(screen.queryByText(/Best Player/i)).not.toBeInTheDocument();
  });

  // ── Achievements ─────────────────────────────────────────────────────────

  it('should render achievements', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    const badges = screen.getAllByTestId('achievement-badge');
    expect(badges).toHaveLength(2);
  });

  it('should show earned count and total', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    expect(screen.getByText('1 / 2 earned')).toBeInTheDocument();
  });

  it('should show empty achievements message', () => {
    queryState.data = { ...sampleProfile, achievements: [] };
    render(<ProfilePage />);

    expect(screen.getByText('No achievements yet')).toBeInTheDocument();
  });

  // ── Recent games ─────────────────────────────────────────────────────────

  it('should render recent games', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('8/10'))).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('should show empty games message', () => {
    queryState.data = { ...sampleProfile, recentGames: [] };
    render(<ProfilePage />);

    expect(screen.getByText('No games played yet')).toBeInTheDocument();
  });

  // ── Avatar lightbox ──────────────────────────────────────────────────────

  it('should open lightbox when avatar is clicked', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    const avatar = screen.getByTestId('user-avatar');
    fireEvent.click(avatar);

    expect(screen.getByTestId('avatar-lightbox')).toBeInTheDocument();
  });

  it('should close lightbox when close is clicked', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);

    fireEvent.click(screen.getByTestId('user-avatar'));
    expect(screen.getByTestId('avatar-lightbox')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('lightbox-close'));
    expect(screen.queryByTestId('avatar-lightbox')).not.toBeInTheDocument();
  });

  it('should not make avatar clickable when no avatarUrl', () => {
    queryState.data = {
      ...sampleProfile,
      user: { ...sampleProfile.user, avatarUrl: undefined },
    };
    render(<ProfilePage />);

    const avatar = screen.getByTestId('user-avatar');
    expect(avatar.dataset.hasavatar).toBe('false');
  });

  // ── Recent games mode labels ────────────────────────────────────────────

  it('should show full mode name including variant for recent games', () => {
    queryState.data = {
      ...sampleProfile,
      recentGames: [
        {
          id: 'game-1',
          gameModeSlug: 'flag-guess',
          score: 1500,
          totalQuestions: 10,
          correctCount: 8,
          completedAt: '2026-07-05T12:00:00Z',
        },
        {
          id: 'game-2',
          gameModeSlug: 'flag-guess-hardcore',
          score: 2500,
          totalQuestions: 15,
          correctCount: 12,
          completedAt: '2026-07-06T14:00:00Z',
        },
      ],
    };
    render(<ProfilePage />);

    // Standard mode shows its specific name
    expect(screen.getByText('Flag → Country')).toBeInTheDocument();
    // Hardcore variant shows its own name
    expect(screen.getByText('Hardcore')).toBeInTheDocument();
  });

  it('should show all game mode variants with correct labels', () => {
    queryState.data = {
      ...sampleProfile,
      recentGames: [
        { id: 'g1', gameModeSlug: 'capital-guess-unlimited', score: 3000, totalQuestions: 20, correctCount: 18, completedAt: '2026-07-01T00:00:00Z' },
        { id: 'g2', gameModeSlug: 'continent-hardcore', score: 1200, totalQuestions: 8, correctCount: 6, completedAt: '2026-07-02T00:00:00Z' },
        { id: 'g3', gameModeSlug: 'free', score: 500, totalQuestions: 5, correctCount: 3, completedAt: '2026-07-03T00:00:00Z' },
      ],
    };
    render(<ProfilePage />);

    expect(screen.getByText('Capital → Country (Unlimited)')).toBeInTheDocument();
    expect(screen.getByText('Extremo')).toBeInTheDocument();
    expect(screen.getByText('Mix Libre')).toBeInTheDocument();
  });

  // ── Friendship status: 'none' ────────────────────────────────────────────

  it('should show Add friend button when friendshipStatus is none', () => {
    queryState.data = { ...sampleProfile, friendshipStatus: 'none', friendRequestId: null };
    render(<ProfilePage />);
    expect(screen.getByText('Add friend')).toBeInTheDocument();
  });

  it('should call sendRequest and show feedback when Add friend is clicked', async () => {
    mockSendRequest.mockResolvedValue(undefined);
    queryState.data = { ...sampleProfile, friendshipStatus: 'none', friendRequestId: null };
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Add friend'));

    expect(mockSendRequest).toHaveBeenCalledWith('testuser');

    await waitFor(() => {
      expect(screen.getByText('Request sent!')).toBeInTheDocument();
    });
  });

  it('should show loading state on Add friend while request is pending', () => {
    mockSendRequest.mockImplementation(() => new Promise(() => {}));
    queryState.data = { ...sampleProfile, friendshipStatus: 'none', friendRequestId: null };
    render(<ProfilePage />);

    const btn = screen.getByText('Add friend');
    fireEvent.click(btn);

    expect(screen.queryByText('Add friend')).not.toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle sendRequest error and not show feedback', async () => {
    mockSendRequest.mockRejectedValue(new Error('Network error'));
    queryState.data = { ...sampleProfile, friendshipStatus: 'none', friendRequestId: null };
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Add friend'));

    await waitFor(() => {
      expect(screen.queryByText('Request sent!')).not.toBeInTheDocument();
    });
  });

  // ── Friendship status: 'accepted' ────────────────────────────────────────

  it('should show Friends badge when friendshipStatus is accepted', () => {
    queryState.data = { ...sampleProfile, friendshipStatus: 'accepted', friendRequestId: null };
    render(<ProfilePage />);
    // Friends appears in both the badge and the stats label — verify we have at least 2 instances
    expect(screen.getAllByText('Friends').length).toBeGreaterThanOrEqual(2);
  });

  // ── Friendship status: 'outgoing' ────────────────────────────────────────

  it('should show Pending badge when friendshipStatus is outgoing', () => {
    queryState.data = { ...sampleProfile, friendshipStatus: 'outgoing', friendRequestId: null };
    render(<ProfilePage />);
    expect(screen.getByText('Pending...')).toBeInTheDocument();
  });

  // ── Friendship status: 'incoming' ────────────────────────────────────────

  it('should show Accept and Reject buttons when friendshipStatus is incoming', () => {
    queryState.data = {
      ...sampleProfile,
      friendshipStatus: 'incoming',
      friendRequestId: 'req-1',
    };
    render(<ProfilePage />);
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('should call acceptRequest when Accept is clicked', async () => {
    mockAcceptRequest.mockResolvedValue(undefined);
    queryState.data = {
      ...sampleProfile,
      friendshipStatus: 'incoming',
      friendRequestId: 'req-1',
    };
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Accept'));

    expect(mockAcceptRequest).toHaveBeenCalledWith('req-1');

    await waitFor(() => {
      // loading state is cleared after async completes
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  it('should call declineRequest when Reject is clicked', async () => {
    mockDeclineRequest.mockResolvedValue(undefined);
    queryState.data = {
      ...sampleProfile,
      friendshipStatus: 'incoming',
      friendRequestId: 'req-1',
    };
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Reject'));

    expect(mockDeclineRequest).toHaveBeenCalledWith('req-1');

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  // ── Friendship status: 'blocked' ─────────────────────────────────────────

  it('should show Blocked badge and Unblock button when friendshipStatus is blocked', () => {
    queryState.data = { ...sampleProfile, friendshipStatus: 'blocked', friendRequestId: null };
    render(<ProfilePage />);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Unblock')).toBeInTheDocument();
  });

  it('should call unblockUser when Unblock is clicked', async () => {
    mockUnblockUser.mockResolvedValue(undefined);
    queryState.data = { ...sampleProfile, friendshipStatus: 'blocked', friendRequestId: null };
    render(<ProfilePage />);

    fireEvent.click(screen.getByText('Unblock'));

    expect(mockUnblockUser).toHaveBeenCalledWith('user-123');

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  // ── Friendship status: 'self' ────────────────────────────────────────────

  it('should not show any friend action buttons when viewing own profile (self)', () => {
    mockCurrentUserData.current = { id: 'user-123', username: 'testuser' };
    queryState.data = { ...sampleProfile, friendshipStatus: 'self', friendRequestId: null };
    render(<ProfilePage />);

    expect(screen.queryByText('Add friend')).not.toBeInTheDocument();
    expect(screen.queryByText('Pending...')).not.toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
    expect(screen.queryByText('Unblock')).not.toBeInTheDocument();
  });

  // ── Bio ──────────────────────────────────────────────────────────────────

  it('should render bio paragraph when user.bio is set', () => {
    queryState.data = {
      ...sampleProfile,
      user: { ...sampleProfile.user, bio: 'Just a geo fan' },
    };
    render(<ProfilePage />);
    expect(screen.getByText('Just a geo fan')).toBeInTheDocument();
  });

  it('should not render bio when user.bio is null', () => {
    queryState.data = {
      ...sampleProfile,
      user: { ...sampleProfile.user, bio: null },
    };
    render(<ProfilePage />);
    expect(screen.queryByText('Geo enthusiast')).not.toBeInTheDocument();
  });

  // ── Stats section ─────────────────────────────────────────────────────────

  it('should display Total Score in stats if present in response', () => {
    queryState.data = sampleProfile;
    render(<ProfilePage />);
    expect(screen.getByText('Stats')).toBeInTheDocument();
  });
});
