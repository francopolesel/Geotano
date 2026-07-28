/**
 * Multiplayer socket listeners — currently disabled.
 *
 * With the async multiplayer model, match events no longer flow through
 * Socket.IO. The MultiplayerPage will use REST polling instead.
 *
 * TODO (Phase 4): Replace with match state polling via GET /api/matches/:id
 */
export function useMultiplayerSocket(_matchId: string) {
  // no-op
}
