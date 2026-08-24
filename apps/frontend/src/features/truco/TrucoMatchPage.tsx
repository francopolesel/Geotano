// ---------------------------------------------------------------------------
// Truco multiplayer match screen (CU6, design D11)
// ---------------------------------------------------------------------------
// Composition ONLY over useTrucoMultiplayer server state: the GET snapshot is
// the single source of truth, every mutation goes through the server, and the
// UI renders whatever the authoritative status says. W1 is mirrored here —
// only the host sees a start control and only from 'ready' — but the server
// remains the authority (guest start would be 403 FORBIDDEN anyway).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PlayerSlot } from '@geotano/shared';
import { createTrucoMatch, startTrucoMatch } from '../../lib/trucoApi';
import { statusOf } from './lib/apiStatus';
import { useTrucoMultiplayer, isBenignRaceRejection } from './hooks/useTrucoMultiplayer';
import { useFriendsStore } from '../../store/friendsStore';
import { TrucoTable } from './components/TrucoTable';
import { EndScreen } from './components/EndScreen';

/** Readable pause showing the failure reason before the menu fallback (#15). */
export const REMATCH_ERROR_FALLBACK_MS = 2500;

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

  const navigate = useNavigate();
  const isHost = snapshot != null && snapshot.hostPlayerId === currentUserId;

  // Server-declared winner projected onto engine slots for the shared
  // EndScreen; null stays the (v1-unreachable) draw branch.
  const viewerSlot = mySlot;
  const winnerSlot: PlayerSlot | null =
    !viewerSlot || snapshot?.winnerUserId == null
      ? null
      : snapshot.winnerUserId === currentUserId
        ? viewerSlot
        : viewerSlot === 'A'
          ? 'B'
          : 'A';

  // Multiplayer Play Again = REMATCH: re-call create with the opponent as
  // friendId (D8 — no dedicated endpoint). Code-joined strangers have no
  // friendship row, so the server 403s the invite create; the failure is
  // surfaced briefly (#15) before the honest fallback — the menu, where
  // codes work.
  const [rematchError, setRematchError] = useState(false);
  const rematchingRef = useRef(false);
  const rematchFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rematchFallbackRef.current !== null) clearTimeout(rematchFallbackRef.current);
    },
    [],
  );
  const onRematch = useCallback(async () => {
    if (rematchingRef.current) return;
    rematchingRef.current = true;
    const failOverToMenu = () => {
      rematchingRef.current = false;
      navigate('/truco');
    };
    try {
      if (!opponentUserId) {
        failOverToMenu();
        return;
      }
      const created = await createTrucoMatch({ friendId: opponentUserId });
      rematchingRef.current = false;
      navigate(`/truco/match/${created.matchId}`);
    } catch {
      setRematchError(true);
      // Guard stays SHUT during the readable pause (double-click protection).
      rematchFallbackRef.current = setTimeout(failOverToMenu, REMATCH_ERROR_FALLBACK_MS);
    }
  }, [opponentUserId, navigate]);

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
      {isError && (
        // Cached board still renders, but it must never rot silently (#13):
        // a failed refresh is surfaced as an honest stale/reconnecting state.
        <p
          data-testid="truco-match-stale"
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {t('truco.multi.stale')}
        </p>
      )}
      {(snapshot.status === 'playing' || snapshot.status === 'finished') && (
        <div
          data-testid="truco-match-playing"
          className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-2 px-2"
        >
          {snapshot.status === 'finished' && view && mySlot ? (
            // Spec: both clients land on the end screen with identical final
            // scores and the server-declared winner; Play Again rematches.
            <>
              {rematchError && (
                <p
                  data-testid="truco-rematch-error"
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
                >
                  {t('truco.error.rematch')}
                </p>
              )}
              <EndScreen
                winner={winnerSlot}
                mySlot={mySlot}
                scores={view.scores}
                targetPoints={snapshot.targetPoints}
                myName={t('truco.you')}
                opponentName={opponentName}
                onPlayAgain={() => void onRematch()}
                onChangeMode={() => navigate('/truco')}
                onBack={() => navigate(-1)}
                onGeotano={() => navigate('/')}
              />
            </>
          ) : snapshot.status === 'playing' && view && mySlot ? (
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

              {/* Benign lost races (409 CAS, E_OUT_OF_TURN / E_STATE_FORBIDDEN
                  from a concurrently moved rival) get the calm amber syncing
                  treatment (#14b); genuinely hostile errors stay red. */}
              {actionError && isBenignRaceRejection(actionError) && (
                <p
                  data-testid="truco-match-syncing"
                  data-persisted="true"
                  role="status"
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  {t('truco.multi.syncing')}
                </p>
              )}
              {actionError && !isBenignRaceRejection(actionError) && (
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
            // Defensive only: finished/playing snapshots always carry a dealt
            // view server-side, so this branch is unreachable in practice.
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
