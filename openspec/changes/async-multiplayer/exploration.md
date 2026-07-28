# Exploration: async-multiplayer

## Current State

- **Challenges**: In-memory `Map<string, Challenge>` with 30s timeout. Backend rejects if receiver not online. Created via `challenge:send` socket event.
- **Matches**: In-memory `Map<string, MatchState>`. Both players connected via Socket.IO simultaneously. Shared 3-min timer. Questions pre-generated (50) with per-player shuffle. All gameplay is real-time via WebSockets.
- **Game mode**: Hardcoded to `'free'` in `matchService.generateMatch()`. No mode selection when challenging.
- **Persistence**: Zero. No DB tables for multiplayer. All state lost on server restart.
- **Timers**: Single shared `setInterval` per match. 250ms tick resolution.

## Affected Areas

- `apps/backend/src/services/matchService.ts` — replace entirely with DB-backed service
- `apps/backend/src/socket/index.ts` — remove match gameplay events, keep challenge lifecycle + chat/notifications
- `apps/backend/src/db/schema/` — add `match_challenges` and `match_games` tables
- `apps/backend/src/routes/` — add REST endpoints for match history + async gameplay
- `apps/frontend/src/lib/socket.ts` — remove match:answer and match-event listeners from socket
- `apps/frontend/src/features/multiplayer/` — new "play match" flow (no longer real-time)
- `apps/frontend/src/features/friends/FriendsPage.tsx` — add game mode picker before challenging
- `apps/frontend/src/features/friends/` — new MatchHistory page/tab
- `apps/frontend/src/store/multiplayerStore.ts` — simplify, no real-time state needed
- `packages/shared/src/types/index.ts` — new shared types for match/challenge

## Approaches

1. **Full async replacement** — Replace entire in-memory multiplayer system with DB-backed async model. Challenges persistent in DB. Each player plays independently via HTTP (like solo quiz). Scores compared when both finish.
   - Pros: No dual code paths, simpler UX, matches survive restarts, naturally supports match history
   - Cons: More upfront work, removes the real-time synchronous play option
   - Effort: High

2. **Hybrid (async challenges + dual match models)** — Async for challenges/mode selection/history, but keep real-time gameplay when both happen to be online
   - Pros: Preserves existing synchronous play
   - Cons: Two code paths, confusing UX ("challenge" could mean different things), higher maintenance
   - Effort: Very High

## Recommendation

**Approach 1 (full async replacement).** The user explicitly said both players don't need to be connected simultaneously. The real-time model adds complexity (Socket.IO match rooms, shared timers, reconnection logic) without value for the target use case. The async model is simpler and more robust: challenges persist, matches survive server restarts, and match history is a natural byproduct.

Key changes:
- `match_games` table: player1_id, player2_id, game_mode_slug, player1_score, player2_score, player1_finished, player2_finished, winner_id, status
- API endpoints for: list pending challenges, challenge a friend (with mode), accept/decline, get match state, submit answer, list match history
- Per-player timer: 3 min from when they start. Fixed question pool (50) at match creation.
- Socket.IO: remove match gameplay events. Keep: notifications, chat, online presence, challenge:invite for live notification.

## Risks

- Migrating from in-memory to DB: any active in-memory matches when deployed will be lost (acceptable for MVP — no production matches exist yet)
- Question pool generation at match creation time needs to be async (DB calls)
- Per-player timer needs server-side enforcement: if player doesn't finish within N hours, auto-forfeit

## Ready for Proposal

Yes
