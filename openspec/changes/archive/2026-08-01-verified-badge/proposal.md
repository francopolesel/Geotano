# Proposal: Verified creator badge + exclusive "geocreator" display name

## Intent

`francopolesel99` ("geocreator") is the game creator. Guarantees: (1) no other user may set display name "geocreator" (case-insensitive); (2) the creator shows a verified badge wherever their name renders. Username uniqueness already enforced (DB + app, case-sensitive). Display names may duplicate EXCEPT "geocreator".

## Scope

### In Scope
- DB: `users.is_verified boolean NOT NULL DEFAULT false` (schema, `runMigrations()` migration, backfill `francopolesel99`)
- Guard: `409 RESERVED_DISPLAY_NAME` when effective displayName (explicit ?? username) matches `geocreator` case-insensitively; only `username === 'francopolesel99'` (JWT) passes. Spots: register, Google OAuth new-user, PATCH profile
- Payloads: `mapUser` + list SELECTs expose `isVerified` (friends 5x, search, rankings, public profile, matches, getMatchState)
- Types: `UserProfile.isVerified`, `RankingEntry.isVerified` (shared); frontend local types (friendsStore, ProfilePage, MatchHistoryPage, MultiplayerPage)
- UI: `VerifiedBadge` (inline SVG — no icon lib) in FriendsPage (5), RankingsPage (2), ProfilePage, AppShell, ChatPage, MatchHistoryPage, MultiplayerPage (2), ChallengeNotification (data free: challenger is `UserProfile`)
- Tests (TDD): guard (3 flows) + badge rendering + payload shape

### Out of Scope
- NotificationBell text badges (needs `fromVerified` plumbing + restructure) — deferred
- Case-insensitive username uniqueness quirk (pre-existing)
- No DB-level displayName constraint; displayName stays non-unique

## Capabilities

### New Capabilities
- `verified-badge`: is_verified data model, geocreator exclusivity guard, VerifiedBadge rendering contract

### Modified Capabilities
- `user-auth`: display-name validation reserves "geocreator" (`409 RESERVED_DISPLAY_NAME`)

## Approach

`is_verified` column = single source of truth; propagates via SELECTs, avoids username-constant leaks into 8+ components. Guard compares effective displayName `trim().toLowerCase()` — covers register's username-default and Google's provider name. **409 over 400**: reserved name is a business conflict mirroring `DUPLICATE_*` codes; 400 is for malformed input.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `db/schema/users.ts`, `db/index.ts` | Modified | Column, migration, backfill |
| `routes/auth.ts` | Modified | `mapUser` + guard (:66, :189, :219) |
| `routes/friends.ts`, `rankings.ts`, `profile.ts`, `matches.ts`, `services/matchService.ts` | Modified | `isVerified` in SELECTs |
| `packages/shared/src/types/index.ts` | Modified | `UserProfile`, `RankingEntry` |
| `frontend/components/ui/VerifiedBadge.tsx` | New | Inline SVG badge |
| `frontend/features/*` (8 files) + `AppShell.tsx` | Modified | 10 badge insertions + local types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backfill misses creator (typo/case) | Med | Verify username pre-merge; check badge in verification |
| Guard bypass via new reg path | Low | Shared helper + tests on 3 spots |
| Payload/UX clutter | Low | Additive boolean; small SVG |

## Rollback Plan

- DB: `DROP COLUMN IF EXISTS "is_verified"` via `runMigrations()`; app reads tolerate absence
- Guard: remove check from 3 spots (shared helper)
- UI: remove `VerifiedBadge` + insertions
- All independent, reversible.

## Dependencies

None external. Backend tests mock `db` — no test-DB migration.

## Success Criteria

- [ ] Non-creator register/PATCH with `geocreator` (any case/spacing) → `409`; creator unchanged
- [ ] After migration, creator `is_verified=true`; badge renders in all in-scope surfaces
- [ ] All list/get payloads include `isVerified`
- [ ] Existing tests green; new tests cover guard + badge
