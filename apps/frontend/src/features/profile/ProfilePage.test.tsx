import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string) => {
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
    'modes.flagGuess': 'Flag Guess',
    'modes.capitalGuess': 'Capital Guess',
    'modes.countryByFlag': 'Country by Flag',
    'modes.continent': 'Continent',
  };
  return dict[key] ?? key;
};

// ─── Shared mutable query state ────────────────────────────────────────────
const queryState = vi.hoisted(() => ({
  data: null as any,
  isLoading: false,
  error: null as Error | null,
}));

const mockUserIdParam = vi.hoisted(() => ({ current: 'user-123' }));

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
  useTranslation: () => ({ t: (key: string) => T(key) }),
  initReactI18next: { type: '3rdParty' },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: queryState.data,
    isLoading: queryState.isLoading,
    error: queryState.error,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../../components/ui/UserAvatar', () => ({ UserAvatar: MockUserAvatar }));
vi.mock('../../components/ui/AvatarLightbox', () => ({ AvatarLightbox: MockAvatarLightbox }));
vi.mock('../../components/ui/AchievementBadge', () => ({ AchievementBadge: MockAchievementBadge }));

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
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

    expect(screen.getByText('Flag Guess')).toBeInTheDocument();
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
});
