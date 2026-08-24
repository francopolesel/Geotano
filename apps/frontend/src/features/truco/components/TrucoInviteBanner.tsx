import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTrucoInviteStore } from '../../../store/trucoInviteStore';
import { useFriendsStore } from '../../../store/friendsStore';
import { joinTrucoMatchByCode } from '../../../lib/trucoApi';

/**
 * Global truco invite modal (remediation #11): the ONLY consumer of incoming
 * `truco:invite` pushes, mounted in AppShell next to the quiz challenge
 * dialog. Joining claims the guest seat by room code, then navigates to the
 * match page.
 */
export function TrucoInviteBanner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);
  const invite = useTrucoInviteStore((s) => s.invite);
  const dismiss = useTrucoInviteStore((s) => s.dismissInvite);
  const friends = useFriendsStore((s) => s.friends);

  if (!invite) return null;

  const inviterName =
    friends.find((friend) => friend.id === invite.fromUser)?.displayName ??
    friends.find((friend) => friend.id === invite.fromUser)?.username ??
    t('truco.multi.unknownPlayer');

  const handleAccept = async () => {
    setJoining(true);
    setFailed(false);
    try {
      await joinTrucoMatchByCode(invite.code);
      dismiss();
      navigate(`/truco/match/${invite.matchId}`);
    } catch {
      // Seat claim failed (code expired / match started): keep the banner up.
      setFailed(true);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        data-testid="truco-invite-banner"
        className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl"
      >
        <div className="text-center">
          <div className="text-5xl">🧉</div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">
            {t('truco.multi.invitedYou', { name: inviterName })}
          </h3>
          {failed ? (
            <p data-testid="truco-invite-error" className="mt-2 text-sm text-red-500">
              {t('truco.multi.inviteError')}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={dismiss}
            data-testid="truco-invite-decline"
            disabled={joining}
            className="flex-1 min-h-[48px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {t('multiplayer.decline')}
          </button>
          <button
            onClick={handleAccept}
            data-testid="truco-invite-accept"
            disabled={joining}
            className="flex-1 min-h-[48px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {joining ? t('truco.multi.joining') : t('truco.multi.join')}
          </button>
        </div>
      </div>
    </div>
  );
}
