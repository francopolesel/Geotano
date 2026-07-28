# Design: Async Multiplayer

## Technical Approach

Replace in-memory Socket.IO multiplayer with DB-backed async model. New Drizzle tables for challenges + matches. REST endpoints for lifecycle and gameplay. Frontend reuses solo quiz components for match play. Timer is per-player, starting when they click "Play".

## Architecture Decisions

### Decision: DB table layout

**Choice**: `match_challenges` + `match_games` as separate tables
**Alternatives**: Single `match_games` table (no challenge table), embedded JSON
**Rationale**: Two tables avoid nullable columns and keep challenge lifecycle (pending/declined/cancelled) separate from gameplay state (in_progress/done/completed). Matches existing pattern of `friends` (status-based) + `game_sessions` (score-based).

### Decision: API over Socket.IO for gameplay

**Choice**: REST endpoints for match play; Socket.IO stays only for chat/notifications/online/challenge:invite
**Alternatives**: Keep WebSocket match events with DB persistence
**Rationale**: Async play doesn't need real-time. REST is simpler to test, debug, and cache. Socket.IO overhead for occasional answer submissions is wasted.

### Decision: Per-player fixed timer

**Choice**: 3-minute timer starts when player hits "Play", stored as `started_at` + fixed duration
**Alternatives**: No timer (play whenever), shared timer (old model), N-hour wall-clock
**Rationale**: 3 minutes matches solo mode feel. Server-side deadline prevents indefinite matches.

## Data Flow

```
Challenge Flow:
  [FriendsPage] ⚔️ + mode picker → POST /matches/challenge
    → INSERT match_challenges
    → Socket.IO: challenge:invite to receiver (if online)
    → return challenge_id

Accept Flow:
  [Receiver] → POST /matches/accept { challengeId }
    → INSERT match_games (status: pending)
    → generate 50 questions, persist to match_questions
    → UPDATE match_challenges status → accepted

Play Flow:
  [Player] → POST /matches/:id/play
    → UPDATE match_games started_at = now() (per player)
    → status → in_progress
    → return first question

Answer Flow:
  [Player] → POST /matches/:id/answer { optionIndex }
    → Validate, calculate score (reuse calculateRaceScore)
    → INSERT match_answer
    → Return next question or finished flag
    → If both finished → determine winner → match_games.winner_id

Match History:
  [Any page] → GET /matches/history
    → Query match_games WHERE player1_id OR player2_id = userId
    → Return status, scores, winner, mode
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/db/schema/matchChallenges.ts` | Create | Drizzle table for persistent challenges |
| `apps/backend/src/db/schema/matchGames.ts` | Create | Drizzle table for match state + scores |
| `apps/backend/src/db/schema/matchAnswers.ts` | Create | Per-player answer records within a match |
| `apps/backend/src/db/schema/index.ts` | Modify | Export new schema modules |
| `apps/backend/src/services/matchService.ts` | Rewrite | Replace in-memory with DB queries |
| `apps/backend/src/routes/matches.ts` | Create | New REST endpoints for match lifecycle |
| `apps/backend/src/routes/index.ts` | Modify | Register matches route |
| `apps/backend/src/socket/index.ts` | Modify | Remove gameplay events (6 events: match:start, match:question, match:answer, match:opponent_answered, match:timer_tick, match:end) — keep challenge lifecycle events |
| `apps/frontend/src/lib/socket.ts` | Modify | Remove match-event listeners from connectSocket; add `setNavigateFn` (already done) |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Rewrite | Replace real-time match UI with async play UI |
| `apps/frontend/src/features/multiplayer/useMultiplayerSocket.ts` | Delete | No longer needed (removed in socket.ts) |
| `apps/frontend/src/features/multiplayer/MatchHistory.tsx` | Create | New tab for Friends page listing matches |
| `apps/frontend/src/features/friends/FriendsPage.tsx` | Modify | Add Match History tab + game mode picker modal on ⚔️ |
| `apps/frontend/src/store/multiplayerStore.ts` | Simplify | Keep only challengeNotification state; remove real-time match state |
| `packages/shared/src/types/index.ts` | Modify | Add match-related types (MatchChallenge, MatchGame, MatchAnswer) |

## Interfaces / Contracts

```typescript
// New shared types
interface MatchChallenge {
  id: string;
  challengerId: string;
  receiverId: string;
  gameModeSlug: GameModeSlug;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

interface MatchGame {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  gameModeSlug: GameModeSlug;
  player1Score: number;
  player2Score: number;
  player1Finished: boolean;
  player2Finished: boolean;
  player1StartedAt: string | null;
  player2StartedAt: string | null;
  winnerId: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

// REST endpoints
POST /matches/challenge       → { receiverId, gameModeSlug }
POST /matches/accept          → { challengeId }
POST /matches/:id/play        → { matchId }
POST /matches/:id/answer      → { optionIndex }
GET  /matches/:id             → MatchGame + current question
GET  /matches/history         → MatchGame[]
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | matchService scoring (can reuse existing tests) | Keep existing calculateRaceScore tests |
| Integration | DB challenge/match CRUD, answer submission, winner determination | Drizzle test db or mocked db |
| E2E | Full flow: challenge → accept → play → finish → compare | REST API calls with test users |

## Migration / Rollout

No migration required — no existing match/challenge data in production. New tables created via `drizzle-kit generate` + `drizzle-kit migrate`.

## Open Questions

- [ ] Should the match timer be 3 min like solo, or longer for async? (User's preference — proposed 3 min from "Play" click)
- [ ] Auto-forfeit time? If a player never starts, should the match expire?
- [ ] Should the challenging mode picker also show the mode description?
