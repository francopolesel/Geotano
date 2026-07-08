import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Message helper ───────────────────────────────────────────────────────

const T = (key: string) => {
  const dict: Record<string, string> = {
    'settings.title': 'Settings',
    'settings.preferences': 'Preferences',
    'settings.password': 'Password',
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
    'auth.validation.passwordMin': 'Password must be at least 8 characters',
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
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
const mockSetTheme = vi.hoisted(() => vi.fn());
const mockPatch = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
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
      token: 'mock-token',
      setAuth: vi.fn(),
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
}));

import { SettingsPage } from './SettingsPage';

const getPasswordInputs = () =>
  document.querySelectorAll<HTMLInputElement>('input[type="password"]');

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme.current = 'light';
    mockUserFromStore.current = mockUserData;
    mockSearchParams.current = new URLSearchParams('');
  });

  // ── Page level ──────────────────────────────────────────────────────────

  it('should render title and 2 tabs', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    // "Preferences" appears in both the tab button and the section heading
    expect(screen.getAllByText('Preferences')).toHaveLength(2);
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('should return null when no user', () => {
    mockUserFromStore.current = null;
    const { container } = render(<SettingsPage />);
    expect(container.innerHTML).toBe('');
  });

  // ── Tab switching ────────────────────────────────────────────────────────

  it('should show Preferences content by default', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('should switch to Password tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
  });

  it('should read initial tab from URL search params', () => {
    mockSearchParams.current = new URLSearchParams('tab=password');
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Change Password' })).toBeInTheDocument();
    mockSearchParams.current = new URLSearchParams('');
  });

  it('should set URL params when switching to password tab', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Password'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'password' }, { replace: true });
  });

  it('should clear URL params when switching to Preferences tab', () => {
    mockSearchParams.current = new URLSearchParams('tab=password');
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Preferences'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
    mockSearchParams.current = new URLSearchParams('');
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
});