import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mocks ────────────────────────────────────────────────────────────────

let mockUser: { id: string; username: string; displayName?: string } | null = null;
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  NavLink: vi.fn(
    ({ to, children, className, onClick, end: _end, ...props }: any) => {
      const cls = typeof className === 'function' ? className({ isActive: false }) : className;
      return (
        <a href={to} className={cls} onClick={onClick} {...props}>
          {children}
        </a>
      );
    },
  ),
  Outlet: vi.fn(() => <div data-testid="outlet" />),
  useNavigate: vi.fn(() => mockNavigate),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'app.name': 'Geotano',
        'app.toggleNav': 'Toggle navigation',
        'auth.logout': 'Logout',
        'home.title': 'Home',
        'home.start': 'Start',
        'rankings.title': 'Rankings',
        'friends.title': 'Friends',
        'settings.title': 'Settings',
      };
      return keys[key] ?? key;
    },
  }),
}));

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ user: mockUser, logout: mockLogout }),
}));

// Mock child components
vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('./LanguageToggle', () => ({
  LanguageToggle: () => <div data-testid="language-toggle" />,
}));

vi.mock('./NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

// Mock image import (vite asset)
vi.mock('../assets/logo.png', () => ({
  default: 'logo-mock.png',
}));

import { AppShell } from './AppShell';
import { NavLink } from 'react-router-dom';

describe('AppShell', () => {
  beforeEach(() => {
    mockUser = null;
    mockLogout.mockClear();
    mockNavigate.mockClear();
  });

  it('should render the app name and navigation items', () => {
    render(<AppShell />);

    expect(screen.getByText('Geotano')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Rankings')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
    // "Settings" appears twice: nav item + sidebar section title
    const settingsElements = screen.getAllByText('Settings');
    expect(settingsElements).toHaveLength(2);
  });

  it('should render the Outlet for child routes', () => {
    render(<AppShell />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('should render theme toggle and language toggle', () => {
    render(<AppShell />);

    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
  });

  it('should show user display name when logged in', () => {
    mockUser = { id: '1', username: 'testuser', displayName: 'Test User' };

    render(<AppShell />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should show username as fallback when displayName is missing', () => {
    mockUser = { id: '1', username: 'testuser' };

    render(<AppShell />);

    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('should render notification bell when user is logged in', () => {
    mockUser = { id: '1', username: 'testuser' };

    render(<AppShell />);

    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('should not render notification bell when no user', () => {
    render(<AppShell />);

    expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
  });

  it('should call logout and navigate to /login on logout click', () => {
    mockUser = { id: '1', username: 'testuser' };
    render(<AppShell />);

    fireEvent.click(screen.getByText('Logout'));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should have a mobile hamburger button that toggles sidebar', () => {
    render(<AppShell />);

    const hamburger = screen.getByLabelText('Toggle navigation');
    expect(hamburger).toBeInTheDocument();

    // The sidebar starts hidden on mobile (sidebarOpen = false)
    const navLinks = screen.getAllByRole('link');
    const homeLink = navLinks.find((l) => l.textContent === 'Home');
    expect(homeLink).toBeDefined();
  });

  it('should render the logo image', () => {
    render(<AppShell />);

    const logo = screen.getByAltText('Geotano');
    expect(logo).toHaveAttribute('src', 'logo-mock.png');
  });

  it('should render logout button when user is logged in', () => {
    mockUser = { id: '1', username: 'testuser' };

    render(<AppShell />);

    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should render logout button even when not logged in', () => {
    render(<AppShell />);

    // Logout button is always rendered (no user check)
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  it('should toggle sidebar visibility when hamburger is clicked (line 44)', () => {
    render(<AppShell />);

    const hamburger = screen.getByLabelText('Toggle navigation');
    const aside = document.querySelector('aside')!;

    // Initially sidebarOpen=false → class contains 'hidden' (mobile hidden)
    expect(aside.className).toContain('hidden');

    // Click to open → sidebarOpen=true → class contains 'block'
    fireEvent.click(hamburger);
    expect(aside.className).toContain('block');
    expect(aside.className).not.toContain('hidden');

    // Click again to close → back to 'hidden'
    fireEvent.click(hamburger);
    expect(aside.className).toContain('hidden');
  });

  it('should apply active and inactive class names on NavLink (line 97)', () => {
    render(<AppShell />);

    const navLinkMock = vi.mocked(NavLink);
    // Find a call that received a className function (the nav items)
    const navCall = navLinkMock.mock.calls.find(
      (call) => typeof call[0].className === 'function',
    );
    expect(navCall).toBeDefined();
    const classNameFn = navCall![0].className as (args: { isActive: boolean }) => string;

    const activeClass = classNameFn({ isActive: true });
    expect(activeClass).toContain('bg-[var(--color-primary)]');
    expect(activeClass).toContain('text-[var(--color-primary-foreground)]');

    const inactiveClass = classNameFn({ isActive: false });
    expect(inactiveClass).toContain('text-[var(--color-foreground)]');
    expect(inactiveClass).not.toContain('bg-[var(--color-primary)]');
  });
});
