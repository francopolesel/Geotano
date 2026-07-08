import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Translation dictionary ────────────────────────────────────────────────

const T = (key: string) => {
  const dict: Record<string, string> = {
    'nav.myProfile': 'My Profile',
    'settings.profile': 'Edit Profile',
    'settings.avatar': 'Profile Picture',
    'settings.avatarHint': 'PNG, JPEG or WebP. Max 2 MB.',
    'settings.displayName': 'Display Name',
    'settings.bio': 'Bio',
    'settings.bioPlaceholder': 'Tell us about yourself...',
    'settings.bioHint': 'Max 500 characters.',
    'settings.usernameHint': 'Letters, numbers, and underscores.',
    'settings.saved': 'Saved!',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'common.save': 'Save',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'errors.common.saveFailed': 'Failed to save',
    'profile.stats': 'Stats',
    'profile.bestScore': 'Best Score',
    'profile.totalGames': 'Games Played',
    'profile.stats.perfectGames': 'Perfect Games',
    'profile.stats.streak': 'Best Streak',
    'profile.achievements': 'Achievements',
    'profile.noAchievements': 'No achievements yet. Play games to earn them!',
    'profile.achievementsEarned': 'earned',
  };
  return dict[key] ?? key;
};

// ─── Shared mutable refs ──────────────────────────────────────────────────

const mockUserData = vi.hoisted(() => ({
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  bio: 'Hello!',
}));

const mockUserFromStore = vi.hoisted(() => ({ current: mockUserData as typeof mockUserData | null }));
const mockToken = vi.hoisted(() => ({ current: 'mock-token' }));
const mockSetAuth = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => T(key),
  }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const store = {
      user: mockUserFromStore.current,
      token: mockToken.current,
      setAuth: mockSetAuth,
    };
    return selector ? selector(store) : store;
  },
}));

vi.mock('../../lib/api', () => ({
  api: { patch: mockPatch, get: mockGet },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../../lib/image', () => ({
  resizeImage: vi.fn(() => Promise.resolve('data:image/jpeg;base64,mocked')),
}));

vi.mock('../../components/ui/AchievementBadge', () => ({
  AchievementBadge: ({ achievement }: any) => (
    <div data-testid="achievement-badge">{achievement.nameEn ?? achievement.slug}</div>
  ),
}));

import { MyProfilePage } from './MyProfilePage';

describe('MyProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFromStore.current = mockUserData;
    mockGet.mockResolvedValue({ stats: { bestScore: 0, totalGames: 0, perfectGames: 0, bestStreak: 0 }, achievements: [] });
  });

  // ── Page level ──────────────────────────────────────────────────────────

  it('should render title', () => {
    render(<MyProfilePage />);
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('should return null when no user', () => {
    mockUserFromStore.current = null;
    const { container } = render(<MyProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  // ── EditProfileSection ──────────────────────────────────────────────────

  describe('EditProfileSection', () => {
    it('should pre-fill user data', () => {
      render(<MyProfilePage />);
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hello!')).toBeInTheDocument();
    });

    it('should show success after saving', async () => {
      mockPatch.mockResolvedValueOnce(mockUserData);
      render(<MyProfilePage />);
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument());
    });

    it('should call setAuth after saving', async () => {
      mockPatch.mockResolvedValueOnce(mockUserData);
      render(<MyProfilePage />);
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith('mock-token', mockUserData);
      });
    });

    it('should show error message on save failure', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Network error'));
      render(<MyProfilePage />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  // ── StatsAndAchievements ────────────────────────────────────────────────

  describe('StatsAndAchievements', () => {
    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {}));
      render(<MyProfilePage />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render stats and achievements', async () => {
      const profileData = {
        stats: { bestScore: 2500, totalGames: 42, perfectGames: 5, bestStreak: 12 },
        achievements: [
          {
            slug: 'first_game',
            nameEn: 'First Game',
            nameEs: 'Primer Juego',
            icon: '🎮',
            tier: 1,
            earnedAt: '2025-01-02T00:00:00Z',
          },
        ],
      };
      mockGet.mockImplementation(() => Promise.resolve(profileData));

      render(<MyProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Stats')).toBeInTheDocument();
      });

      // Stats cards
      expect(screen.getByText('2,500')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();

      // Achievements
      expect(screen.getByText('First Game')).toBeInTheDocument();
    });

    it('should show error on fetch failure', async () => {
      mockGet.mockImplementation(() => Promise.reject(new Error('Failed to fetch')));

      render(<MyProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
      });
    });

    it('should show empty achievements state', async () => {
      const emptyData = {
        stats: { bestScore: 0, totalGames: 0, perfectGames: 0, bestStreak: 0 },
        achievements: [],
      };
      mockGet.mockImplementation(() => Promise.resolve(emptyData));

      render(<MyProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByText('No achievements yet. Play games to earn them!'),
        ).toBeInTheDocument();
      });
    });
  });
});