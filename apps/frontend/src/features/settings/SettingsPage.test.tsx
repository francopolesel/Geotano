import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Message helper ───────────────────────────────────────────────────────
// Helper that returns t(key) => label so tests read naturally.

const T = (key: string) => {
  const dict: Record<string, string> = {
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
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
    'settings.preferences': 'Preferences',
    'settings.theme': 'Theme',
    'settings.language': 'Language',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.english': 'English',
    'settings.spanish': 'Español',
    'settings.saved': 'Saved!',
    'settings.password': 'Password',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.validation.passwordMin': 'Password must be at least 8 characters',
    'common.save': 'Save',
    'common.loading': 'Saving...',
    'errors.common.saveFailed': 'Failed to save',
    'errors.common.passwordChangeFailed': 'Failed to change password',
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
const mockChangeLanguage = vi.hoisted(() => vi.fn());
const mockTheme = vi.hoisted(() => ({ current: 'light' }));

// ─── Mocks ────────────────────────────────────────────────────────────────

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
  api: { patch: mockPatch, post: mockPost },
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

  it('should render all sections', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('should return null when no user', () => {
    mockUserFromStore.current = null;
    const { container } = render(<SettingsPage />);
    expect(container.innerHTML).toBe('');
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
        const btn = screen.getByText('Saving...').closest('button');
        expect(btn).toBeDisabled();
      });
    });
  });

  // ── PasswordSection ──────────────────────────────────────────────────────

  describe('PasswordSection', () => {
    it('should show mismatch error when passwords differ', async () => {
      render(<SettingsPage />);
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
      render(<SettingsPage />);
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
      render(<SettingsPage />);
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
    it('should call setTheme on theme button click', () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Dark'));
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should call changeLanguage on language button click', () => {
      mockPatch.mockResolvedValueOnce({});
      render(<SettingsPage />);
      fireEvent.click(screen.getByText('Español'));
      expect(mockChangeLanguage).toHaveBeenCalledWith('es');
    });
  });
});
