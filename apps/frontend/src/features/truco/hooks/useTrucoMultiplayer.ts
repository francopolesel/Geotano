// ---------------------------------------------------------------------------
// Truco multiplayer — server-state controller hook (CU6, D9/D11)
// ---------------------------------------------------------------------------
// State split per repo rule: EVERYTHING here is TanStack Query server state.
// - GET snapshot is the single source of truth; reload/resume restores from it.
// - postAction carries {expectedVersion, action}; the SERVER response is truth
//   and is merged into the cache — the client never mutates match state
//   locally. A 409 version_conflict recovers by refetching authority.
// - truco:* pushes trigger query invalidation ONLY (no direct state writes).
// - S5 DO-NOT-REVERT: the poll fallback lives ON THE QUERY as refetchInterval.
//   It is deliberately NOT setInterval like MultiplayerPage's waiting screen:
//   Query-native polling shares cache/dedup/lifecycle, auto-cancels on unmount
//   (no timer leak), and converges identically when sockets are down.
//   Reverting reintroduces the timer-leak/duplicate-fetch bug class the design
//   rejected (pinned by socket.truco + useTrucoMultiplayer suites).
//
// Presence honesty note: the backend broadcasts user:online/offline ONLY to
// friends of the connecting user (socket/index.ts getFriendIds gate). So the
// opponent connection indicator is reliable for friend/invite matches and
// reports 'unknown' for code-joined strangers rather than ever lying.

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerSlot, TrucoAction, TrucoView } from '@geotano/shared';
import { api, ApiError } from '../../../lib/api';
import { connectSocket, setTrucoHandlers } from '../../../lib/socket';
import { useAuthStore } from '../../../store/authStore';
import { useFriendsStore } from '../../../store/friendsStore';

/** ≤10s poll fallback (S5) — always active alongside socket pushes. */
export const TRUCO_POLL_INTERVAL_MS = 10_000;

// ─── DTOs consuming EXACT backend reality (routes/truco.ts) ─────────────────

/** Per-viewer redacted view with service-merged identity/version fields. */
export type TrucoMatchViewDTO = TrucoView & { matchId: string; version: number };

export interface TrucoMatchSnapshotDTO {
  ok: true;
  matchId: string;
  code: string;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
  version: number;
  targetPoints: number;
  hostPlayerId: string;
  guestPlayerId: string | null;
  winnerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null until the creator starts (hand 1 dealt). */
  view: TrucoMatchViewDTO | null;
}

/** POST /actions success body. */
export interface TrucoActionResponseDTO {
  matchId: string;
  view: TrucoMatchViewDTO;
  matchEnded: boolean;
  version: number;
  winnerUserId: string | null;
}

export interface PostActionArgs {
  expectedVersion: number;
  action: TrucoAction;
}

export type OpponentPresence = 'online' | 'offline' | 'unknown';

/**
 * Benign lost-race rejections (remediation #14b): the UI only offers actions
 * that were legal over the latest view, so a 409 CAS conflict or an engine
 * E_OUT_OF_TURN / E_STATE_FORBIDDEN means the rival moved concurrently and our
 * view was stale — the same recoverable class, treated identically: refetch
 * authority + amber "syncing" treatment, never a scary error.
 */
export function isBenignRaceRejection(
  err: { status?: number; errorCode?: string } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.status === 409) return true;
  return (
    err.status === 400 &&
    (err.errorCode === 'E_OUT_OF_TURN' || err.errorCode === 'E_STATE_FORBIDDEN')
  );
}

export function useTrucoMultiplayer(matchId: string) {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const friends = useFriendsStore((state) => state.friends);
  const onlineUsers = useFriendsStore((state) => state.onlineUsers);

  const query = useQuery({
    queryKey: ['truco-match', matchId],
    queryFn: () => api.get<TrucoMatchSnapshotDTO>(`/truco/matches/${matchId}`),
    enabled: Boolean(matchId),
    // S5 poll fallback ON THE QUERY — see module comment before touching this.
    refetchInterval: TRUCO_POLL_INTERVAL_MS,
  });

  const postAction = useMutation<TrucoActionResponseDTO, ApiError, PostActionArgs>({
    mutationFn: ({ expectedVersion, action }) =>
      api.post<TrucoActionResponseDTO>(`/truco/matches/${matchId}/actions`, {
        expectedVersion,
        action,
      }),
    // Server response is truth: merge authoritative fields into the cached
    // snapshot. No local rules logic, no optimistic mutation anywhere.
    onSuccess: (data) => {
      queryClient.setQueryData<TrucoMatchSnapshotDTO>(['truco-match', matchId], (old) =>
        old
          ? {
              ...old,
              version: data.version,
              view: data.view,
              status: data.matchEnded ? 'finished' : old.status,
              winnerUserId: data.matchEnded ? data.winnerUserId : old.winnerUserId,
            }
          : old,
      );
    },
    onError: (error) => {
      // Stale CAS AND benign lost races (E_OUT_OF_TURN / E_STATE_FORBIDDEN —
      // see isBenignRaceRejection): recover by refetching the authoritative
      // state — NEVER by patching local state. Genuinely hostile errors
      // (E_CARD_NOT_OWNED, 403, 404) surface via actionError for the page.
      if (isBenignRaceRejection(error)) {
        void queryClient.invalidateQueries({ queryKey: ['truco-match', matchId] });
      }
    },
  });

  // ── Push plumbing: ONE handler object, registered once, nulled on cleanup ──
  // connectSocket is idempotent and owns its own listeners; pages only swap
  // the handler object (MultiplayerPage setMatchFinishedHandler precedent),
  // so remounts/reconnects never duplicate registrations.
  useEffect(() => {
    if (!token || !matchId) return;
    connectSocket(token);
    setTrucoHandlers({
      onStateChanged: (payload) => {
        if (payload.matchId !== matchId) return;
        void queryClient.invalidateQueries({ queryKey: ['truco-match', matchId] });
      },
      onPlayerJoined: (payload) => {
        if (payload.matchId !== matchId) return;
        void queryClient.invalidateQueries({ queryKey: ['truco-match', matchId] });
      },
      onFinished: (payload) => {
        if (payload.matchId !== matchId) return;
        void queryClient.invalidateQueries({ queryKey: ['truco-match', matchId] });
      },
    });
    return () => setTrucoHandlers(null);
  }, [token, matchId, queryClient]);

  // ─── Viewer projection (slot mapping mirrors slotOf: host→A, guest→B) ──────

  const snapshot = query.data ?? null;
  const mySlot: PlayerSlot | null = snapshot
    ? snapshot.hostPlayerId === currentUserId
      ? 'A'
      : 'B'
    : null;
  const opponentUserId = snapshot
    ? mySlot === 'A'
      ? snapshot.guestPlayerId
      : snapshot.hostPlayerId
    : null;

  // Presence is only KNOWABLE for tracked friends (server gates presence
  // events by friendship); anything else stays honestly unknown.
  // Identity note: GET /friends rows carry { id: friendshipRowId,
  // friendId: friendUserId } — matching MUST use friendId (routes/friends.ts).
  let opponentPresence: OpponentPresence = 'unknown';
  if (opponentUserId && friends.some((friend) => friend.friendId === opponentUserId)) {
    opponentPresence = onlineUsers.has(opponentUserId) ? 'online' : 'offline';
  }

  return {
    /** Full authoritative snapshot (code/status/version/participants/view). */
    snapshot,
    /** Redacted per-viewer engine view (null until start). */
    view: snapshot?.view ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    mySlot,
    currentUserId,
    opponentUserId,
    opponentPresence,
    postAction,
    actionError: postAction.error,
    isActing: postAction.isPending,
  };
}
