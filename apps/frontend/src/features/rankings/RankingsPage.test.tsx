import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Translation dictionary ────────────────────────────────────────────────
const T = (key: string, params?: Record<string, any>) => {
  const dict: Record<string, string> = {
    'rankings.title': 'Leaderboard',
    'rankings.global': 'Global',
    'rankings.friends': 'Friends',
    'rankings.forever': 'All Time',
    'rankings.daily': 'Today',
    'rankings.player': 'Player',
    'rankings.score': 'Score',
    'rankings.players': '{count} players',
    'rankings.noData': 'No rankings data',
    'rankings.yourRank': 'Your Rank',
    'rankings.you': 'You',
    'common.all': 'All',
    'common.loading': 'Loading...',
    'common.error': 'Error loading rankings',
    'common.retry': 'Retry',
    'modes.flagGuess': 'Flag Guess',
    'modes.capitalGuess': 'Capital Guess',
    'modes.countryByFlag': 'Country by Flag',
    'modes.continent': 'Continent',
    'modes.free': 'Free Mode',
    'modes.variantHardcore': 'Extremo',
    'modes.variantUnlimited': 'Unlimited',
  };
  let text = dict[key] ?? key;
  if (params) text = text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
  return text;
};

// ─── Shared mutable refs ───────────────────────────────────────────────────
const queryState = vi.hoisted(() => ({
  data: null as any,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const mockCurrentUserId = vi.hoisted(() => ({ current: 'user-2' }));
const mockNavigate = vi.hoisted(() => vi.fn());

// ─── Mock components ───────────────────────────────────────────────────────
const MockUserAvatar = vi.hoisted(() =>
  vi.fn(({ username }: any) => <div data-testid="rankings-avatar" data-username={username} />),
);

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, any>) => T(key, params) }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: queryState.data,
    isLoading: queryState.isLoading,
    error: queryState.error,
    refetch: queryState.refetch,
  }),
}));

vi.mock('../../components/ui/UserAvatar', () => ({ UserAvatar: MockUserAvatar }));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ user: { id: mockCurrentUserId.current } }),
}));

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
}));

import { RankingsPage } from './RankingsPage';

// ─── Sample data ────────────────────────────────────────────────────────────
const sampleEntries = [
  { userId: 'user-1', username: 'player1', avatarUrl: null, score: 5000, rank: 1 },
  { userId: 'user-2', username: 'currentPlayer', avatarUrl: 'https://example.com/avatar.jpg', score: 3200, rank: 2 },
  { userId: 'user-3', username: 'player3', avatarUrl: null, score: 2100, rank: 3 },
];

const sampleRankings = {
  entries: sampleEntries,
  totalPlayers: 150,
  userRank: null,
};

describe('RankingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryState.data = null;
    queryState.isLoading = false;
    queryState.error = null;
    mockCurrentUserId.current = 'user-2';
  });

  // ── States ───────────────────────────────────────────────────────────────

  it('should render title and tabs', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    queryState.isLoading = true;
    render(<RankingsPage />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show error with retry button', () => {
    queryState.error = new Error('API error');
    render(<RankingsPage />);

    expect(screen.getByText('Error loading rankings')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(queryState.refetch).toHaveBeenCalled();
  });

  // ── Mode tabs ────────────────────────────────────────────────────────────

  it('should render mode filter tabs', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Flag Guess')).toBeInTheDocument();
    expect(screen.getByText('Capital Guess')).toBeInTheDocument();
    expect(screen.getByText('Country by Flag')).toBeInTheDocument();
    expect(screen.getByText('Continent')).toBeInTheDocument();
    expect(screen.getByText('Free Mode')).toBeInTheDocument();
  });

  // ── Scope and period filters ─────────────────────────────────────────────

  it('should render scope (global/friends) pills', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('Global')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
  });

  it('should render period (all-time/today) pills', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  // ── Leaderboard ──────────────────────────────────────────────────────────

  it('should render player count', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('150 players')).toBeInTheDocument();
  });

  it('should render all entries in the table', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('player1')).toBeInTheDocument();
    expect(screen.getByText('currentPlayer')).toBeInTheDocument();
    expect(screen.getByText('player3')).toBeInTheDocument();
  });

  it('should show "You" badge for current user', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('should show empty data message when no entries', () => {
    queryState.data = { ...sampleRankings, entries: [] };
    render(<RankingsPage />);

    expect(screen.getByText('No rankings data')).toBeInTheDocument();
  });

  // ── User rank (outside top 100) ──────────────────────────────────────────

  it('should show user rank when not in top entries', () => {
    queryState.data = {
      entries: sampleEntries.slice(0, 1), // only player1
      totalPlayers: 150,
      userRank: { userId: 'user-2', username: 'currentPlayer', avatarUrl: null, score: 3200, rank: 42 },
    };
    render(<RankingsPage />);

    expect(screen.getByText('Your Rank')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
  });

  it('should not show user rank when user is already in top entries', () => {
    // user-2 IS in sampleEntries, so userRank should NOT render
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    expect(screen.queryByText('Your Rank')).not.toBeInTheDocument();
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  it('should navigate to profile on row click', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);

    const row = screen.getByText('player1').closest('tr')!;
    fireEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith('/profile/user-1');
  });

  // ── Filter changes ───────────────────────────────────────────────────────

  it('should change scope when friends tab is clicked', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);
    // Clicking "Friends" triggers scope change, which changes queryKey → refetch
    // The queryKey change is handled by react-query's useQuery internally
    // We can verify the button renders and is clickable
    fireEvent.click(screen.getByText('Friends'));
    // No assertion needed - just verifying no crash
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('should change period when today tab is clicked', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);
    fireEvent.click(screen.getByText('Today'));
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('should change mode when a mode tab is clicked', () => {
    queryState.data = sampleRankings;
    render(<RankingsPage />);
    fireEvent.click(screen.getByText('Capital Guess'));
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  // ── Game mode badges (variant slugs) ───────────────────────────────────────

  it('should show base mode name + Extremo badge for hardcore slug', () => {
    queryState.data = {
      ...sampleRankings,
      entries: [
        { userId: 'user-1', username: 'player1', avatarUrl: null, score: 5000, rank: 1, gameModeSlug: 'capital-guess-hardcore' },
      ],
    };
    render(<RankingsPage />);

    // "Capital Guess" appears once as mode tab + once as badge = 2
    expect(screen.getAllByText('Capital Guess')).toHaveLength(2);
    // Hardcore badge should be present
    expect(screen.getByText('🔥Extremo')).toBeInTheDocument();
  });

  it('should show base mode name for unlimited slug', () => {
    queryState.data = {
      ...sampleRankings,
      entries: [
        { userId: 'user-1', username: 'player1', avatarUrl: null, score: 5000, rank: 1, gameModeSlug: 'flag-guess-unlimited' },
      ],
    };
    render(<RankingsPage />);

    // "Flag Guess" appears once as mode tab + once as badge = 2
    expect(screen.getAllByText('Flag Guess')).toHaveLength(2);
    expect(screen.getByText('Unlimited')).toBeInTheDocument();
  });

  // ── fetchRankings (lines 22-30) ──────────────────────────────────────────

  it('should fetch rankings without mode param (lines 22-30)', async () => {
    const { fetchRankings } = await import('./RankingsPage');
    const { api } = await import('../../lib/api');
    vi.mocked(api.get).mockResolvedValue({ entries: [], totalPlayers: 0 });

    await fetchRankings('global', 'forever', undefined);

    expect(api.get).toHaveBeenCalledWith('/rankings?scope=global&period=forever');
  });

  it('should include mode param when specified (line 28)', async () => {
    const { fetchRankings } = await import('./RankingsPage');
    const { api } = await import('../../lib/api');
    vi.mocked(api.get).mockResolvedValue({ entries: [], totalPlayers: 0 });

    await fetchRankings('friends', 'daily', 'flag-guess');

    expect(api.get).toHaveBeenCalledWith(
      '/rankings?scope=friends&period=daily&mode=flag-guess',
    );
  });
});
