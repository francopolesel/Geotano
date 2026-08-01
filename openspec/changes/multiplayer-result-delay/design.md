# Design: Real-time match result delivery

## Technical Approach

Eliminate the completion race by re-reading both finished flags + scores in a fresh statement after every finish write (last writer always observes the other flag under Postgres READ COMMITTED), then push `match:finished` to both players over the existing socket channel. Frontend subscribes on match mount and refetches canonical match state on the event; the 10s poll stays as fallback. All changes additive; no schema changes.

## Architecture Decisions

### D1. Atomic completion: re-read, then conditional UPDATE
**Choice**: After persisting the finished flag (or score+flag), run a fresh `SELECT` of both flags, both scores, `status`, `winnerId`; if both finished → compute winner in JS (`determineWinner`) and `UPDATE status='completed', winner_id`; if already `completed` → return stored winner id (idempotent).
**Alternatives**: Single `UPDATE ... WHERE player1_finished AND player2_finished RETURNING winner_id`. Rejected: winner logic in SQL (CASE) duplicates `determineWinner`, drizzle CASE is awkward, and the mock test queue can't easily model it.
**Rationale**: `submitAnswer` commits a player's final score in the SAME statement as their finished flag, so any snapshot seeing both flags true also sees frozen final scores → both concurrent finishers compute identical winners. Two statements are safe under READ COMMITTED because the completion UPDATE is idempotent. Matches drizzle + JS conventions and the existing chainable-mock test stack.

Shared helper in `matchService.ts`:
```ts
async function completeMatchIfBothFinished(matchId, player1Id, player2Id):
  fresh = select(player1Score, player2Score, player1Finished, player2Finished, winnerId, status)
         from matchGames where id = matchId limit 1
  if !fresh → { matchEnded:false, winnerId:null }
  if fresh.status === 'completed' → { matchEnded:true, winnerId:fresh.winnerId }
  if !(both finished) → { matchEnded:false, winnerId:null }
  winner = determineWinner(fresh.player1Score, fresh.player2Score)
  update matchGames set {status:'completed', winnerId} where id = matchId
  → { matchEnded:true, winnerId }
```
Call sites: `markPlayerFinished` (after its flag UPDATE; drop stale `otherFinished`/score params), `submitAnswer` (after score+flag UPDATE, replacing lines 508-524), `finishMatch` idempotent branch.

### D2. finishMatch idempotent branch fix (:412-419)
**Choice**: Replace the early return with `return { finished:true, ...(await completeMatchIfBothFinished(matchId, match.player1Id, match.player2Id)) }`.
**Rationale**: Same helper writes completion when both flags true + `status != 'completed'` — repairs the stuck row and now returns `winnerId` correctly instead of `match.winnerId` (null).

### D3. Socket emit lives in the ROUTE layer
**Choice**: `matches.ts` gains local helper `emitMatchFinished(matchId, player1Id, player2Id)` → `getIO()` + `getUserSocketIds()` loop, emitting `match:finished` `{matchId, status:'completed'}` (mirror of `challenge:accepted`, :177-185). Called from BOTH `answer` and `finish` handlers when `result.matchEnded`; player IDs from `await matchService.getMatchState(id)` (one extra SELECT per completion, negligible).
**Alternatives**: Emit from service. Rejected: service would import `socket/index.ts`, breaking the route-owns-push convention and coupling persistence to sockets.
**Rationale**: Route is the place with socket access + can obtain both player IDs; single refetch keeps the service API contract unchanged (smaller test churn). Emit to all sockets of both users (multi-device safe).

### D4. Frontend subscribe API
**Choice**: `socket.ts` adds module-level `onMatchFinished` + `setMatchFinishedHandler(handler|null)` (exact `setChatMessageHandler` pattern); `socket.on('match:finished', ...)` registered inside `connectSocket` so it survives reconnects.
**Rationale**: Consistent with existing handler pattern; page-scoped cleanup avoids leaks. Direct `getSocket().on(...)` rejected (duplicate listeners across remounts, null socket window).

### D5. Connect socket on match mount
**Choice**: MultiplayerPage mount effect: `if (token) connectSocket(token)` + `setMatchFinishedHandler(handleMatchFinished)`; cleanup: `setMatchFinishedHandler(null)` (no disconnect — AppShell owns global socket).
**Rationale**: React runs unmount cleanups before mount effects, so FriendsPage's `disconnectSocket()` always precedes our `connectSocket(token)` — no race. `connectSocket` is idempotent (`socket?.connected` early return). The brief disconnected window is covered by mount fetch + poll.

### D6. handleTimeUp fix
**Choice**: In `.then((data) => ...)` `matchEnded` branch, after `buildResult(updated)`: `setMatchEnded(true)` + `setScreen('result')`.

### D7. Concurrency test shape (service-level, mocked DB)
**Choice**: No real-DB infra exists in the backend stack (every test mocks `db` with a queue). Encode both interleavings at the mock level in `matchService.test.ts`: two `finishMatch` calls fed the SAME stale snapshot (both see `other.finished=false`), with the fresh re-read returning the committed state; assert completion UPDATE fires exactly once, `winnerId` from fresh scores, no stuck `in_progress`.

## Data Flow

```
Player A (last finisher)         matchService              match_games              matches.ts route        sockets
   POST /answer|/finish ──► submitAnswer/finishMatch
                               UPDATE flag|score ───────────►
                               SELECT fresh (flags+scores) ─► (sees both true)
                               UPDATE completed/winner ─────►
   ◄── { matchEnded:true } ── return
                               (route) getMatchState(id) ──►
                               emitMatchFinished(p1,p2) ──────────────────────────────► match:finished {matchId,status}
   ◄── match:finished ──────────────────────────────────────────────────────────────────
   GET /matches/:id → buildResult → setScreen('result')        (poll = fallback path)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/src/services/matchService.ts` | Modify | Add `completeMatchIfBothFinished`; rewire `markPlayerFinished` (drop stale params), `submitAnswer` completion block (:508-524), `finishMatch` idempotent branch (:412-419) |
| `apps/backend/src/routes/matches.ts` | Modify | Add `emitMatchFinished`; call in `answer` (:254) and `finish` (:274) handlers when `result.matchEnded` |
| `apps/frontend/src/lib/socket.ts` | Modify | `MatchFinishedHandler` type, `onMatchFinished`, `setMatchFinishedHandler`, `socket.on('match:finished')` in `connectSocket` |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Modify | Mount effect (connect + register handler), `handleMatchFinished` callback, `handleTimeUp` `setScreen('result')` fix |
| `apps/backend/src/__tests__/matchService.test.ts` | Modify | Extend mock queue for fresh re-read in every submit/finish test; add D7 concurrency tests + idempotent repair test |
| `apps/backend/src/__tests__/matches.routes.test.ts` | Create | Emit tests: mock `matchService` (matchEnded=true) + `getMatchState` + `socket/index`; assert `io.to(sid).emit('match:finished', {matchId, status:'completed'})` |
| `apps/frontend/src/__tests__/MultiplayerPage.test.tsx` | Modify | Add `setMatchFinishedHandler` to the socket mock; capture handler; simulate event → result transition; time-up matchEnded test |

## Interfaces / Contracts

```ts
// matches.ts (internal)
function emitMatchFinished(matchId: string, player1Id: string, player2Id: string): void

// socket.ts
type MatchFinishedHandler = (payload: { matchId: string; status: string }) => void;
export function setMatchFinishedHandler(handler: MatchFinishedHandler | null): void;

// Event (server → client), registered inside connectSocket():
// 'match:finished' → { matchId, status: 'completed' }
```

Client sequence on event (spec design note): `event` → guard `payload.matchId === matchId` + `screen !== 'result'` → `GET /matches/:id` → if `status==='completed'`: `setMatch`, `setMatchEnded(true)`, `buildResult`, `setScreen('result')` (poll effect auto-cleans on screen change). Rematch: socket already connected from mount; `handleRematch`'s `connectSocket(token)` becomes harmless idempotent redundancy.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (backend service) | Both-finished completion from fresh scores; single-finisher no-op; idempotent repair branch writes completion | `matchService.test.ts`, queue-mock; assert `db.update` completion call + `matchEnded`/`winnerId` |
| Unit (concurrency) | D7 both interleavings; stale-score winner fixed | Same file; two calls sharing a stale snapshot; assert one completion UPDATE, winner from fresh scores |
| Unit (backend route) | `match:finished` emitted to both players' sockets on `matchEnded` from answer AND finish | New `matches.routes.test.ts` (Fastify inject + mocked service/socket) |
| Unit (frontend) | Socket event → my_finished → result; `handleTimeUp` matchEnded → result without poll; `connectSocket(token)` called on mount | `MultiplayerPage.test.tsx`; capture handler from `setMatchFinishedHandler`, invoke, assert result screen |
| Manual | Poll fallback on missed event; multi-device | E2E smoke via dev stack |

## Migration / Rollout

No migration, no flags. Rollback: revert backend emit + re-read (keep poll path) and frontend listener/connect; poll still delivers results.

## Open Questions

- [ ] None blocking. (Product Qs on DB-notification push and live indicator are out of scope per proposal.)

## Delivery Forecast

`Decision needed before apply: No` · `Chained PRs recommended: No` · `400-line budget risk: Medium` (~290-330 changed lines, driven by test updates)
