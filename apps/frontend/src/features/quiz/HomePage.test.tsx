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
    'modes.variantStandard': 'Standard',
    'modes.variantExpress': 'Express',
    'modes.variantUnlimited': 'Unlimited',
    'modes.variantHardcore': 'Hardcore',
    'profile.totalScore': 'Total Score',
    'profile.totalGames': 'Games',
    'profile.bestScore': 'Best Score',
    'profile.friends': 'Friends',
    'profile.bestPlayer': '🏆 Best Player #{position}',
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

  it('should navigate to standard mode when default pill is clicked', () => {
    render(<HomePage />);
    const standardPills = screen.getAllByText('Standard');
    fireEvent.click(standardPills[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=flag-guess');
  });

  it('should navigate to capital-guess standard', () => {
    render(<HomePage />);
    const standardPills = screen.getAllByText('Standard');
    fireEvent.click(standardPills[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=capital-guess');
  });

  // ── Mode variant pills ────────────────────────────────────────────────

  it('should show Standard pill on each mode card', () => {
    render(<HomePage />);
    expect(screen.getAllByText('Standard')).toHaveLength(5);
  });

  it('should show Unlimited pill on each mode card', () => {
    render(<HomePage />);
    expect(screen.getAllByText('Unlimited')).toHaveLength(5);
  });

  it('should show Hardcore pill on each mode card', () => {
    render(<HomePage />);
    // Each hardcore button now shows "🔥 Hardcore"
    const hardcoreButtons = screen.getAllByText((content) => content.includes('🔥 Hardcore'));
    expect(hardcoreButtons).toHaveLength(5);
  });

  it('should show hardcore label on each mode card without ❤️ indicator', () => {
    render(<HomePage />);
    // Hardcore variant label should appear 5 times (one per mode group) with fire emoji
    const hardcoreButtons = screen.getAllByText((content) => content.includes('🔥 Hardcore'));
    expect(hardcoreButtons).toHaveLength(5);
    // The 1 ❤️ indicator should NOT be present (removed per design)
    expect(screen.queryByText('1 ❤️')).not.toBeInTheDocument();
  });

  it('should navigate to hardcore mode when hardcore pill is clicked', () => {
    render(<HomePage />);
    const hardcorePills = screen.getAllByText((content) => content.includes('🔥 Hardcore'));
    fireEvent.click(hardcorePills[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=flag-guess-hardcore');
  });

  it('should navigate to unlimited mode when unlimited pill is clicked', () => {
    render(<HomePage />);
    const unlimitedPills = screen.getAllByText('Unlimited');
    fireEvent.click(unlimitedPills[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=capital-guess-unlimited');
  });

  it('should navigate to standard mode when standard pill is clicked', () => {
    render(<HomePage />);
    const standardPills = screen.getAllByText('Standard');
    fireEvent.click(standardPills[3]);
    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=continent');
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

  // ── Hardcore variant styles ────────────────────────────────────────────

  it('should have red border on all hardcore variant buttons', () => {
    render(<HomePage />);
    const hardcoreButtons = screen.getAllByText((content) => content.includes('🔥 Hardcore'));
    expect(hardcoreButtons).toHaveLength(5);

    hardcoreButtons.forEach((btn) => {
      const button = btn.closest('button') || btn;
      expect(button.className).toMatch(/border-red|ring-red/);
    });
  });

  it('should show fire emoji on all hardcore variant buttons', () => {
    render(<HomePage />);
    const fireElements = screen.getAllByText((content) => content.includes('🔥'));
    expect(fireElements).toHaveLength(5);
  });

  it('should not show fire emoji on standard variant buttons', () => {
    render(<HomePage />);
    const standardButtons = screen.getAllByText('Standard');
    standardButtons.forEach((btn) => {
      expect(btn.textContent).not.toContain('🔥');
    });
  });

  it('should not show fire emoji on unlimited variant buttons', () => {
    render(<HomePage />);
    const unlimitedButtons = screen.getAllByText('Unlimited');
    unlimitedButtons.forEach((btn) => {
      expect(btn.textContent).not.toContain('🔥');
    });
  });

  // ── Best Player ───────────────────────────────────────────────────────────

  it('should show Best Player banner with 👑 for globalRank 1', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 50000, totalGames: 100, bestScore: 5000, friends: 25, globalRank: 1 },
    });
    render(<HomePage />);

    await waitFor(() => {
      // The 👑 and Best Player text are in the same <p> element — use function matcher
      expect(screen.getByText((content) => content.includes('🏆 Best Player #1'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('👑'))).toBeInTheDocument();
    });
  });

  it('should show Best Player banner without crown for globalRank 2', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 30000, totalGames: 80, bestScore: 4000, friends: 20, globalRank: 2 },
    });
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('🏆 Best Player #2', { exact: false })).toBeInTheDocument();
      expect(screen.queryByText((content) => content.includes('👑'))).not.toBeInTheDocument();
    });
  });

  it('should show Best Player banner for globalRank 3', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 10000, totalGames: 50, bestScore: 3000, friends: 15, globalRank: 3 },
    });
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('🏆 Best Player #3', { exact: false })).toBeInTheDocument();
    });
  });

  it('should not show Best Player banner for globalRank > 3', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 5000, totalGames: 20, bestScore: 1500, friends: 5, globalRank: 5 },
    });
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.queryByText(/Best Player/)).not.toBeInTheDocument();
    });
  });

  it('should not show Best Player banner when globalRank is undefined', async () => {
    mockApiGet.mockResolvedValue({
      stats: { totalScore: 15000, totalGames: 42, bestScore: 2500, friends: 12 },
    });
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText('15000')).toBeInTheDocument(); // stats still show
      expect(screen.queryByText(/Best Player/)).not.toBeInTheDocument();
    });
  });
});
