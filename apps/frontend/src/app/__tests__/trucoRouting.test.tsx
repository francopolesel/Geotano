import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// AuthGuard profile refresh + HomePage stats fetch
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

// App registers the router navigate fn in socket.ts — no real socket wanted here
vi.mock('../../lib/socket', () => ({ setNavigateFn: vi.fn() }));

// Trim heavy shell children unrelated to routing
vi.mock('../../components/NotificationBell', () => ({
  NotificationBell: () => null,
}));
vi.mock('../../features/multiplayer/ChallengeNotification', () => ({
  ChallengeNotification: () => null,
}));

// Truco feature pages are stubbed — the subject is ROUTING, not page content.
// Each stub carries a unique testid so tests assert which screen mounted.
vi.mock('../../features/truco/TrucoMenuPage', () => ({
  TrucoMenuPage: () => <div data-testid="truco-menu-page" />,
}));
vi.mock('../../features/truco/TruCpuPage', () => ({
  TruCpuPage: () => <div data-testid="truco-cpu-page" />,
}));
vi.mock('../../features/truco/TrucoMatchPage', () => ({
  TrucoMatchPage: () => <div data-testid="truco-match-page" />,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Boots the app at a given URL like a real page load. createBrowserRouter
 * captures window.location when the App module first evaluates, so the module
 * graph is reset per test and dynamically imported AFTER the URL is set —
 * this exercises genuine deep-link entry into each route.
 */
async function bootAppAt(url: string) {
  window.history.pushState({}, '', url);
  const [{ App }, { useAuthStore }, { default: i18n }, { I18nextProvider }] =
    await Promise.all([
      import('../App'),
      import('../../store/authStore'),
      import('../../i18n/i18n'),
      import('react-i18next'),
    ]);

  // Authenticated user so AuthGuard lets the shell tree mount
  useAuthStore.setState({
    token: 'test-token',
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', username: 'testuser', email: 'test@test.com' } as any,
  });

  render(
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>,
  );
}

describe('truco routing (additive shell routes)', () => {
  beforeEach(() => {
    vi.resetModules();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
  });

  it('exposes a Truco nav entry and /truco renders the menu page inside AppShell', async () => {
    await bootAppAt('/');

    // Nav entry added to AppShell navItems (label via i18n key truco.title)
    const navLink = screen.getByRole('link', { name: 'Truco' });
    expect(navLink).toBeDefined();

    fireEvent.click(navLink);

    // Menu page mounted…
    expect(screen.getByTestId('truco-menu-page')).toBeDefined();
    // …inside the shell (header logo proves AppShell chrome is wrapping it)
    expect(screen.getByAltText('Geotano')).toBeDefined();
  });

  it('deep-link /truco/cpu renders inside AppShell', async () => {
    await bootAppAt('/truco/cpu');

    expect(screen.getByTestId('truco-cpu-page')).toBeDefined();
    expect(screen.getByAltText('Geotano')).toBeDefined();
  });

  it('deep-link /truco/match/:matchId renders inside AppShell', async () => {
    await bootAppAt('/truco/match/m-123');

    expect(screen.getByTestId('truco-match-page')).toBeDefined();
    expect(screen.getByAltText('Geotano')).toBeDefined();
  });

  it('leaves existing routes untouched (unknown paths still redirect home)', async () => {
    await bootAppAt('/definitely-not-a-real-path');

    // Catch-all redirect still lands on HomePage (subtitle is language-stable
    // under the default en locale used by these tests)
    expect(screen.getByText('Test your geography knowledge')).toBeDefined();
  });
});
