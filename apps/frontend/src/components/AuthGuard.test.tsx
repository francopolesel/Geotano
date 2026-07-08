import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ─── Mock react-router-dom ────────────────────────────────────────────────

let mockIsAuthenticated = false;
let mockToken: string | null = null;

vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />),
  Outlet: vi.fn(() => <div data-testid="outlet" />),
  useLocation: vi.fn(() => ({ pathname: '/protected', search: '', hash: '', state: null, key: 'default' })),
}));

// ─── Mock authStore ───────────────────────────────────────────────────────

const mockSetAuth = vi.hoisted(() => vi.fn());

vi.mock('../store/authStore', () => {
  const storeState = {
    get isAuthenticated() { return mockIsAuthenticated; },
    get token() { return mockToken; },
    setAuth: mockSetAuth,
  };

  const useAuthStore = (selector?: (s: any) => any) => {
    if (!selector) return storeState; // getState() pattern
    return selector(storeState);
  };
  useAuthStore.getState = () => storeState;

  return { useAuthStore };
});

// ─── Mock api ─────────────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

import { AuthGuard } from './AuthGuard';
import { api } from '../lib/api';

describe('AuthGuard', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockToken = null;
    vi.clearAllMocks();
    // Default: api.get resolves with a basic user so authenticated tests don't crash
    vi.mocked(api.get).mockResolvedValue({ id: '1', username: 'default', email: 'd@t.com' });
  });

  it('should redirect to /login when not authenticated', () => {
    render(<AuthGuard />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
  });

  it('should render Outlet when authenticated', () => {
    mockIsAuthenticated = true;
    mockToken = 'test-token';

    render(<AuthGuard />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('should fetch /auth/me on mount and update store with server profile', async () => {
    mockIsAuthenticated = true;
    mockToken = 'test-token';
    const serverUser = { id: '1', username: 'testuser', email: 'test@test.com', bio: 'Server bio' };
    vi.mocked(api.get).mockResolvedValueOnce(serverUser);

    render(<AuthGuard />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });

    // setAuth should have been called with the token + server user
    expect(mockSetAuth).toHaveBeenCalledWith('test-token', serverUser);
  });

  it('should not fetch /auth/me when not authenticated', () => {
    mockIsAuthenticated = false;
    mockToken = null;

    render(<AuthGuard />);

    expect(api.get).not.toHaveBeenCalled();
  });

  it('should silently handle /auth/me failure and still render outlet', async () => {
    mockIsAuthenticated = true;
    mockToken = 'test-token';
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    render(<AuthGuard />);

    // Should still render outlet even when fetch fails
    expect(screen.getByTestId('outlet')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });

    // setAuth should NOT have been called on failure
    expect(mockSetAuth).not.toHaveBeenCalled();
  });
});
