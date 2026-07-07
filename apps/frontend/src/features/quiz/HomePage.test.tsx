import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string, params?: Record<string, any>) => {
  const dict: Record<string, string> = {
    'home.greeting': 'Hi, {username}',
    'home.subtitle': 'Challenge yourself with geography quizzes',
    'home.title': 'Choose a Mode',
    'home.start': 'Start',
    'home.stats': 'Your Stats',
    'modes.flagGuess': 'Flag Guess',
    'modes.flagGuessDesc': 'Guess the flag',
    'modes.capitalGuess': 'Capital Guess',
    'modes.capitalGuessDesc': 'Guess the capital',
    'modes.countryByFlag': 'Country by Flag',
    'modes.countryByFlagDesc': 'Name the country',
    'modes.continent': 'Continent',
    'modes.continentDesc': 'Find the continent',
    'modes.free': 'Free Mode',
    'modes.freeDesc': 'Play freely',
    'profile.totalScore': 'Total Score',
    'profile.totalGames': 'Games',
    'profile.bestScore': 'Best Score',
    'profile.friends': 'Friends',
    'common.loading': 'Loading...',
    'home.noGamesYet': 'Play your first game to see stats!',
  };
  let text = dict[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  return text;
};

// ─── Shared mutable refs ───────────────────────────────────────────────────
const mockNavigate = vi.hoisted(() => vi.fn());
const mockUser = vi.hoisted(() => ({ current: { id: 'user-1', username: 'testuser', displayName: 'Test User' } as { id: string; username: string; displayName?: string } | null }));
const mockApiGet = vi.hoisted(() => vi.fn());

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => T(key, params) }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) => selector({ user: mockUser.current }),
}));

vi.mock('../../lib/api', () => ({
  api: { get: mockApiGet },
}));

import { HomePage } from './HomePage';

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: 'user-1', username: 'testuser', displayName: 'Test User' };
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12 },
    });
  });

  // ── Greeting ─────────────────────────────────────────────────────────────

  it('should render greeting with display name', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('Hi, Test User')).toBeInTheDocument();
    });
  });

  it('should render greeting with username when no displayName', async () => {
    mockUser.current = { id: 'user-1', username: 'testuser', displayName: undefined };
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('Hi, testuser')).toBeInTheDocument();
    });
  });

  it('should render subtitle', async () => {
    render(<HomePage />);
    expect(screen.getByText('Challenge yourself with geography quizzes')).toBeInTheDocument();
  });

  // ── Mode cards ───────────────────────────────────────────────────────────

  it('should render all game mode cards', () => {
    render(<HomePage />);

    expect(screen.getByText('Flag Guess')).toBeInTheDocument();
    expect(screen.getByText('Capital Guess')).toBeInTheDocument();
    expect(screen.getByText('Country by Flag')).toBeInTheDocument();
    expect(screen.getByText('Continent')).toBeInTheDocument();
    expect(screen.getByText('Free Mode')).toBeInTheDocument();
  });

  it('should navigate to quiz when a mode card is clicked', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Flag Guess'));
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=flag-guess');
  });

  it('should navigate to capital-guess mode', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Capital Guess'));
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=capital-guess');
  });

  // ── Stats section ────────────────────────────────────────────────────────

  it('should show loading state while fetching stats', () => {
    mockApiGet.mockImplementationOnce(() => new Promise(() => {})); // never resolves
    render(<HomePage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show stats after loading', async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('15000')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('2500')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('should show no-games message when totalGames is 0', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 0, totalGames: 0, bestScore: 0, friends: 0 },
    });
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('Play your first game to see stats!')).toBeInTheDocument();
    });
  });

  it('should handle stats fetch failure gracefully', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('Network error'));
    render(<HomePage />);

    await waitFor(() => {
      // Should still render mode cards
      expect(screen.getByText('Flag Guess')).toBeInTheDocument();
    });
  });

  it('should not fetch stats when user has no id', () => {
    mockUser.current = null;
    render(<HomePage />);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
