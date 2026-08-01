# Proposal: Real-time match result delivery

## Intent

When both players finish a 1v1 match, the result screen is delayed 0–10s (avg ~5s) because completion is only discovered via 10s polling. A backend race can also stick a match `in_progress` forever (both `finished=true`, `winnerId=null`) when both players finish simultaneously. Fix: atomic completion, socket push, frontend reaction.

## Scope

### In Scope
- Backend: atomic completion — after setting a finished flag, re-read both flags + scores fresh so the last finisher always completes (`matchService.ts:374, 509`). Also fix `finishMatch` idempotent branch (`:412-419`) to write completion when both are finished.
- Backend: emit `match:finished` (matchId, status) on completion via `getIO()` + `getUserSocketIds()` (pattern: `routes/matches.ts:177-185`).
- Frontend: connect socket on match-screen mount; subscribe to `match:finished` in `lib/socket.ts`; `my_finished → result` on receipt; poll kept as fallback.
- Frontend: fix `handleTimeUp` to `setScreen('result')` when `matchEnded` (`MultiplayerPage.tsx:239-244`).

### Out of Scope
- No UI redesign of waiting/result screens; poll stays (push is additive).
- No match-history page changes.
- No unordered-pair index (single-row race; not needed).
- No disconnect/grace-period changes; no live "opponent finished" indicator; no i18n additions.

## Capabilities

> Contract between proposal and specs phases.

### New Capabilities
- None

### Modified Capabilities
- `multiplayer-1v1-mode` — End screen requirement: results pushed in real time; match MUST complete atomically on simultaneous finish (no stuck `in_progress`).

## Approach

1. Backend: after each finished-flag UPDATE, re-read both flags + scores in a fresh statement; complete when both true. The last finisher always observes both → READ COMMITTED race eliminated; also removes stale-score winner risk.
2. On completion, emit `match:finished` to both players' sockets (mirror `challenge:accepted`).
3. Frontend: `connectSocket(token)` on mount (singleton, idempotent); on event → set match, `matchEnded`, `result`; poll remains fallback for reconnect/offline.
4. Fix `handleTimeUp` to transition to result when the finish response reports `matchEnded`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/backend/src/services/matchService.ts` | Modified | Atomic completion; idempotent `finishMatch` fix |
| `apps/backend/src/routes/matches.ts` | Modified | Emit `match:finished` on completion |
| `apps/frontend/src/lib/socket.ts` | Modified | New `match:finished` listener |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Modified | Socket connect, event handler, `handleTimeUp` fix |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Completion race regression | Med | TDD concurrent-finish test; re-read after update |
| Push lost (offline/reconnect) | Med | Poll fallback kept; client refetches on event |
| Winner computed from stale score | Med | Re-read scores in fresh statement |
| Socket killed by FriendsPage cleanup | Med | Connect on match mount; singleton guard |

## Open Questions (product)

1. Should a finished match create a DB notification for an offline player? (Poll still delivers the result; this is about push-style notice.)
2. Confirm no live "opponent finished" indicator this iteration (deferred refinement).

## Rollback Plan

All changes additive: revert backend completion/emit and frontend listener/connect; the poll path still delivers results. No schema changes.

## Dependencies

- `getIO` / `getUserSocketIds` already exported by the socket server.
- No external dependencies.

## Success Criteria

- [ ] Concurrent-finish test passes: both POST /finish near-simultaneously → match completes; no stuck `in_progress`.
- [ ] Waiting player reaches result <1s after opponent finishes (was ≤10s).
- [ ] `handleTimeUp` with `matchEnded` reaches result without a poll tick.
- [ ] Offline/reconnect: poll still delivers the result.
