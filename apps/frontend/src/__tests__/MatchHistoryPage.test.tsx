import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useAuthStore } from '../store/authStore';

// Mock api — use vi.hoisted to avoid hoisting issues
const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: mockGet },
}));

import { MatchHistoryPage } from '../features/multiplayer/MatchHistoryPage';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const MOCK_MATCHES = [
  {
    id: 'match-1',
    challengeId: 'ch-1',
    player1Id: 'user-1',
    player2Id: 'user-2',
    gameModeSlug: 'flag-guess',
    player1Score: 5,
    player2Score: 3,
    player1Finished: true,
    player2Finished: true,
    player1StartedAt: '2026-07-27T10:00:00Z',
    player2StartedAt: '2026-07-27T10:00:05Z',
    winnerId: 'user-1',
    status: 'completed' as const,
    createdAt: '2026-07-27T10:00:00Z',
    opponent: { id: 'user-2', username: 'opponent1', displayName: 'Opponent One' },
  },
  {
    id: 'match-2',
    challengeId: 'ch-2',
    player1Id: 'user-2',
    player2Id: 'user-1',
    gameModeSlug: 'capital-guess',
    player1Score: 2,
    player2Score: 4,
    player1Finished: true,
    player2Finished: true,
    player1StartedAt: '2026-07-26T14:00:00Z',
    player2StartedAt: '2026-07-26T14:00:10Z',
    winnerId: 'user-1',
    status: 'completed' as const,
    createdAt: '2026-07-26T14:00:00Z',
    opponent: { id: 'user-2', username: 'opponent1', displayName: 'Opponent One' },
  },
  {
    id: 'match-3',
    challengeId: 'ch-3',
    player1Id: 'user-1',
    player2Id: 'user-3',
    gameModeSlug: 'flag-guess-hardcore',
    player1Score: 2,
    player2Score: 2,
    player1Finished: true,
    player2Finished: true,
    player1StartedAt: '2026-07-25T09:00:00Z',
    player2StartedAt: '2026-07-25T09:00:03Z',
    winnerId: null,
    status: 'completed' as const,
    createdAt: '2026-07-25T09:00:00Z',
    opponent: { id: 'user-3', username: 'opponent2', displayName: 'Opponent Two' },
  },
  {
    id: 'match-4',
    challengeId: 'ch-4',
    player1Id: 'user-1',
    player2Id: 'user-2',
    gameModeSlug: 'free',
    player1Score: 0,
    player2Score: 0,
    player1Finished: false,
    player2Finished: false,
    player1StartedAt: null,
    player2StartedAt: null,
    winnerId: null,
    status: 'in_progress' as const,
    createdAt: '2026-07-28T08:00:00Z',
    opponent: { id: 'user-2', username: 'opponent1', displayName: 'Opponent One' },
  },
];

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <MatchHistoryPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('MatchHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set current user
    useAuthStore.setState({
      user: { id: 'user-1', username: 'testuser', email: 'test@test.com', language: 'en', joinCode: 'abc123', createdAt: '2026-01-01T00:00:00Z' } as any,
      token: 'fake-token',
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('should show loading state initially', () => {
    // Keep the promise pending
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it('should show match history list when loaded', async () => {
    mockGet.mockResolvedValue({ matches: MOCK_MATCHES });
    renderPage();

    // Wait for matches to render
    const opponentNames = await screen.findAllByText(/opponent/i);
    expect(opponentNames.length).toBeGreaterThanOrEqual(1);
    const oneElements = screen.getAllByText(/opponent one/i);
    expect(oneElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/opponent two/i)).toBeDefined();
  });

  it('should show empty state when no matches', async () => {
    mockGet.mockResolvedValue({ matches: [] });
    renderPage();

    const noMatches = await screen.findByText(/no matches yet/i);
    expect(noMatches).toBeDefined();
  });

  it('should show error state on fetch failure', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    renderPage();

    const errorMsg = await screen.findByText(/network error/i);
    expect(errorMsg).toBeDefined();
  });

  it('should show result badges for completed matches', async () => {
    mockGet.mockResolvedValue({ matches: MOCK_MATCHES });
    renderPage();

    // match-1 + match-2: user-1 won both → "You won!" appears twice
    const wonBadges = await screen.findAllByText(/you won/i);
    expect(wonBadges.length).toBe(2);

    // match-3: tie → "It's a tie!"
    const tieBadge = await screen.findByText(/tie/i);
    expect(tieBadge).toBeDefined();
  });

  it('should show status badges for in_progress matches', async () => {
    mockGet.mockResolvedValue({ matches: MOCK_MATCHES });
    renderPage();

    const inProgress = await screen.findAllByText(/in progress/i);
    expect(inProgress.length).toBeGreaterThanOrEqual(1);
  });

  it('should show verified badge next to a verified opponent name', async () => {
    const verifiedMatches = MOCK_MATCHES.map((m) => ({
      ...m,
      opponent: { ...m.opponent, isVerified: true },
    }));
    mockGet.mockResolvedValue({ matches: verifiedMatches });
    renderPage();

    await screen.findAllByText(/opponent one/i);
    expect(screen.getAllByRole('img', { name: 'Verified' }).length).toBeGreaterThanOrEqual(1);
  });

  it('should not show verified badge for non-verified opponents', async () => {
    mockGet.mockResolvedValue({ matches: MOCK_MATCHES });
    renderPage();

    await screen.findAllByText(/opponent one/i);
    expect(screen.queryByRole('img', { name: 'Verified' })).not.toBeInTheDocument();
  });

  it('should show correct scores', async () => {
    mockGet.mockResolvedValue({ matches: MOCK_MATCHES });
    renderPage();

    // match-1: player1=user-1, scores: 5 – 3 (en-dash with spaces)
    const scores5_3 = await screen.findAllByText((content) => content.includes('5') && content.includes('3'));
    expect(scores5_3.length).toBeGreaterThanOrEqual(1);
  });
});
