// ---------------------------------------------------------------------------
// Truco multiplayer match screen (CU6, design D11)
// ---------------------------------------------------------------------------
// Composition ONLY over useTrucoMultiplayer server state: the GET snapshot is
// the single source of truth, every mutation goes through the server, and the
// UI renders whatever the authoritative status says. W1 is mirrored here —
// only the host sees a start control and only from 'ready' — but the server
// remains the authority (guest start would be 403 FORBIDDEN anyway).

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { startTrucoMatch } from '../../lib/trucoApi';
import { useTrucoMultiplayer } from './hooks/useTrucoMultiplayer';

/** Thrown values are ApiError-shaped ({status}); map without instanceof so
 * module-mocked api clients in tests behave identically to production. */
function statusOf(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status;
}

export function TrucoMatchPage() {
  const { t } = useTranslation();
  const { matchId = '' } = useParams<{ matchId: string }>();

  const {
    snapshot,
    isLoading,
    isError,
    error,
    refetch,
    currentUserId,
  } = useTrucoMultiplayer(matchId);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const isHost = snapshot != null && snapshot.hostPlayerId === currentUserId;

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      await startTrucoMatch(matchId);
      // The start push also invalidates; refetching here makes the host's own
      // transition immediate instead of racing the socket round-trip.
      await refetch();
    } catch (err) {
      const status = statusOf(err);
      setStartError(
        status === 403 || status === 409
          ? t('truco.error.notStartable')
          : t('truco.error.generic'),
      );
    } finally {
      setStarting(false);
    }
  };

  if (!snapshot) {
    return (
      <div data-testid="truco-match-page" className="mx-auto w-full max-w-2xl min-w-0 p-4">
        {isError ? (
          <p
            data-testid="truco-match-error"
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
          >
            {statusOf(error) === 404
              ? t('truco.error.matchNotFound')
              : statusOf(error) === 403
                ? t('truco.error.notParticipant')
                : t('truco.error.generic')}
          </p>
        ) : (
          <div data-testid="truco-match-loading" className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {t('truco.multi.loading')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid="truco-match-page"
      data-match-id={matchId}
      className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4 p-2"
    >
      {(snapshot.status === 'playing' || snapshot.status === 'finished') && (
        // Slice 6c replaces this stub with the shared CU5 table components.
        <div
          data-testid="truco-match-playing"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
        >
          {t('truco.menu.comingSoon')}
        </div>
      )}

      {snapshot.status === 'waiting' && (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {t('truco.multi.roomCode')}
          </p>
          <p
            data-testid="truco-match-code"
            className="mb-4 font-mono text-3xl font-bold tracking-[0.3em] text-[var(--color-foreground)]"
          >
            {snapshot.code}
          </p>
          <p
            data-testid="truco-match-waiting"
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            {t('truco.multi.waitingForPlayer')}
          </p>
        </section>
      )}

      {snapshot.status === 'ready' && (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center">
          {isHost ? (
            <>
              <button
                type="button"
                data-testid="truco-multi-start"
                disabled={starting}
                onClick={() => void onStart()}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? t('truco.multi.starting') : t('truco.multi.startMatch')}
              </button>
              {startError && (
                <p
                  data-testid="truco-multi-error"
                  role="alert"
                  className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                >
                  {startError}
                </p>
              )}
            </>
          ) : (
            <p
              data-testid="truco-match-guest-waiting"
              className="text-sm text-[var(--color-muted-foreground)]"
            >
              {t('truco.multi.waitingForHost')}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
