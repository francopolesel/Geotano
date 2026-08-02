# Tasks: Verified Badge + Reserved "geocreator" Name

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~430–480 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | single PR (size:exception) |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Notes |
|------|------|-------|
| 1 | Backend: migration, payload propagation, guards + tests (Phases 1–3) | ~280 lines; independent |
| 2 | Frontend: badge, mappings, insertions + tests (Phases 4–6) | ~200 lines; depends on unit 1 |

## Phase 1: Foundation

- [x] 1.1 `packages/shared/src/types/index.ts`: add `isVerified?: boolean` to `UserProfile` (:15-26) and `RankingEntry` (:217-224). Test: `cd apps/backend && npm run check-types`
- [x] 1.2 `apps/backend/src/db/schema/users.ts`: add `isVerified: boolean('is_verified').notNull().default(false)` after `avatarUrl`; `apps/backend/src/db/index.ts`: append `-- 0008` block (ADD COLUMN IF NOT EXISTS + backfill `francopolesel99`). Never drizzle-kit. Test: `cd apps/backend && npm test`

## Phase 2: Backend payload propagation (RED→GREEN)

- [x] 2.1 RED: update fixtures/assertions in `auth.routes`, `friends.routes`, `rankings`, `rankings.detailed`, `profile`, `matchService`, `matches.routes`, `server.test` — strict `toEqual` gains `isVerified: false`; add W2 verified-entry mapping + `userRank` fallback assertions. Expect failures.
- [x] 2.2 GREEN: thread `isVerified` through `mapUser`, friends 5 SELECTs + search, rankings top select + `groupBy` + `entries.map` + fallback join/`groupBy` + `userRank ?? false`, profile, matches challenger/opponent + fallbacks, `matchService.getMatchState` + inline types. Test: `cd apps/backend && npm test`

## Phase 3: Reserved-name guard (RED→GREEN)

- [x] 3.1 RED: `auth.routes.test.ts` new cases — register `geocreator` → 409, `' Geocreator '` → 409, crafted `{username:'geocreator',displayName:'John'}` → 409 (W1), creator success (C1), PATCH displayName → 409, PATCH username → 409 (W3), creator PATCH ok.
- [x] 3.2 GREEN: create `apps/backend/src/lib/displayName.ts` (`isReservedDisplayName`, `isCreator`, constants); wire 409 `RESERVED_DISPLAY_NAME` in register (`isCreator(body.username)`), Google new-user (generated username), PATCH displayName + PATCH username (JWT `request.user`). Test: `cd apps/backend && npm test`

## Phase 4: Frontend types + badge (RED→GREEN)

- [x] 4.1 RED: `VerifiedBadge.test.tsx` — renders svg `role="img"` + `aria-label="Verified"`, `className` passthrough via `cn`.
- [x] 4.2 GREEN: `apps/frontend/src/components/ui/VerifiedBadge.tsx` (inline SVG, theme primary color).
- [x] 4.3 Types: `friendsStore` (5 interfaces), `ProfilePage`, `MatchHistoryPage`, `MultiplayerPage` local types gain `isVerified?`. Test: `cd apps/frontend && npm test`

## Phase 5: Error mapping + i18n (RED→GREEN)

- [x] 5.1 RED: `stores.test.ts` — register rejects `new ApiError('Conflict', 409, 'RESERVED_DISPLAY_NAME')` → mapped i18n key; `i18n.test.ts` en/es parity fixture gains key.
- [x] 5.2 GREEN: `authStore.ts` 409 branch differentiates `errorCode`; `MyProfilePage.tsx` maps it; add `auth.validation.reservedDisplayName` to `i18n/en.json` ("This display name is reserved") + `es.json` ("Este nombre para mostrar está reservado"). Test: `cd apps/frontend && npm test`

## Phase 6: Badge insertions (RED→GREEN)

- [x] 6.1 RED: render tests — AppShell header, RankingsPage verified row, FriendsPage verified row, ProfilePage badge, MyProfilePage reserved-name message, MatchHistoryPage, MultiplayerPage start/vs + in-game header (S8), ChallengeNotification.
- [x] 6.2 GREEN: insert `{x.isVerified && <VerifiedBadge className="ml-1" />}` at all 13 spots (AppShell, ProfilePage, FriendsPage×5, RankingsPage×2, ChatPage, MatchHistoryPage, MultiplayerPage×3, ChallengeNotification); start-screen ReactNode interpolation (`MultiplayerPage.tsx:545`). Test: `cd apps/frontend && npm test`

## Phase 7: Verification

- [x] 7.1 Full suites: `cd apps/backend && npm test` + `cd apps/frontend && npm test` + `check-types` both; confirm `multiplayerSocketListeners.test.ts` stays green (loose fixtures — no change needed).

## Post-apply gatekeeper fixes (2026-08-01)

- [x] 7.2 CRITICAL: `isCreator` in `lib/displayName.ts` now uses case-sensitive plain equality (`username === CREATOR_USERNAME`) per design D2 — a case-variant `Francopolesel99` no longer inherits the creator exemption. Regression tests: register `Francopolesel99` + displayName `geocreator` → 409; PATCH (JWT `Francopolesel99`) displayName/username+displayName `geocreator` → 409.
- [x] 7.3 WARNING: rankings fallback `userScoreResult` query now inner-joins `users`, selects `isVerified`, and groups by it (D3/S5); `userRank` uses `userScoreResult.isVerified ?? false` instead of hardcoded `false`. Test: creator outside top-100 → `userRank.isVerified === true`.
- [x] 7.4 SUGGESTION: register + Google sign-up set `isVerified` at insert time (`isVerified: isCreator(username)`) so a fresh-DB creator registration is verified even after the migration backfill already ran; creator-register test asserts `isVerified: true`.
- [x] 7.5 SUGGESTION: restored `focusable="false"` on `VerifiedBadge.tsx` svg (D6).
- [x] 7.6 Re-verified: backend 413/413, frontend 572/572, `check-types` clean both. Commits `2686dab` (backend) + `023a8f7` (frontend).
