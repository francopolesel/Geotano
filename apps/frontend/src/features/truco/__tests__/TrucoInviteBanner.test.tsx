import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/i18n';
import { useTrucoInviteStore } from '../../../store/trucoInviteStore';
import { useFriendsStore } from '../../../store/friendsStore';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockJoinByCode } = vi.hoisted(() => ({ mockJoinByCode: vi.fn() }));
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../lib/trucoApi', () => ({
  joinTrucoMatchByCode: mockJoinByCode,
}));

import { TrucoInviteBanner } from '../components/TrucoInviteBanner';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const INVITE = { matchId: 'm-9', code: 'TRQ5X2', fromUser: 'user-5' };

function renderBanner() {
  return render(
    <I18nextProvider i18n={i18n}>
      <TrucoInviteBanner />
    </I18nextProvider>,
  );
}

describe('TrucoInviteBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrucoInviteStore.setState({ invite: null });
    useFriendsStore.setState({
      friends: [{ id: 'user-5', username: 'franco', displayName: 'Franco' }],
    } as never);
  });

  it('renders nothing when no invite is pending', () => {
    const { container } = renderBanner();
    expect(container.innerHTML).toBe('');
  });

  it('greets the inviter by their resolved friend display name', () => {
    useTrucoInviteStore.getState().showInvite(INVITE);
    renderBanner();

    const banner = screen.getByTestId('truco-invite-banner');
    expect(banner).toHaveTextContent('Franco');
    expect(screen.getByTestId('truco-invite-accept')).toBeDefined();
    expect(screen.getByTestId('truco-invite-decline')).toBeDefined();
  });

  it('falls back to a localized label when the inviter is not a stored friend', () => {
    useFriendsStore.setState({ friends: [] } as never);
    useTrucoInviteStore.getState().showInvite(INVITE);
    renderBanner();

    // 'truco.multi.unknownPlayer' resolves to "A friend" in the en test locale.
    expect(screen.getByTestId('truco-invite-banner').textContent).toContain('A friend');
  });

  it('accepting joins by code, dismisses and navigates to the match', async () => {
    mockJoinByCode.mockResolvedValueOnce({ matchId: 'm-9' });
    useTrucoInviteStore.getState().showInvite(INVITE);
    renderBanner();

    fireEvent.click(screen.getByTestId('truco-invite-accept'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/truco/match/m-9'),
    );
    expect(mockJoinByCode).toHaveBeenCalledWith('TRQ5X2');
    expect(useTrucoInviteStore.getState().invite).toBeNull();
  });

  it('keeps the banner and surfaces an error when joining fails', async () => {
    mockJoinByCode.mockRejectedValueOnce(new Error('CODE_NOT_FOUND'));
    useTrucoInviteStore.getState().showInvite(INVITE);
    renderBanner();

    fireEvent.click(screen.getByTestId('truco-invite-accept'));

    await waitFor(() =>
      expect(screen.getByTestId('truco-invite-error')).toBeDefined(),
    );
    expect(useTrucoInviteStore.getState().invite).toEqual(INVITE);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('declining dismisses locally without any API call', () => {
    useTrucoInviteStore.getState().showInvite(INVITE);
    renderBanner();

    fireEvent.click(screen.getByTestId('truco-invite-decline'));

    expect(useTrucoInviteStore.getState().invite).toBeNull();
    expect(mockJoinByCode).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
