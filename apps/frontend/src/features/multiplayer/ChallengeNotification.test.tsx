import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/i18n';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import type { UserProfile } from '@geotano/shared';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/api', () => ({
  api: { post: mockPost },
}));

import { ChallengeNotification } from './ChallengeNotification';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeChallenger(isVerified?: boolean): UserProfile {
  return {
    id: 'user-5',
    username: 'francopolesel99',
    email: '',
    language: 'en',
    joinCode: '',
    createdAt: '',
    displayName: 'Franco',
    isVerified,
  };
}

function renderNotification() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ChallengeNotification />
    </I18nextProvider>,
  );
}

describe('ChallengeNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMultiplayerStore.setState({ challengeNotification: null });
  });

  it('should render null when no notification', () => {
    const { container } = renderNotification();
    expect(container.innerHTML).toBe('');
  });

  it('should show verified badge next to challenger name when challenger is verified', () => {
    useMultiplayerStore.getState().showChallengeNotification({
      challengeId: 'ch-1',
      challenger: makeChallenger(true),
    });

    renderNotification();

    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument();
  });

  it('should not show verified badge when challenger is not verified', () => {
    useMultiplayerStore.getState().showChallengeNotification({
      challengeId: 'ch-1',
      challenger: makeChallenger(false),
    });

    renderNotification();

    expect(screen.queryByRole('img', { name: 'Verified' })).not.toBeInTheDocument();
  });

  it('should accept the challenge and navigate to the match', async () => {
    mockPost.mockResolvedValueOnce({ matchId: 'match-9' });
    useMultiplayerStore.getState().showChallengeNotification({
      challengeId: 'ch-1',
      challenger: makeChallenger(),
    });

    renderNotification();

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/multiplayer/match-9');
    });
  });

  it('should decline the challenge and dismiss the notification', async () => {
    mockPost.mockResolvedValueOnce({});
    useMultiplayerStore.getState().showChallengeNotification({
      challengeId: 'ch-1',
      challenger: makeChallenger(),
    });

    renderNotification();

    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    await vi.waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/matches/decline', { challengeId: 'ch-1' });
      expect(useMultiplayerStore.getState().challengeNotification).toBeNull();
    });
  });
});
