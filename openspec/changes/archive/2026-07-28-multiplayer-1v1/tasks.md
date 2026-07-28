# Tasks: 1v1 Multiplayer Mode

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750–850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (backend) → PR 2 (frontend) |
| Delivery strategy | auto-forecast |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend core — types, matchService, socket handlers | PR 1 | Shared types + matchService.ts + socket/index.ts handlers; merges to main |
| 2 | Frontend — store, hook, page, friends integration, route | PR 2 | Depends on PR 1 event contracts; merges to main |

## Phase 1: Foundation — Shared Types

- [x] 1.1 Add `ChallengeInvitePayload`, `MatchStartPayload`, `MatchAnswerPayload`, `PlayerStats`, `MatchResult`, `RejoinState` to `packages/shared/src/types/index.ts`
- [x] 1.2 Add `'challenge_invite'` to `NotificationType` union if needed for UI

## Phase 2: Core — Backend Match Service

- [x] 2.1 Create `apps/backend/src/services/matchService.ts` with `MatchState`, `PlayerMatchState`, in-memory maps (`challenges`, `matches`, `userMatchMap`)
- [x] 2.2 Implement challenge lifecycle: `createChallenge()`, `acceptChallenge()`, `declineChallenge()`, `cancelChallenge()` with 30s timeout via `setTimeout`
- [x] 2.3 Implement `generateMatch()` — 50-question pool via `generateQuestionBatch`, per-player shuffle, store in `MatchState`
- [x] 2.4 Implement `calculateRaceScore()` — base 100 pts, streak ×1.5 at 3+, no speed bonus, wrong = 0 (resets streak)
- [x] 2.5 Implement shared 3-min server timer via `setInterval(250ms)`, derive from `Date.now()`, detect `both_finished` early end
- [x] 2.6 Implement disconnect handling: record timestamp, 60s `setTimeout` grace, forfeit on expiry, abandon on both disconnect
- [x] 2.7 Implement `rejoinMatch()` — validate within grace window, return current question + remaining time + opponent stats

## Phase 3: Integration — Backend Socket Handlers

- [x] 3.1 Add `challenge:send`, `challenge:cancel`, `challenge:accept`, `challenge:decline` handlers to `apps/backend/src/socket/index.ts`
- [x] 3.2 Add `match:answer` handler — validate answer, score, emit `match:question` + `match:opponent_answered`, check end conditions
- [x] 3.3 Add `match:rejoin` handler — call `rejoinMatch()`, add socket to room, emit `match:rejoined`
- [x] 3.4 Extend `disconnect` handler in `apps/backend/src/socket/index.ts` — call `matchService.handleDisconnect()`, trigger disconnect flow in matchService

## Phase 4: Core — Frontend Store + Hook

- [x] 4.1 Create `apps/frontend/src/store/multiplayerStore.ts` — Zustand store with `screen`, `matchId`, `opponent`, `question`, `score`, `streak`, `opponentAnswered`, `remainingMs`, `result`, and all actions
- [x] 4.2 Create `apps/frontend/src/features/multiplayer/useMultiplayerSocket.ts` — register `match:question`, `match:opponent_answered`, `match:timer_tick`, `match:end` listeners; cleanup on unmount

## Phase 5: UI — Multiplayer Page + Friends Integration

- [x] 5.1 Add `challenge:invite` listener to `apps/frontend/src/lib/socket.ts` — show floating accept/reject popup
- [x] 5.2 Add "Desafiar" ⚔️ button per online friend in `apps/frontend/src/features/friends/FriendsPage.tsx`, gated by `onlineUsers.has()`
- [x] 5.3 Add `/multiplayer/:matchId` route (under `AuthGuard`/`AppShell`) in `apps/frontend/src/app/App.tsx`
- [x] 5.4 Create `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` — three screens: lobby (awaiting accept), playing (race UI with shared timer, opponent indicator), ended (side-by-side stats)

## Phase 6: Testing (Frontend)

- [x] 6.1 Write unit tests for `multiplayerStore` — 14 tests covering all actions and state transitions
- [x] 6.2 Write unit tests for `useMultiplayerSocket` — 9 tests covering listener registration, event handling, cleanup
- [x] 6.3 Write integration tests for socket listeners — 10 tests for challenge:invite, emit helpers
- [x] 6.4 Write component tests for `MultiplayerPage` — 15 tests covering lobby, playing, ended screens

## Phase 6 (Backend — completed in PR 1)

- [x] 6.1b Write unit tests for `calculateRaceScore()` — base, streak ×1.5, wrong reset, no speed bonus
- [x] 6.2b Write unit tests for challenge lifecycle — send/accept/decline/cancel/timeout
- [x] 6.3b Write integration test for full match flow: challenge → accept → answer → end
- [x] 6.4b Write integration tests for disconnect scenarios: 60s rejoin, grace expiry, both disconnect → abandoned, tie outcome
