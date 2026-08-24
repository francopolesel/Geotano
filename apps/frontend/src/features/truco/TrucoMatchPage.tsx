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
import { useFriendsStore } from '../../store/friendsStore';
import { TrucoTable } from './components/TrucoTable';

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
    view,
    mySlot,
    opponentUserId,
    opponentPresence,
    postAction,
    actionError,
    isLoading,
    isError,
    error,
    refetch,
    currentUserId,
  } = useTrucoMultiplayer(matchId);

  // Opponent identity: the snapshot DTO carries only ids (D8), so a tracked
  // friend's username is the one honest name available client-side; code-join
  // strangers get the neutral localized label instead of a guess.
  const friends = useFriendsStore((state) => state.friends);
  const opponentFriend = friends.find((friend) => friend.friendId === opponentUserId);
  const opponentName =
    opponentFriend?.displayName || opponentFriend?.username || t('truco.multi.opponent');
  const rivalAvatar = (
    <span
      data-testid="truco-match-rival-avatar"
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-sm font-bold text-[var(--color-foreground)]"
    >
      {opponentName.slice(0, 1).toUpperCase()}
    </span>
  );

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
        <div
          data-testid="truco-match-playing"
          className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-2 px-2"
        >
          {snapshot.status === 'playing' && view && mySlot ? (
            <>
              {/* Opponent strip: identity + honest connection indicator */}
              <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {rivalAvatar}
                  <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-foreground)]">
                    {opponentName}
                  </span>
                </div>
                <span
                  data-testid="truco-match-presence"
                  data-presence={opponentPresence}
                  className="flex shrink-0 items-center gap-1 text-xs text-[var(--color-muted-foreground)]"
                >
                  <span
                    aria-hidden
                    className={[
                      'h-2 w-2 rounded-full',
                      opponentPresence === 'online'
                        ? 'bg-emerald-500'
                        : opponentPresence === 'offline'
                          ? 'bg-red-500'
                          : 'bg-[var(--color-border)]',
                    ].join(' ')}
                  />
                  {t(`truco.multi.presence.${opponentPresence}`)}
                </span>
              </div>

              {/* Zero rules logic here: legality + actions come from the shared
                  table over the redacted view; every move POSTs to the server,
                  whose response is merged as truth by the hook. */}
              <TrucoTable
                view={view}
                mySlot={mySlot}
                myName={t('truco.you')}
                opponentName={opponentName}
                onAction={(action) =>
                  postAction.mutate({ expectedVersion: view.version, action })
                }
                rivalAvatar={rivalAvatar}
              />

              {actionError?.status === 409 && (
                <p
                  data-testid="truco-match-syncing"
                  data-persisted="true"
                  role="status"
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  {t('truco.multi.syncing')}
                </p>
              )}
              {actionError && actionError.status !== 409 && (
                <p
                  data-testid="truco-match-action-error"
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                >
                  {t('truco.error.generic')}
                </p>
              )}
            </>
          ) : (
            // Slice 6d swaps the finished branch for the shared EndScreen.
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {t('truco.menu.comingSoon')}
            </div>
          )}
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
