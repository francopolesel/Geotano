import { useTranslation } from 'react-i18next';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { acceptChallenge, declineChallenge } from '../../lib/socket';

export function ChallengeNotification() {
  const { t } = useTranslation();
  const notification = useMultiplayerStore((s) => s.challengeNotification);
  const dismiss = useMultiplayerStore((s) => s.dismissChallengeNotification);

  if (!notification) return null;

  const handleAccept = () => {
    acceptChallenge(notification.challengeId);
    dismiss();
  };

  const handleDecline = () => {
    declineChallenge(notification.challengeId);
    dismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">⚔️</div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">
            {t('multiplayer.challengeFrom', {
              username: notification.challenger.displayName ?? notification.challenger.username,
            })}
          </h3>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 min-h-[48px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
          >
            {t('multiplayer.decline')}
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 min-h-[48px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90"
          >
            {t('multiplayer.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
