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
import {
  useTrucoMultiplayer,
  isBenignRaceRejection,
} from './hooks/useTrucoMultiplayer';
import { useFriendsStore } from '../../store/friendsStore';
import { TrucoTable } from './components/TrucoTable';
import { EndScreen } from './components/EndScreen';
import {
  createSoundSink,
  mapEventsToSounds,
  type TrucoSoundSink,
} from './lib/soundTriggers';

/** Readable pause showing the failure reason before the menu fallback (#15). */
export const REMATCH_ERROR_FALLBACK_MS = 2500;

/**
 * VOS-vs-rival header shared by the waiting/ready lobbies (v2 batch C
 * restyle). Presentation only — presence stays honest (dot hidden while no
 * opponent is connected yet; unknown state never fakes a connection).
 */
function VersusHeader({
  opponentName,
  opponentConnected,
  presence,
}: {
  opponentName: string;
  opponentConnected: boolean;
  presence: 'online' | 'offline' | 'unknown';
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8">
      <div className="flex w-20 flex-col items-center gap-1 sm:w-24">
        <span
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-black text-white ring-2 ring-white/30"
        >
          {t('truco.you').slice(0, 1).toUpperCase()}
        </span>
        <span data-testid="truco-match-you-label" className="max-w-full truncate text-sm font-bold text-white">
          {t('truco.you')}
        </span>
      </div>
      <span
        aria-hidden
        className="text-2xl font-black italic tracking-tight text-[var(--truco-card-back-gold)] drop-shadow sm:text-3xl"
      >
        {t('truco.match.vs')}
      </span>
      <div className="flex w-20 flex-col items-center gap-1 sm:w-24">
        <span
          data-testid="truco-match-versus-opponent-avatar"
          aria-hidden
          className={[
            'flex h-14 w-14 items-center justify-center rounded-full text-lg font-black ring-2',
            opponentConnected
              ? 'bg-white/10 text-white ring-white/40'
              : 'bg-white/5 text-white/50 ring-dashed ring-white/20',
          ].join(' ')}
        >
          {opponentConnected ? opponentName.slice(0, 1).toUpperCase() : '?'}
        </span>
        <span
          data-testid="truco-match-versus-opponent-label"
          className={[
            'max-w-full truncate text-sm font-bold',
            opponentConnected ? 'text-white' : 'text-white/60',
          ].join(' ')}
        >
          {opponentName}
        </span>
        {opponentConnected && (
          <span
            data-testid="truco-match-presence"
            data-presence={presence}
            className="flex shrink-0 items-center gap-1 text-[10px] text-white/70"
          >
            <span
              aria-hidden
              className={[
                'h-1.5 w-1.5 rounded-full',
                presence === 'online'
                  ? 'bg-emerald-400'
                  : presence === 'offline'
                    ? 'bg-amber-300'
                    : 'bg-white/30',
              ].join(' ')}
            />
            {t(
              presence === 'online'
                ? 'truco.multi.presence.online'
                : presence === 'offline'
                  ? 'truco.multi.presence.offline'
                  : 'truco.multi.presence.unknown',
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/** Structural shape of a rejected action (mirrors ApiError, read-only). */
type TrucoActionError = { status?: number; errorCode?: string } | null | undefined;

/**
 * Maps hostile (non-benign) action rejections onto human Spanish-neutral
 * copy. Codes are NOT renamed here — this is display mapping only; unknown
 * codes fall back to the generic message so raw detail never reaches users.
 */
function actionErrorKey(err: TrucoActionError): string {
  switch (err?.errorCode) {
    case 'E_CARD_NOT_OWNED':
    case 'E_CARD_ALREADY_PLAYED':
      return 'truco.error.cantPlayNow';
    case 'E_ENVIDO_WINDOW_CLOSED':
    case 'E_ENVIDO_BETTING_CLOSED':
    case 'E_ILLEGAL_RAISE_ORDER':
    case 'E_NOT_RESPONDER':
    case 'E_NO_PENDING_BET':
    case 'E_ALREADY_ANSWERED':
    case 'E_AWAITING_OWN_BET':
    case 'E_TRUCO_WINDOW_CLOSED':
      return 'truco.error.cantBetNow';
    default:
      return 'truco.error.generic';
  }
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
    isActing,
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

  // ── Multiplayer sound wiring (batch 3) ──────────────────────────────────────
  // The 10s poll AND socket invalidations both refetch the SAME snapshot, so
  // dedupe is mandatory: a per-matchId watermark over history.length means a
  // refetch of an unchanged log fires nothing, and only NEWLY APPENDED events
  // are mapped to cues. First sight of a matchId (mount, reload, rematch
  // navigation) anchors WITHOUT replaying its past history.
  //
  // SERVER CONTRACT: the match history log is APPEND-ONLY — the server never
  // rewrites or reorders past entries, so comparing history.length is a sound
  // dedupe key (equal length ⇒ identical prefix; growth ⇒ exactly the suffix
  // is new). If that contract ever changes, this watermark must change too.
  const sinkRef = useRef<TrucoSoundSink | null>(null);
  if (!sinkRef.current) sinkRef.current = createSoundSink();
  const soundWatermarkRef = useRef<{ matchId: string; seen: number }>({ matchId: '', seen: 0 });
  const viewHistory = snapshot?.view?.history;
  useEffect(() => {
    if (!viewHistory || !mySlot || !matchId) return;
    const wm = soundWatermarkRef.current;
    if (wm.matchId !== matchId) {
      // New/first match context: anchor silently — never blast the backlog.
      soundWatermarkRef.current = { matchId, seen: viewHistory.length };
      return;
    }
    if (viewHistory.length < wm.seen) {
      // Log shrank (server-side reset edge): re-anchor without firing.
      soundWatermarkRef.current = { matchId, seen: viewHistory.length };
      return;
    }
    if (viewHistory.length === wm.seen) return; // same snapshot refetched
    const fresh = viewHistory.slice(wm.seen);
    soundWatermarkRef.current = { matchId, seen: viewHistory.length };
    mapEventsToSounds(fresh, mySlot, sinkRef.current as TrucoSoundSink);
  }, [viewHistory, mySlot, matchId]);

  // ── Room-code copy affordance (batch 3) ────────────────────────────────────
  const [codeCopied, setCodeCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    },
    [],
  );
  const onCopyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions/jsdom): the code stays readable
      // on screen, so failing silently is honest here.
    }
  }, []);

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
      className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 p-2"
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
          className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2 px-2"
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
                          // Honest neutral state: amber dot, NO pulse — we
                          // cannot promise the rival is coming back.
                          ? 'bg-amber-400'
                          : 'bg-[var(--color-border)]',
                    ].join(' ')}
                  />
                  {t(
                    opponentPresence === 'online'
                      ? 'truco.multi.presence.online'
                      : opponentPresence === 'offline'
                        ? 'truco.multi.presence.offline'
                        : 'truco.multi.presence.unknown',
                  )}
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
                isActing={isActing}
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
                  {t(actionErrorKey(actionError))}
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
        // v2 versus presentation: felt-toned VOS-vs-rival card; the room code
        // stays copyable but visually secondary below the matchup.
        <section
          data-testid="truco-match-versus"
          className="rounded-2xl border border-[var(--truco-card-border)] bg-[var(--truco-felt-edge)] p-6 text-center shadow-lg"
        >
          <VersusHeader
            opponentName={opponentName}
            opponentConnected={Boolean(opponentUserId)}
            presence={opponentPresence}
          />

          {/* Room code — still shareable, demoted under the matchup */}
          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">
              {t('truco.multi.roomCode')}
            </p>
            <div className="mb-2 flex min-w-0 items-center justify-center gap-3">
              <p
                data-testid="truco-match-code"
                className="font-mono text-3xl font-bold tracking-[0.25em] text-white sm:text-4xl"
              >
                {snapshot.code}
              </p>
              <button
                type="button"
                data-testid="truco-match-copy-code"
                aria-label={codeCopied ? t('truco.multi.copied') : t('truco.multi.copyCode')}
                onClick={() => void onCopyCode(snapshot.code)}
                className={[
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  codeCopied
                    ? 'border-emerald-300 bg-emerald-400/20 text-emerald-200'
                    : 'border-white/25 text-white/80 hover:border-white hover:text-white',
                ].join(' ')}
              >
                {codeCopied ? (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
                    <path
                      d="m5 12.5 4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
                    <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            {codeCopied && (
              <p
                data-testid="truco-match-code-copied"
                role="status"
                className="mb-2 text-xs font-semibold text-emerald-300"
              >
                {t('truco.multi.copied')}
              </p>
            )}
            <p className="text-sm text-white/70">
              {t('truco.multi.shareCodeHint')}
            </p>
          </div>

          {/* Animated waiting indicator: three bouncing dots */}
          <div aria-hidden className="mb-2 mt-5 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                data-testid="truco-waiting-dot"
                className="animate-truco-bounce-dot block h-2 w-2 rounded-full bg-emerald-400"
                style={{ animationDelay: `${dot * 160}ms` }}
              />
            ))}
          </div>
          <p
            data-testid="truco-match-waiting"
            className="text-sm font-medium text-white/85"
          >
            {t('truco.multi.waitingForPlayer')}
          </p>
        </section>
      )}

      {snapshot.status === 'ready' && (
        // Both players connected: the versus header shows the real rival with
        // honest presence; host-only start control (W1) stays unchanged.
        <section
          data-testid="truco-match-versus-ready"
          className="rounded-2xl border border-[var(--truco-card-border)] bg-[var(--truco-felt-edge)] p-6 text-center shadow-lg"
        >
          <VersusHeader
            opponentName={opponentName}
            opponentConnected={Boolean(opponentUserId)}
            presence={opponentPresence}
          />
          {isHost ? (
            <>
              <button
                type="button"
                data-testid="truco-multi-start"
                disabled={starting}
                onClick={() => void onStart()}
                className="mt-6 min-h-[52px] w-full rounded-xl bg-emerald-500 px-4 text-base font-black uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {starting ? t('truco.multi.starting') : t('truco.multi.startMatch')}
              </button>
              {startError && (
                <p
                  data-testid="truco-multi-error"
                  role="alert"
                  className="mt-3 rounded-md border border-red-400/60 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                >
                  {startError}
                </p>
              )}
            </>
          ) : (
            <>
              <div aria-hidden className="mb-2 mt-6 flex items-center justify-center gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="animate-truco-bounce-dot block h-2 w-2 rounded-full bg-emerald-400"
                    style={{ animationDelay: `${dot * 160}ms` }}
                  />
                ))}
              </div>
              <p
                data-testid="truco-match-guest-waiting"
                className="text-sm font-medium text-white/85"
              >
                {t('truco.multi.waitingForHost')}
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
