# Delta for truco-multiplayer (NEW capability)

> New capability — all-ADDED. Server-authoritative, DB-backed friend 1v1. Mirrors existing matchService precedents (authGuard, ownership checks, idempotency, `{ message }` + `errorCode` errors, `.toISOString()` dates) and the hybrid push+poll delivery already used by matches. Uses dedicated `truco_*` tables; quiz challenge/match lifecycle is NOT generalized.

## ADDED Requirements

### Requirement: Match creation and room code format

An authenticated user MUST be able to create a truco match (choosing target 15/30) and receive a room code. The code MUST match `^[A-HJ-NP-Z2-9]{6}$` (32-char unambiguous alphabet: no 0/O/I/L), MUST be unique among active (non-expired, unfinished) matches, and MUST be generated server-side with a cryptographically random source. Optionally the creator MAY attach a friend id, which sends a `truco:invite` socket event mirroring the existing `challenge:invite` pattern.

#### Scenario: Code shape and uniqueness

- GIVEN 1,000 created matches
- THEN every code satisfies the regex and no two active matches share a code

#### Scenario: Create response

- GIVEN an authenticated creator POSTs `/api/truco/matches` with targetPoints=30
- WHEN creation succeeds
- THEN the response contains `matchId`, `code`, `status='waiting'`, and the creator as sole participant

### Requirement: Join, wait, start flows

A second authenticated user MUST join by code via `POST /api/truco/matches/code/:code/join`. Joining MUST fail with 404 for unknown/expired codes and 409 if the match is not in `waiting`. On join, status becomes `ready` and both players are notified (`truco:player-joined`). Only the creator MAY start via `POST /api/truco/matches/:id/start`, only from `ready`; start deals hand 1 (server-side engine, mano assigned), sets status `playing`, bumps version to 1, and pushes state. Friendship IS required on the invite flow; code-join treats the code itself as the capability (documented decision).

#### Scenario: Full happy path

- GIVEN A created a match and B holds the code
- WHEN B joins and A starts
- THEN both clients reach an identical playing state with version ≥ 1

#### Scenario: Third player rejected

- GIVEN a `ready` match
- WHEN user C attempts to join
- THEN 409 with errorCode `match_not_joinable`

### Requirement: DB persistence survives restart

Every truco match MUST be one durable row containing at minimum: id, code, hostPlayerId, guestPlayerId (nullable), status, targetPoints, engine state as JSONB, monotonic integer `version`, timestamps, nullable finishedAt/winnerUserId. State MUST be written through on every mutation such that killing and restarting the backend loses NOTHING: any client reloading after restart resumes the exact current state.

#### Scenario: Survives cold start

- GIVEN a match mid-hand
- WHEN the backend process is stopped and restarted
- THEN GET of the match returns the identical engine state and version, and play continues

### Requirement: Version-based optimistic concurrency

Every action request MUST carry `expectedVersion`. The server MUST reject with 409 + errorCode `version_conflict` when it does not equal the stored version. Valid actions MUST be applied inside a transaction that persists new state AND `version = oldVersion + 1` atomically. Retrying a stale request yields 409 (no double-apply); the client recovers by refetching authoritative state.

#### Scenario: Concurrent conflicting actions

- GIVEN both players submit actions with expectedVersion = v simultaneously
- WHEN the first commit lands
- THEN the second receives 409 `version_conflict` and the stored version is exactly v+1 with only the first action applied

#### Scenario: Replay safety

- GIVEN the winner's action request is retried verbatim after success
- THEN the retry hits version mismatch (409), never duplicating the move

### Requirement: Server-authoritative validation

The backend MUST run every action through the shared `truco-engine` before persisting: actor must be an authenticated participant (authGuard + ownership check), the action legal per engine (typed rejection mapped to 400 with the engine's error code), and the resulting state recomputed SERVER-side from stored state. Client-sent state fields MUST be ignored entirely.

#### Scenario: Illegal action rejected without mutation

- GIVEN a stale or illegal payload (e.g., envido after first card)
- WHEN submitted by a participant
- THEN 400 carries the engine error code and stored version/state are unchanged

#### Scenario: Non-participant blocked

- GIVEN an authenticated user who is neither host nor guest
- WHEN submitting any action or GETting the private view
- THEN 403

### Requirement: Redacted per-viewer state DTO

State reads MUST be per-viewer: the requester sees their own hand fully; the opponent's hand MUST appear ONLY as a count of remaining cards. All public info MUST be included identically for both viewers: played cards with owners, call/answer history, envido results once settled, scores, target, mano/leader, whose turn, pending bet, phase, version.

#### Scenario: Opponent hand never leaks over REST

- GIVEN viewer A fetches match state mid-hand
- WHEN the JSON is inspected
- THEN no field contains B's unrevealed cards

### Requirement: Socket push events with poll fallback

After every committed mutation the server MUST emit `truco:state-changed` with payload `{ matchId: string; version: number; reason: 'start'|'action'|'finish' }` to BOTH players' connected sockets via the existing `getUserSocketIds(userId)` direct-emit pattern on the single default namespace. Additional events: `truco:invite` `{ matchId, code, fromUser }`, `truco:player-joined` `{ matchId, players: [{userId, nickname}, {userId, nickname}] }`, `truco:finished` `{ matchId, winnerUserId }`. Clients MUST refetch authoritative state upon `state-changed`; a ≤10s poll MUST remain active as fallback exactly like the existing multiplayer page pattern. Handlers MUST follow the register-on-connect setter pattern so remounts/reconnects never duplicate or lose listeners.

#### Scenario: Instant opponent update

- GIVEN B is viewing the match when A's action commits
- THEN B receives `truco:state-changed` within ~1s and the UI reflects A's move after refetch, without waiting for the poll tick

#### Scenario: Poll fallback

- GIVEN B's socket was disconnected during A's move
- WHEN the next ≤10s poll runs
- THEN B still converges to the same state/version

#### Scenario: Listener hygiene

- GIVEN the truco page mounts, unmounts, and remounts across a socket reconnect
- THEN exactly one handler set processes each event (no duplicated applications)

### Requirement: Disconnect, reload, and resume semantics

Reloading or reconnecting MUST restore the full current match screen from `GET /api/truco/matches/:id` (or by code) at any time before expiry. There is NO auto-forfeit on disconnect in v1; the match simply waits, and the disconnected player resumes on return. The waiting player's UI SHOULD indicate the opponent's absence (presence via socket online/offline events already available). Finished matches remain readable until cleanup.

#### Scenario: Reload mid-betting

- GIVEN a retruco awaits A's answer
- WHEN A reloads the page
- THEN A sees the identical pending bet and can answer immediately

#### Scenario: Resume after backend spin-down

- GIVEN Render spun the backend down overnight mid-match
- WHEN both players return and the backend cold-starts
- THEN the match continues from persisted state

### Requirement: Expiry cleanup parity

Unfinished truco matches older than 24 hours since last update MUST be deleted/expired by the SAME hourly job infrastructure as the existing `deleteExpiredMatches` (extended or sibling function registered in `index.ts`). Finished matches follow the same 24h retention to bound growth, mirroring quiz cleanup behavior.

#### Scenario: Expired match unreachable

- GIVEN an unfinished match untouched for >24h
- WHEN the hourly cleanup runs and a client then GETs it or joins its code
- THEN the result is 404 and the code is reusable

### Requirement: Completion and finish sync

When the engine reaches match_end the server MUST persist final scores/winner, set status `finished`, emit `truco:finished` plus a final `state-changed`, and both clients MUST land on the end screen showing the outcome. Errors across all truco routes use `{ message }` (+errorCode) shapes; 401 unauthenticated, 403 forbidden/non-participant, 404 unknown id/code, 409 conflict/wrong-status.

#### Scenario: Match end observed by both

- GIVEN the winning card resolves the match
- WHEN both clients settle
- THEN both show the end screen with identical final scores and winner
