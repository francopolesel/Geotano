# Tasks: Real-time match result delivery (multiplayer-result-delay)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 290–330 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (slices: service → route → frontend) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Guard: if the apply diff exceeds 400 changed lines, stop and escalate for a `size:exception` decision.

### Suggested Work Units (all land in PR 1, base = main)

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Backend service atomic completion + concurrency tests | Tests included |
| 2 | Route emit `match:finished` + route test | Depends on unit 1 |
| 3 | Frontend socket + MultiplayerPage + tests | Depends on unit 2 |

## Phase 1: Backend service — atomic completion (TDD)

- [x] 1.1 RED — `matchService.test.ts`: extend queue-mock with a fresh re-read after every finish UPDATE; add failing tests — both-finished completes from fresh scores; single-finisher no-op; fresh-score winner; D7 concurrency (two `finishMatch` fed the SAME stale snapshot → one completion UPDATE, winner from fresh scores, no stuck `in_progress`); idempotent repair. Assert DB call ORDER explicitly (mock invocation order), never timing.
- [x] 1.2 GREEN — `matchService.ts`: add `completeMatchIfBothFinished(matchId, player1Id, player2Id)` — fresh SELECT of flags+scores+status+winnerId → completed? both finished? → `determineWinner` → conditional UPDATE → `{matchEnded, winnerId}`.
- [x] 1.3 GREEN — rewire `submitAnswer` completion block (:508-524) to call helper; drop stale-score/`otherFinished` logic.
- [x] 1.4 GREEN — rewire `markPlayerFinished` (incl. time-expiry call site :448) to call helper; drop stale params.
- [x] 1.5 GREEN — `finishMatch` idempotent branch (:412-419) → `{finished:true, ...await completeMatchIfBothFinished(...)}`.
- [x] 1.6 VERIFY — `pnpm --filter @geotano/backend test` + `tsc --noEmit`.

## Phase 2: Backend route — emit match:finished (TDD)

- [x] 2.1 RED — create `matches.routes.test.ts` (Fastify inject; mock db/authGuard/matchService/notifications/socket): assert `io.to(sid).emit('match:finished', {matchId, status:'completed'})` to BOTH players' sids from `answer` AND `finish` when `matchEnded`; no emit otherwise.
- [x] 2.2 GREEN — `routes/matches.ts`: add `emitMatchFinished(matchId, player1Id, player2Id)` (`getIO()` + `getUserSocketIds()` loop, mirror `challenge:accepted` :177-185); call in `answer` (:254) and `finish` (:274) when `result.matchEnded`, IDs from `getMatchState(id)`.
- [x] 2.3 VERIFY — route test green + `tsc --noEmit`.

## Phase 3: Frontend socket subscription (TDD)

- [x] 3.1 RED — `socket.test.ts` (lib) + `MultiplayerPage.test.tsx` mock: add `setMatchFinishedHandler` to the socket mock; capture handler; invoke → assert result transition.
- [x] 3.2 GREEN — `lib/socket.ts`: `MatchFinishedHandler` type, module `onMatchFinished`, `setMatchFinishedHandler(handler|null)` (mirror `setChatMessageHandler`), `socket.on('match:finished')` inside `connectSocket` (survives reconnects).
- [x] 3.3 VERIFY — frontend `tsc --noEmit` + vitest.

## Phase 4: MultiplayerPage wiring (TDD)

- [x] 4.1 RED — `MultiplayerPage.test.tsx`: mount calls `connectSocket(token)`; captured handler → refetch `GET /matches/:id` → result; `handleTimeUp` `matchEnded:true` → result without poll; unmount cleanup `setMatchFinishedHandler(null)`.
- [x] 4.2 GREEN — `MultiplayerPage.tsx`: mount effect registers stable `handleMatchFinished` (useCallback, NO re-subscribe per render; guard `payload.matchId===matchId` + screen ref `!=='result'`; if `status==='completed'`: setMatch, setMatchEnded, buildResult, setScreen('result')); cleanup = `setMatchFinishedHandler(null)`, MUST NOT call `disconnectSocket()` (module singleton — AppShell does NOT own the socket; NotificationBell connects, FriendsPage disconnects on unmount; React cleanup-before-mount + idempotent `connectSocket` make placement safe); fix `handleTimeUp` (:239-244) → `setMatchEnded(true)` + `setScreen('result')`.
- [x] 4.3 VERIFY — full frontend vitest + `tsc --noEmit`; confirm no new i18n keys.

## Phase 5: Final verification

- [x] 5.1 Run `npm run test:backend`, `npm run test:frontend`, `npm run check-types`; map spec scenarios: Real-time arrival, Simultaneous finish, Fresh-score winner, Time-up direct transition, Poll fallback.
- [x] 5.2 Manual smoke: missed-event poll fallback, multi-device emit. (Validated at unit level: route test asserts `match:finished` emitted to ALL socket ids of both players incl. multi-device `sid-1a/sid-1b`; poll fallback covered by unchanged poll effect + waiting-screen tests. No live dev-server smoke in this environment.)
