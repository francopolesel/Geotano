# Design: Instant Rematch

## Technical Approach

Frontend-only change. Add a Rematch button to the multiplayer result screen (`MultiplayerPage.tsx`, inserted before the Back to Home button at line 556) that reuses `POST /api/matches/challenge` with the three values already present in server-returned match state: `receiverId = opponent.id`, `gameModeSlug = match.gameModeSlug`, `durationMinutes = match.durationMinutes` (derived at lines 136-138 / 23-24). No backend changes. Sending/waiting/error state follows the FriendsPage `handleModeSelect` pattern (lines 128-159) with scalar local state. **Critical addition**: the rematch handler re-establishes the socket connection via `connectSocket(token)` before sending, because the socket is dead on the result screen (see Decision 4). Satisfies spec `multiplayer-1v1-mode`: rematch button, payload, sending state, accepted auto-navigate, error mapping.

## Architecture Decisions

| # | Decision | Options | Choice / Rationale |
|---|----------|---------|--------------------|
| 1 | Where the send logic lives | (a) inline in MultiplayerPage, (b) extract `useSendChallenge` hook | **(a)**. Only one new consumer; FriendsPage's state is a per-friend record (`challengeState[friendId]`) while the result screen needs a scalar (`rematchState`) — a hook would abstract mismatched state shapes for no real duplication win. Follows existing inline pattern. |
| 2 | Error mapping reuse | (a) duplicate small map inline, (b) centralize in `lib/challengeErrors.ts` | **(a)**. The map is 3 entries + fallback (FriendsPage 146-158); centralizing would modify FriendsPage (scope creep, per proposal affected-areas) for a `t`-dependent helper serving two call sites. Extract later only if a third consumer appears. |
| 3 | API surface | (a) reuse `POST /api/matches/challenge`, (b) dedicated `POST /api/matches/:id/rematch` | **(a)**. Payload comes from server-returned match state, not user input; existing route auto-replaces stale pending invites (matches.ts 52-101). No validation benefit worth a new route + tests. |
| 4 | Auto-navigate on accept | (a) re-establish socket in `handleRematch`, (b) rely on socket "staying connected", (c) poll match state as fallback | **(a)**. Verified: the socket does NOT persist across routes. FriendsPage connects on mount and `disconnectSocket()`s on unmount (FriendsPage.tsx:82-89 → socket.ts:95-100 nulls the module socket), NotificationBell connects once with stable deps (`[token, fetchNotifications]`, NotificationBell.tsx:28-32) so it never re-runs, and MultiplayerPage never connects — so on the result screen `challenge:accepted` reaches a dead client and the spec's auto-navigate (spec.md:14) breaks. Fix: `handleRematch` calls `connectSocket(token)` before the POST — idempotent (`if (socket?.connected) return socket`, socket.ts:33-35), re-creates the socket when null, re-registers the `challenge:accepted` listener (socket.ts:85-90), and `navigateFn` survives disconnects (module-level, set by NavSetup in `apps/frontend/src/app/App.tsx:31-35`). `useBlocker` is inactive on the result screen (`shouldBlock` only when `screen === 'playing'`), so navigation isn't blocked. Rejected (c): polling duplicates the socket contract and adds a timer the button flow doesn't need. |

## Component / State Design

- New selectors: `const token = useAuthStore((s) => s.token);` (already imported at line 4; existing selector `s.user?.id` at line 105 proves store access).
- New state: `rematchState: 'idle' | 'sending' | 'waiting' | 'error'` + `rematchError: string | null`.
- `handleRematch` (useCallback): guard `rematchState === 'sending' || 'waiting'` or `!opponent || !match` → return; `connectSocket(token)` (idempotent — safe even if a socket is already alive, e.g. from NotificationBell); set 'sending', clear error; `api.post('/matches/challenge', { receiverId: opponent.id, gameModeSlug: match.gameModeSlug, durationMinutes: match.durationMinutes })` → 'waiting'; catch → map `errorCode` to i18n key, set error + 'error'.
- Button: inserted before Back to Home (line 556); `disabled = rematchState === 'sending' || rematchState === 'waiting'`; label `multiplayer.rematch` when idle/error, `multiplayer.waitingResponse` when sending/waiting; error `<p role="alert">` below (FriendsPage 369-373 pattern).

## Data Flow

    Result screen (status==='completed', matchResult)
      │ tap "Rematch"  (guard: idle && opponent && match)
      ▼
    connectSocket(token) ──▶ re-creates socket if null; re-registers challenge:accepted listener
      ▼
    setRematchState('sending') ──▶ POST /api/matches/challenge
                                    { receiverId: opponent.id,
                                      gameModeSlug: match.gameModeSlug,
                                      durationMinutes: match.durationMinutes }
      ├── 200 ──▶ setRematchState('waiting') → button disabled, "Waiting for response…"
      │              │
      │              └─▶ socket 'challenge:accepted' {matchId}
      │                     └─▶ navigateFn('/multiplayer/' + matchId)   [auto-navigate]
      └── error ──▶ ApiError.errorCode → i18n key (NOT_FRIENDS → challengeNotFriends,
                   CHALLENGE_IN_FLIGHT → challengeInFlight, PENDING_CHALLENGE → challengePending,
                   else → challengeError); setRematchState('error'); button re-enabled; alert shown

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Modify | Import `connectSocket` from `../../lib/socket`; add `token` selector; scalar `rematchState`/`rematchError`; `handleRematch` (connects socket → POST); Rematch button before Back to Home (line 556); error `<p role="alert">` |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.test.tsx` | Modify | Extend `MOCK_MATCH` with `durationMinutes: 3`; extend mocked `ApiError` with `errorCode` (lines 16-22); add `vi.mock('../lib/socket')` (`connectSocket: vi.fn()`) since the page now imports it; result-screen tests incl. asserting `connectSocket` is called with the token |
| `apps/frontend/src/i18n/en.json` | Modify | Add `"multiplayer.rematch": "Rematch"` in multiplayer block (~line 310) |
| `apps/frontend/src/i18n/es.json` | Modify | Add `"multiplayer.rematch": "Revancha"` (noun — no voseo conjugation needed; matches existing tone) |

## Interfaces / Contracts

```ts
type RematchState = 'idle' | 'sending' | 'waiting' | 'error';

// connectSocket(token) — existing, idempotent; returns live socket if connected,
// else creates one and registers challenge:accepted → navigateFn(`/multiplayer/${matchId}`)

// POST /api/matches/challenge  (existing backend contract, unchanged)
// body:    { receiverId: string; gameModeSlug: string; durationMinutes: number }
// 200 →    { challengeId: string }
// 403 →    errorCode: 'NOT_FRIENDS'
// 409 →    errorCode: 'CHALLENGE_IN_FLIGHT' | 'PENDING_CHALLENGE'
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (component) | Button renders only on completed match | Result-screen describe (test 257-319); assert "Rematch" present before "Back to Home" on win/lose/tie fixtures |
| Unit (component) | Socket re-established before send | Assert `connectSocket` mock called with `'test-token'` when Rematch tapped |
| Unit (component) | Correct payload | `fireEvent.click` Rematch → assert `mockPost` called with `/matches/challenge` and `{ receiverId: 'user-2', gameModeSlug: 'flag-guess', durationMinutes: 3 }` |
| Unit (component) | Disabled + waiting in flight; no double send | `mockPost.mockReturnValueOnce(new Promise(() => {}))`; double click; assert exactly one challenge POST |
| Unit (component) | Error mapping re-enables button | Reject with `ApiError` (`errorCode: 'NOT_FRIENDS'`) → assert `challengeNotFriends` text in `role="alert"` and button re-enabled; repeat for generic `Error` → `challengeError` |

`challenge:accepted` → navigation is existing socket behavior, not unit-tested here; the test asserts the reconnect precondition. Backend suite untouched.

## Migration / Rollout

No migration required. Feature ships with the button; no flags needed. Rollback: revert the single frontend commit (button + state + socket call, both locale keys, test additions).

## Risks

- **Socket reconnect is now part of the design** (Decision 4) — the result screen no longer depends on a socket that was nulled by a previous page unmount. Residual: if `connectSocket` fails (network), the POST still succeeds but auto-navigate won't fire — the button stays in "waiting"; user can leave via Back to Home (existing risk class, accepted).
- Two-directional race (both players tap): button disabled after send; sequential sends collapse via backend check; unordered-pair index is a schema follow-up.
- `challenge:declined` never emitted — "waiting" state can go stale (pre-existing, not rematch-specific).

## Open Questions

- None blocking. Follow-up (not this change): unordered-pair unique index; `challenge:declined` socket event; centralize the error map if a third consumer appears.
