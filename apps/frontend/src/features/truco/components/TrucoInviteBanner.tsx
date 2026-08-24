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
        role="alertdialog"
        aria-label={t('truco.multi.invitedYou', { name: inviterName })}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
      >
        {/* Card-suit motif strip in the game's felt/back palette */}
        <div
          aria-hidden
          className="flex h-14 items-center justify-center gap-2 bg-[var(--truco-card-back)]"
        >
          <span className="block h-7 w-5 rotate-[-10deg] rounded-sm border border-white/20 bg-[var(--truco-card-back-deep)]" />
          <span className="relative block h-8 w-6 rounded-sm border border-[var(--truco-card-border)] bg-[var(--truco-card-face)] shadow">
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[var(--truco-copa)]" />
          </span>
          <span className="block h-7 w-5 rotate-[10deg] rounded-sm border border-white/20 bg-[var(--truco-card-back-deep)]" />
        </div>

        <div className="px-6 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.multi.sectionTitle')}
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--color-foreground)]">
            {inviterName}
          </h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('truco.multi.wantsToPlay')}
          </p>
          {failed ? (
            <p data-testid="truco-invite-error" className="mt-2 text-sm text-red-500">
              {t('truco.multi.inviteError')}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={dismiss}
            data-testid="truco-invite-decline"
            disabled={joining}
            className="min-h-[48px] flex-1 rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:opacity-50"
          >
            {t('multiplayer.decline')}
          </button>
          <button
            onClick={handleAccept}
            data-testid="truco-invite-accept"
            disabled={joining}
            className="min-h-[48px] flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {joining ? t('truco.multi.joining') : t('truco.multi.join')}
          </button>
        </div>
      </div>
    </div>
  );
}
