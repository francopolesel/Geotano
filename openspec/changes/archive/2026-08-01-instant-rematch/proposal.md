# Proposal: Instant Rematch

## Intent

After a multiplayer duel completes, players must be able to send a new challenge to the same opponent with one tap, preserving the same game mode and duration. Today the result screen only offers "Back to Home" — a rematch requires re-opening the friends list and re-picking mode/duration. This change removes that friction for the most common post-match action.

## Scope

### In Scope
- "Rematch" button on the result screen of `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` (inserted before the Back to Home button, ~line 556).
- Sends `POST /api/matches/challenge` with `receiverId = opponent.id`, `gameModeSlug = match.gameModeSlug`, `durationMinutes = match.durationMinutes`.
- Local `sending` / `waiting` / `error` state following the FriendsPage `handleModeSelect` pattern (lines 128-159).
- New i18n key `multiplayer.rematch` in both `en.json` and `es.json`; reuse existing challenge error keys (`challengeNotFriends`, `challengeInFlight`, `challengePending`, `challengeError`) and `waitingResponse`.
- Frontend tests in `MultiplayerPage.test.tsx` (result-screen describe); extend `MOCK_MATCH` fixture with `durationMinutes`.

### Out of Scope
- Backend changes (route, service, schema) — none required.
- Dedicated `POST /api/matches/:id/rematch` endpoint (follow-up if server-side validation is wanted).
- Unordered-pair unique index to fully fix the two-directional race (schema follow-up).
- Rematch from MatchHistoryPage rows.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `multiplayer-1v1-mode`: the End screen requirement gains a rematch action — sending a new challenge to the same opponent with the same mode/duration from the result screen.

## Approach

Frontend-only. Reuse `POST /api/matches/challenge` — all three payload values already exist in result-screen state (opponent derived at MultiplayerPage.tsx:136-138, `gameModeSlug`/`durationMinutes` from `MatchState`). On success, disable the button and show `multiplayer.waitingResponse` (existing `challenge:accepted` socket listener already auto-navigates to the new match). On error, map status to existing keys (`NOT_FRIENDS` → `challengeNotFriends`, `CHALLENGE_IN_FLIGHT` → `challengeInFlight`, `PENDING_CHALLENGE` → `challengePending`, generic → `challengeError`). Button is disabled after send to mitigate the both-tap race.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Modified | Rematch button + send state on result screen |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.test.tsx` | Modified | Result-screen tests; `MOCK_MATCH` gains `durationMinutes` |
| `apps/frontend/src/locales/en.json` + `es.json` | Modified | New `multiplayer.rematch` key (parity in both) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Both players tap rematch → two pending challenges → double match | Low | Button disabled after send (one send per session); sequential sends already collapse via backend both-direction check |
| `challenge:declined` never emitted — "waiting" state can go stale | Low | Not rematch-specific; button state resets on result-screen mount; accept path still works |
| Socket not connected on result screen → no auto-navigate | Low | NotificationBell in AppShell likely covers it; verify in design phase |

## Rollback Plan

Revert the single frontend commit: remove the button and state from `MultiplayerPage.tsx`, delete the `multiplayer.rematch` key from both locale files, and drop the added test cases. No backend or data migration involved — clean revert.

## Dependencies

- None (reuses existing `POST /api/matches/challenge`; no new packages).

## Success Criteria

- [ ] Rematch button renders only when `status === 'completed'` and payload uses `opponent.id` + `match.gameModeSlug` + `match.durationMinutes`.
- [ ] Sending → button disabled with waiting state; error paths map to existing i18n keys.
- [ ] `multiplayer.rematch` present in both `en.json` and `es.json`.
- [ ] Frontend tests pass; backend test suite untouched and green.
