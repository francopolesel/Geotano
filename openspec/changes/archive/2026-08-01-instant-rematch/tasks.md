# Tasks: Instant Rematch

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120–160 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Whole change (button + state + socket + i18n + tests) | PR 1 | Single PR to master; size-exception accepted; frontend-only |

## Phase 1: Test Scaffold + i18n (RED)

- [x] 1.1 — **RED: extend `apps/frontend/src/__tests__/MultiplayerPage.test.tsx`** — add `durationMinutes: 3` to `MOCK_MATCH`; extend mocked `ApiError` with `errorCode` param; add `vi.mock('../lib/socket')` (`connectSocket: vi.fn()`, `setNavigateFn: vi.fn()`); add result-screen rematch tests: button renders only on completed (win/lose/tie), `connectSocket` called with `'test-token'` on tap, payload `{ receiverId: 'user-2', gameModeSlug: 'flag-guess', durationMinutes: 3 }` on `/matches/challenge`, in-flight disabled + exactly one POST on double click (`mockPost.mockReturnValueOnce(new Promise(() => {}))`), error mapping re-enables (`ApiError` errorCode `NOT_FRIENDS` → `challengeNotFriends` in `role="alert"`; generic `Error` → `challengeError`). New tests fail until 2.1. Test: `npm test` (apps/frontend).
- [x] 1.2 — **i18n keys** — add `"multiplayer.rematch": "Rematch"` to `apps/frontend/src/i18n/en.json` (~line 309) and `"multiplayer.rematch": "Revancha"` to `apps/frontend/src/i18n/es.json` (~line 309). No test; verified by 2.1 tests.

## Phase 2: Core Implementation (GREEN)

- [x] 2.1 — **GREEN: implement rematch in `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx`** — import `connectSocket` from `../../lib/socket`; add `const token = useAuthStore((s) => s.token);`; add `rematchState: 'idle' | 'sending' | 'waiting' | 'error'` + `rematchError: string | null`; `handleRematch` useCallback: guard in-flight/`!opponent || !match`, **call `connectSocket(token)` BEFORE the POST (Decision 4 — socket is dead on result screen)**, set `'sending'`, `api.post('/matches/challenge', { receiverId: opponent.id, gameModeSlug: match.gameModeSlug, durationMinutes: match.durationMinutes })` → `'waiting'`, catch → map `errorCode` (`NOT_FRIENDS`→`challengeNotFriends`, `CHALLENGE_IN_FLIGHT`→`challengeInFlight`, `PENDING_CHALLENGE`→`challengePending`, else→`challengeError`) → `'error'`; Rematch button before Back to Home (line 556), `disabled = 'sending' || 'waiting'`, label `multiplayer.rematch` idle/error, `multiplayer.waitingResponse` in-flight; error `<p role="alert">` below button. Test: `npm test` (apps/frontend) — 1.1 tests green.

## Phase 3: Verification

- [x] 3.1 — **Final verification** — full frontend suite green: `npm test` in `apps/frontend` (all MultiplayerPage + FriendsPage + existing tests); run `npx tsc --noEmit` in `apps/frontend` for type safety; confirm backend test suite untouched (no `apps/api` changes). Verify both en.json/es.json parse and `multiplayer.rematch` resolves in both locales.
