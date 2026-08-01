import { useTranslation, Trans } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMultiplayerStore } from '../../store/multiplayerStore';
import { api } from '../../lib/api';
import { VerifiedBadge } from '../../components/ui/VerifiedBadge';

export function ChallengeNotification() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const notification = useMultiplayerStore((s) => s.challengeNotification);
  const dismiss = useMultiplayerStore((s) => s.dismissChallengeNotification);

  if (!notification) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ matchId: string }>('/matches/accept', {
        challengeId: notification.challengeId,
      });
      dismiss();
      navigate(`/multiplayer/${res.matchId}`);
    } catch {
      // error handling — notification stays visible
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    dismiss();
    setLoading(true);
    try {
      await api.post('/matches/decline', { challengeId: notification.challengeId });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl">
        <div className="text-center">
          <div className="text-5xl">⚔️</div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">
            <Trans
              i18nKey="multiplayer.challengeFrom"
              values={{
                username: notification.challenger.displayName ?? notification.challenger.username,
              }}
            >
              {notification.challenger.isVerified ? (
                <VerifiedBadge className="ml-1" />
              ) : (
                <></>
              )}
            </Trans>
          </h3>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 min-h-[48px] rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            {t('multiplayer.decline')}
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 min-h-[48px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('multiplayer.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
