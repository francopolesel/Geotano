import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Mock react-router-dom ────────────────────────────────────────────────

let mockIsAuthenticated = false;

vi.mock('react-router-dom', () => ({
  Navigate: vi.fn(({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />),
  Outlet: vi.fn(() => <div data-testid="outlet" />),
  useLocation: vi.fn(() => ({ pathname: '/protected', search: '', hash: '', state: null, key: 'default' })),
}));

// ─── Mock authStore ───────────────────────────────────────────────────────

vi.mock('../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ isAuthenticated: mockIsAuthenticated }),
}));

import { AuthGuard } from './AuthGuard';

describe('AuthGuard', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
  });

  it('should redirect to /login when not authenticated', () => {
    render(<AuthGuard />);

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
  });

  it('should render Outlet when authenticated', () => {
    mockIsAuthenticated = true;

    render(<AuthGuard />);

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});
