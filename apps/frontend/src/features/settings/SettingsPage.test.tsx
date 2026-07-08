import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Message helper ───────────────────────────────────────────────────────
// Helper that returns t(key) => label so tests read naturally.

const T = (key: string) => {
  const dict: Record<string, string> = {
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.preferences': 'Preferences',
    'settings.password': 'Password',
    'settings.tabs.myProfile': 'My Profile',
    'settings.avatar': 'Avatar',
    'settings.avatarHint': 'PNG, JPEG or WebP. Max 2 MB.',
    'settings.displayName': 'Display Name',
    'settings.bio': 'Bio',
    'settings.bioPlaceholder': 'Tell us about yourself...',
    'settings.bioHint': 'Max 500 characters.',
    'settings.usernameHint': 'Letters, numbers, and underscores.',
    'settings.changePassword': 'Change Password',
    'settings.currentPassword': 'Current Password',
    'settings.newPassword': 'New Password',
    'settings.confirmPassword': 'Confirm Password',
    'settings.passwordsDontMatch': 'Passwords do not match',
    'settings.passwordChanged': 'Password changed successfully',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.english': 'English',
    'settings.spanish': 'Español',
    'settings.saved': 'Saved!',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.validation.passwordMin': 'Password must be at least 8 characters',
    'common.save': 'Save',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'errors.common.saveFailed': 'Failed to save',
    'errors.common.passwordChangeFailed': 'Failed to change password',
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
  language: 'en',
  joinCode: 'abc123',
  createdAt: '2025-01-01T00:00:00Z',
}));

const mockUserFromStore = vi.hoisted(() => ({ current: mockUserData as typeof mockUserData | null }));
const mockToken = vi.hoisted(() => ({ current: 'mock-token' }));
const mockSetAuth = vi.hoisted(() => vi.fn());
const mockSetTheme = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockChangeLanguage = vi.hoisted(() => vi.fn());
const mockTheme = vi.hoisted(() => ({ current: 'light' }));
const mockSetSearchParams = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({ current: new URLSearchParams('') }));

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams.current, mockSetSearchParams],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => T(key),
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
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

vi.mock('../../store/themeStore', () => ({
  useThemeStore: (selector?: (s: any) => any) => {
    const store = { theme: mockTheme.current, setTheme: mockSetTheme };
    return selector ? selector(store) : store;
  },
}));

vi.mock('../../lib/api', () => ({
  api: { patch: mockPatch, post: mockPost, get: mockGet },
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

import { SettingsPage } from './SettingsPage';

const getPasswordInputs = () =>
  document.querySelectorAll<HTMLInputElement>('input[type="password"]');

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme.current = 'light';
    mockUserFromStore.current = mockUserData;
  });

  // ── Page level ──────────────────────────────────────────────────────────

  it('should render title and 4 tabs', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    // "Profile" appears in both the tab button and the section heading
    expect(screen.getAllByText('Profile')).toHaveLength(2);
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('should return null when no user', () => {
    mockUserFromStore.current = null;
    const { container } = render(<SettingsPage />);
    expect(container.innerHTML).toBe('');
  });

  // ── Tab switching ────────────────────────────────────────────────────────

  it('should show Profile content by default', () => {
    render(<SettingsPage />);
    // Profile section heading is visible by default
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  });

  it('should switch to Preferences tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('should switch to Password tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('should switch to My Profile tab', async () => {
    const profileData = {
      stats: { bestScore: 2500, totalGames: 42, perfectGames: 5, bestStreak: 12 },
      achievements: [],
    };
    mockGet.mockImplementation(() => Promise.resolve(profileData));
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('My Profile'));
    await waitFor(() => {
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });
  });

  it('should read initial tab from URL search params', () => {
    mockSearchParams.current = new URLSearchParams('tab=password');
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    // Reset for other tests
    mockSearchParams.current = new URLSearchParams('');
  });

  it('should set URL params when switching tabs', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Password'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'password' }, { replace: true });
  });

  it('should clear URL params when switching to Profile tab', () => {
    mockSearchParams.current = new URLSearchParams('tab=password');
    const { unmount } = render(<SettingsPage />);
    // Click Profile tab (the default tab when no tab param)
    fireEvent.click(screen.getByText('Profile'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
    unmount();
    mockSearchParams.current = new URLSearchParams('');
  });

  // ── ProfileSection ──────────────────────────────────────────────────────

  describe('ProfileSection', () => {
    it('should pre-fill user data', () => {
      render(<SettingsPage />);
      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hello!')).toBeInTheDocument();
    });

    it('should show success after saving', async () => {
      mockPatch.mockResolvedValueOnce(mockUserData);
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument());
    });

    it('should show error message on save failure', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Network error'));
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should disable save button while loading', async () => {
      mockPatch.mockImplementationOnce(() => new Promise(() => {}));
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        const btn = screen.getByText('Loading...').closest('button');
        expect(btn).toBeDisabled();
      });
    });
  });

  // ── PasswordSection ──────────────────────────────────────────────────────

  describe('PasswordSection', () => {
    function renderWithPasswordTab() {
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Password'));
    }

    it('should show mismatch error when passwords differ', async () => {
      renderWithPasswordTab();
      const pw = getPasswordInputs();
      expect(pw.length).toBe(3);

      fireEvent.change(pw[0], { target: { value: 'current123' } });
      fireEvent.change(pw[1], { target: { value: 'newpass123' } });
      fireEvent.change(pw[2], { target: { value: 'different' } });

      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

      await waitFor(() =>
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument(),
      );
    });

    it('should show too-short error', async () => {
      renderWithPasswordTab();
      const pw = getPasswordInputs();
      fireEvent.change(pw[0], { target: { value: 'current123' } });
      fireEvent.change(pw[1], { target: { value: 'short' } });
      fireEvent.change(pw[2], { target: { value: 'short' } });

      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

      await waitFor(() =>
        expect(
          screen.getByText('Password must be at least 8 characters'),
        ).toBeInTheDocument(),
      );
    });

    it('should show success on password change', async () => {
      mockPost.mockResolvedValueOnce({});
      renderWithPasswordTab();
      const pw = getPasswordInputs();
      fireEvent.change(pw[0], { target: { value: 'current123' } });
      fireEvent.change(pw[1], { target: { value: 'newpass123' } });
      fireEvent.change(pw[2], { target: { value: 'newpass123' } });

      fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));

      await waitFor(() =>
        expect(
          screen.getByText('Password changed successfully'),
        ).toBeInTheDocument(),
      );
    });
  });

  // ── PreferencesSection ───────────────────────────────────────────────────

  describe('PreferencesSection', () => {
    function renderWithPreferencesTab() {
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Preferences'));
    }

    it('should call setTheme on theme button click', () => {
      renderWithPreferencesTab();
      fireEvent.click(screen.getByText('Dark'));
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should call changeLanguage on language button click', () => {
      mockPatch.mockResolvedValueOnce({});
      renderWithPreferencesTab();
      fireEvent.click(screen.getByText('Español'));
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });
  });

  // ── MyProfileTab ─────────────────────────────────────────────────────────

  describe('MyProfileTab', () => {
    beforeEach(() => {
      // Use mockImplementation instead of mockResolvedValueOnce to handle
      // React Strict Mode double-invocation of useEffect in dev mode
      mockGet.mockReset();
    });

    it('should show loading state', () => {
      mockGet.mockImplementation(() => new Promise(() => {})); // never resolves
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('My Profile'));
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

      render(<SettingsPage />);
      fireEvent.click(screen.getByText('My Profile'));

      await waitFor(() => {
        expect(screen.getByText('Stats')).toBeInTheDocument();
      });

      // Stats cards — use getAllByText for values that might appear elsewhere
      expect(screen.getByText('2,500')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();

      // Achievements
      expect(screen.getByText('First Game')).toBeInTheDocument();
    });

    it('should show error on fetch failure', async () => {
      mockGet.mockImplementation(() => Promise.reject(new Error('Failed to fetch')));

      render(<SettingsPage />);
      fireEvent.click(screen.getByText('My Profile'));

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

      render(<SettingsPage />);
      fireEvent.click(screen.getByText('My Profile'));

      await waitFor(() => {
        expect(
          screen.getByText('No achievements yet. Play games to earn them!'),
        ).toBeInTheDocument();
      });
    });
  });
});
