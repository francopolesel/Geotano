# Design: Verified Badge for the Creator

**Capability**: `verified-badge`
**Status**: Revised (gatekeeper v2)
**Date**: 2026-08-01
**Specs covered**: `specs/verified-badge/spec.md`, `specs/user-auth/spec.md` (reserved display name)

## Revisions (gatekeeper v2)

- **C1 (critical)**: `isCreator` now takes a **username string**, not `request.user`.
  Register checks the *submitted* username (no `authGuard` → `request.user` is
  `undefined` there); Google new-user checks the *generated* username; only PATCH
  uses the JWT `request.user` (it runs `authGuard`).
- **W2**: D3 now covers the `entries.map` step at `rankings.ts:129-143` that
  builds `RankingEntry` objects, plus a test that a verified creator entry in the
  top-100 keeps the flag.
- **W3**: guard extended to PATCH **username** (option a — cheap, closes the
  `username = geocreator` + `displayName = null` impersonation via RankingsPage).
- **S4**: es i18n copy → "Este nombre para mostrar está reservado".
- **S5**: fallback ranking query mirrors top-entries (`users.isVerified` +
  `groupBy`), no `bool_or`; fixed the duplicated `isVerified and isVerified` typo.
- **S6**: `multiplayerSocketListeners.test.ts` added to the fixture checklist
  (loose assertions — no breakage).
- **S7**: `POST /api/friends/invite` partial `friend: { id, username }` objects
  documented as a consistent omission.
- **S8**: MultiplayerPage in-game header (`⚔️ {opponentName}`, `:687`) added as a
  third badge spot on that page.

## Overview

Give the creator (`francopolesel99`) a verified badge (✔) rendered next to their
display name/username across the app, and reserve the display name `geocreator`
exclusively for them. The badge is driven by a new `users.is_verified` boolean
column. A non-creator who tries to register or update their display name to
`geocreator` (case-insensitive, whitespace-trimmed) gets a `409` with
`errorCode: 'RESERVED_DISPLAY_NAME'`.

Two user-facing specs are satisfied by one data model: `is_verified` is the
source of truth for badge rendering, and `isReservedDisplayName()` guards the
name.

## Current State

- `users` table has no verified flag. `drizzle-kit` journal is **stale** — the
  trusted migration path is the startup runner `runMigrations()` in
  `apps/backend/src/db/index.ts:11-82` (inline idempotent SQL template, blocks
  commented `-- 0006:`, `-- 0007:`; next free number is **0008**).
  `render.yaml` start command is `cd apps/backend && node dist/index.js`;
  `src/index.ts:49` awaits `runMigrations()` before the server starts.
- `mapUser` (`apps/backend/src/routes/auth.ts:14-27`) serializes the auth user;
  register/Google/PATCH profile all funnel through it.
- JWT payload (`apps/backend/src/auth/jwt.ts:6-11`) carries `{ userId, username }`
  — the creator check uses `(request as any).user.username`.
- User profile data is selected in 10 places and must all gain `isVerified`:
  friends (5 SELECTs), rankings (2), profile (1), matches invite + history (2),
  matchService players (2 SELECTs + inline response types).
- `UserProfile` and `RankingEntry` in `packages/shared/src/types/index.ts`
  (lines 15-26, 217-224) are the shared shapes. `ChallengeInvitePayload`
  (`:320-322`) embeds `challenger: UserProfile` and `MatchStartPayload` (`:327`)
  embeds `opponent: UserProfile` — badge data flows through those automatically.
- `Notification` (`:245-256`) uses flat `fromUsername/fromDisplayName/fromAvatarUrl`
  fields — the NotificationBell text badge is explicitly **out of scope**.
- Frontend local types mirror user shapes in friendsStore, ProfilePage,
  MatchHistoryPage, MultiplayerPage. `authStore.register` maps every 409 to
  `auth.validation.usernameTaken` (`apps/frontend/src/store/authStore.ts:65-73`);
  `MyProfilePage` shows the raw API message on save failure
  (`MyProfilePage.tsx:79-83`). `ApiError` carries `status` + optional
  `errorCode` (`apps/frontend/src/lib/api.ts:8-16`, thrown at `:76`).

## Design Decisions

### D1 — Data model: `users.is_verified` + migration 0008

**Context**: Badge must be queryable wherever user info is shown; the reserved
name needs a backend-enforced rule; the DB is the only shared source of truth.

**Decision**:
- `apps/backend/src/db/schema/users.ts`: after `avatarUrl` (line 17) add
  `isVerified: boolean('is_verified').notNull().default(false);`
- `apps/backend/src/db/index.ts`: append to the migration template (block
  `-- 0008: Verified creator badge`):
  ```sql
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false;
  UPDATE "users" SET "is_verified" = true WHERE "username" = 'francopolesel99';
  ```
- Do **not** regenerate the drizzle-kit journal; keep schema file and runner SQL
  in sync by hand (existing project convention).

**Consequences**: Existing rows default to `false`; the creator is backfilled.
Register/Google inserts don't reference the column → DB default applies, no
insert code changes needed. `select()` (no args) and `select({ isVerified: users.isVerified })`
both return the camelCase `isVerified` key (drizzle maps the `boolean('is_verified')`
column by the schema property name) — mock fixtures must use `isVerified` (camelCase).

### D2 — Reserved display-name guard helper

**Context**: Four write paths must reject `geocreator` for non-creators:
register (default display name = username), Google sign-up (display name =
Google name), PATCH `/api/auth/profile` displayName, and PATCH username
(RankingsPage renders `username` directly — see W3).

**Decision**: New module `apps/backend/src/lib/displayName.ts` (sits next to the
existing `lib/email.ts`):

```ts
export const RESERVED_DISPLAY_NAME = 'geocreator';
export const CREATOR_USERNAME = 'francopolesel99';

export function isReservedDisplayName(displayName: string | null | undefined): boolean {
  return !!displayName && displayName.trim().toLowerCase() === RESERVED_DISPLAY_NAME;
}

export function isCreator(username: string | null | undefined): boolean {
  return username === CREATOR_USERNAME;
}
```

Error shape (mirrors `DUPLICATE_ACCOUNT`):
`reply.status(409).send({ errorCode: 'RESERVED_DISPLAY_NAME', message: 'This display name is reserved' })`.

**Decision (placement)** — `isCreator` takes the **username string**, never
`request.user`, because register and Google have NO `authGuard` preHandler
(`request.user` is `undefined` there):
- `register` (`auth.ts:31-74`): check the **submitted username**
  (`isCreator(username)` from the body) — placed after input validation, before
  the duplicate-username check and the insert. Guard (W1 — block the reserved
  username even when an explicit non-reserved displayName is supplied, since
  RankingsPage renders `username` directly and every other surface renders
  `displayName ?? username`):
  `if (!isCreator(username) && (isReservedDisplayName(username) || isReservedDisplayName(displayName ?? username)))` →
  `409`. This covers the reserved-username scenario (default display name =
  username), the explicit reserved `displayName` variant, AND the crafted
  `{ username: 'geocreator', displayName: 'John' }` bypass.
- Google sign-up (`auth.ts:116-199`): check the **generated username** (the
  `usernameBase`/suffix loop at `:170-182` resolves it before the insert at
  `:184`). Guard (W1 — block reserved generated username AND reserved provider
  name): `if (!isCreator(username) && (isReservedDisplayName(username) || isReservedDisplayName(name)))` →
  `409` — creator Google account (`francopolesel99@…` → generated username
  `francopolesel99`) bypasses. This also closes the Google mirror of the crafted
  bypass (email local-part `geocreator@…` → username `geocreator` with a
  non-reserved provider name). Existing-user branch (`:161-167`) never touches
  displayName → no guard.
- PATCH displayName (`auth.ts:204-276`): guard on the provided `displayName`
  (~line 219) when non-empty: `if (!isCreator((request as any).user.username) &&
  isReservedDisplayName(displayName))` → `409`. This route DOES run `authGuard`
  (line 206), so JWT `request.user.username` is valid here.
- PATCH **username** (`auth.ts:244-261`): extend the same reserved rule to the
  trimmed username before the uniqueness check:
  `if (!isCreator((request as any).user.username) && isReservedDisplayName(trimmed))`
  → `409`. Closes W3: without it, a non-creator sets `username = geocreator`,
  then PATCHes `displayName = null`, and every surface rendering
  `displayName ?? username` (and RankingsPage, which renders `username` directly)
  shows badge-less "geocreator". Spec reserves the display name only, but the
  username is an alternative display identity — honoring proposal guarantee #1's
  spirit is cheaper than documenting the hole. Register's username-default is
  already covered by the register guard above.

**Consequences**: Rule is centralized and unit-testable. Creator exemption is
plain username equality — no JWT dependency for register/Google, no extra DB
round-trip for PATCH. No data migration strips pre-existing non-creator
`geocreator` display names — guard is enforce-on-write only (per spec, out of
scope).

### D3 — Backend serialization: propagate `isVerified` through every user payload

**Context**: Badge must render everywhere; any serializer that omits the field
shows a missing badge silently.

**Decision** — add `isVerified: users.isVerified` to the drizzle SELECT and thread
it into every returned user object (drizzle alias key is `isVerified`):

| File | Select / spot | Add |
|---|---|---|
| `routes/auth.ts:14-27` | `mapUser` | `isVerified: user.isVerified` |
| `routes/friends.ts:24-29` | search results (returned raw) | `isVerified: users.isVerified` |
| `routes/friends.ts:280-285` | friends list profiles + mapped `friend` (296-303) | select + `isVerified: profile?.isVerified` |
| `routes/friends.ts:326-331` | incoming sender profiles + mapped `sender` (341-348) | select + `isVerified: profile?.isVerified` |
| `routes/friends.ts:371-376` | outgoing receiver profiles + mapped `receiver` (384-393) | select + `isVerified: profile?.isVerified` |
| `routes/friends.ts:667-672` | blocked user profiles + mapped user (679-688) | select + `isVerified: profile?.isVerified` |
| `routes/rankings.ts:96-123` | top entries select (add `isVerified: users.isVerified` and `users.isVerified` to `groupBy`) | `isVerified: users.isVerified` |
| `routes/rankings.ts:129-143` | `entries.map` building each `RankingEntry` (W2) | `isVerified: e.isVerified` (thread from the select) |
| `routes/rankings.ts:178-185` | fallback `userScoreResult` query (S5): add `.innerJoin(users, eq(users.id, gameSessions.userId))` and `isVerified: users.isVerified` to the select **and** `users.isVerified` to `groupBy` (mirrors top-entries; no `bool_or` needed) | `isVerified: users.isVerified` |
| `routes/rankings.ts` fallback | mapped `userRank` | `isVerified: userScoreResult.isVerified ?? false` (defensive: mock rows lack the aggregate) |
| `routes/profile.ts:19-26` + return 195-201 | user select + returned `user` | select + `isVerified: user.isVerified` |
| `routes/matches.ts:133-138` | challenger select for socket invite (raw emit) | `isVerified: users.isVerified` |
| `routes/matches.ts:148` | fallback `{ id: userId, username: 'unknown' }` | add `isVerified: false` |
| `routes/matches.ts:359` | opponent select in history + mapped entry (~366) | select + `isVerified: false` on the null-profile fallback |
| `services/matchService.ts:159,165` | `getMatchState` player1/player2 selects | `isVerified: users.isVerified` |
| `services/matchService.ts:207-208` | `MatchStateResponse.player1/player2` inline types | `isVerified: boolean` |

**Consequences**: All API surfaces carrying user identity now include
`isVerified`. Socket invites emit the raw row → the frontend receives the flag
with no extra plumbing. Every existing mock fixture for these queries must gain
`isVerified` (see Test Plan) because payload assertions are strict `toEqual`.

**Accepted omission (S7)**: `POST /api/friends/invite` responses
(`friends.ts:490-494`, `:514-517`) return a partial `friend: { id, username }`
object — no `displayName`/`avatarUrl`/`isVerified`. This endpoint is not in the
spec's payload list, the client never renders a badge from it, and the omission
is consistent with its existing partial shape → documented, not changed.

### D4 — Shared types: optional `isVerified` on `UserProfile` and `RankingEntry`

**Context**: Frontend consumes shared types; old `localStorage.auth_user` JSON
(hydrated by `authStore.hydrate`) has no `isVerified` key.

**Decision**:
- `UserProfile` (`packages/shared/src/types/index.ts:15-26`): add
  `/** True when the user is the verified creator. */ isVerified?: boolean;`
- `RankingEntry` (`:217-224`): add `isVerified?: boolean;`
- Do **not** touch `Notification` (flat fields, out of scope).
- `ChallengeInvitePayload.challenger: UserProfile` and `MatchStartPayload.opponent: UserProfile`
  carry it automatically — no changes needed there.

**Consequences**: Optional (undefined) is falsy → old stored users and legacy
payloads render without a badge and never crash. Strict payload assertions in
tests use `isVerified: false` explicitly.

### D5 — Frontend local types mirror `isVerified`

**Decision**: add `isVerified?: boolean;` to:
- `store/friendsStore.ts`: `FriendUser` (6-14), `PendingIncoming` (16-24),
  `PendingOutgoing` (26-34), `SearchUser` (36-41), `BlockedUser` (43-50).
- `features/profile/ProfilePage.tsx` `ProfileResponse.user` (37-43).
- `features/multiplayer/MatchHistoryPage.tsx` `Opponent` (9-14).
- `features/multiplayer/MultiplayerPage.tsx` `MatchState` player1/player2 inline
  shapes (35-36).
- `multiplayerStore` uses shared `ChallengeInvitePayload` → nothing to add.

### D6 — `VerifiedBadge` component

**Context**: No icon library; existing UI components live in
`apps/frontend/src/components/ui/` (UserAvatar, AchievementBadge) and use
CSS-var color classes like `text-[var(--color-primary)]`.

**Decision**: new `apps/frontend/src/components/ui/VerifiedBadge.tsx`:

```tsx
import { cn } from '../../lib/utils';

interface VerifiedBadgeProps {
  className?: string;
}

export function VerifiedBadge({ className }: VerifiedBadgeProps) {
  return (
    <svg
      role="img"
      aria-label="Verified"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block h-4 w-4 text-[var(--color-primary)]', className)}
    >
      <path d="M9 12l2 2 4-4" />
      <path d="M12 2.5l2.1 1.6 2.6-.3 1 2.4 2.4 1-.3 2.6 1.6 2.1-1.6 2.1.3 2.6-2.4 1-1 2.4-2.6-.3L12 21.4 9.9 19.8l-2.6.3-1-2.4-2.4-1 .3-2.6L2.6 12l1.6-2.1-.3-2.6 2.4-1 1-2.4 2.6.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

**Decision**: `role="img"` + `aria-label="Verified"` (the icon conveys
meaningful information — not pure decoration). Hardcoded English label is
acceptable for an accessibility label; if localization is required later, add an
optional `label` prop. Color uses the theme's primary CSS variable (visible in
light and dark mode, consistent with existing components).

### D7 — Insertion points (all conditional `{x.isVerified && <VerifiedBadge className="ml-1" />}`)

| Surface | Location | Condition |
|---|---|---|
| `components/AppShell.tsx` | header user name (~45-80) | `user?.isVerified` |
| `features/profile/ProfilePage.tsx` | profile header next to display name | `profile.user?.isVerified` |
| `features/friends/FriendsPage.tsx` | friends list row name | `f.isVerified` |
| `features/friends/FriendsPage.tsx` | search result row name | `s.isVerified` |
| `features/friends/FriendsPage.tsx` | incoming request row name | `r.isVerified` |
| `features/friends/FriendsPage.tsx` | outgoing request row name | `r.isVerified` |
| `features/friends/FriendsPage.tsx` | blocked list row name | `b.isVerified` |
| `features/rankings/RankingsPage.tsx` | top-entries row username | `e.isVerified` |
| `features/rankings/RankingsPage.tsx` | userRank row username | `userRank.isVerified` |
| `features/friends/ChatPage.tsx` | header participant name | `partner.isVerified` |
| `features/multiplayer/MatchHistoryPage.tsx` | opponent name per row | `m.opponent?.isVerified` |
| `features/multiplayer/MultiplayerPage.tsx` | start/vs screen player names (S1: name is interpolated inside `t('multiplayer.challengeFrom', { username: opponentName })` at `:545` — render name+badge together via ReactNode interpolation or `Trans`, condition on the derived `opponent`) | `opponent?.isVerified` (derived at `:148-151`) |
| `features/multiplayer/MultiplayerPage.tsx` | in-game header `⚔️ {opponentName}` (`:687`, S8) | `opponent?.isVerified` (derived at `:148-151`) |
| `features/multiplayer/MultiplayerPage.tsx` | result screen player names | `opponent?.isVerified` |
| `features/multiplayer/ChallengeNotification.tsx` | challenger name | `notification.challenger.isVerified` |

Each surface is a pure render concern: the flag arrives via existing payloads
(D3/D4/D5); no new fetch or store logic.

### D8 — Frontend error mapping + i18n

**Decision**:
- `store/authStore.ts:65-73` — differentiate the 409 branch:
  ```ts
  if (err instanceof ApiError && err.status === 409) {
    const message =
      err.errorCode === 'RESERVED_DISPLAY_NAME'
        ? i18n.t('auth.validation.reservedDisplayName')
        : i18n.t('auth.validation.usernameTaken');
    set({ isLoading: false, error: message });
  }
  ```
  (Existing test `new ApiError('Conflict', 409)` has no `errorCode` → still maps
  to `usernameTaken`; behavior unchanged.)
- `features/profile/MyProfilePage.tsx:82-84` — map the same `errorCode` to the
  i18n key in the catch (falls back to the raw API message otherwise).
- i18n keys (add to **both** `apps/frontend/src/i18n/en.json` and `es.json` to
  keep key parity):
  - `auth.validation.reservedDisplayName`
    - en: `"This display name is reserved"`
    - es: `"Este nombre para mostrar está reservado"` (S4 — "nombre para
      mostrar", not "nombre de usuario", so it does not conflate with username)

### D9 — Test strategy

**Decision** — guard logic and payload shape are the core; UI tests cover a
representative sample of insertion points.

Backend (`apps/backend/src/__tests__/`):
- `auth.routes.test.ts`: register with username `geocreator` → 409
  `RESERVED_DISPLAY_NAME`; register with explicit displayName `' Geocreator '` →
  409 (trim/case); **register crafted bypass (W1)** — `{ username: 'geocreator',
  displayName: 'John' }` → 409; **register as creator via submitted username**
  (C1) —
  `username: 'francopolesel99'`, `displayName: 'geocreator'` → success (no JWT
  mock needed; `isCreator(body.username)` bypasses); PATCH displayName →
  `geocreator` → 409; **PATCH username → `geocreator` → 409 (W3)**; creator PATCH
  (JWT username `francopolesel99`) → success. Update `USER_ROW` fixture +
  `mapUser` assertions with `isVerified`.
- `friends.routes.test.ts`: add `isVerified: false` to friend/sender/receiver/
  blocked fixtures; one assertion that the payload includes `isVerified: false`.
- `rankings.test.ts` / `rankings.detailed.test.ts`: add `isVerified: false` to
  entry fixtures; assert `userRank.isVerified` in a fallback case (the `?? false`
  on the select keeps existing fallback tests passing unchanged); **new
  assertion (W2): a top-100 entry fixture with `isVerified: true` maps through
  `entries.map` with the flag intact**.
- `profile.test.ts`: fixture + payload assertion.
- `matchService.test.ts`: `USER1_PROFILE`/`USER2_PROFILE` gain `isVerified: false`
  (strict `toEqual` at ~380-381); `getMatchState` assertion.
- `matches.routes.test.ts` / `server.test.ts`: challenger/opponent rows gain
  `isVerified: false` (server.test.ts rows at ~136, 156); socket `challenge:invite`
  emit assertion includes the flag.

Frontend:
- `components/ui/VerifiedBadge.test.tsx` (new): renders an svg with
  `role="img"` + `aria-label="Verified"`; `className` passthrough via `cn`.
- `__tests__/stores.test.ts` (authStore register): new test — `api.post` rejects
  with `new ApiError('Conflict', 409, 'RESERVED_DISPLAY_NAME')` →
  `state.error === 'auth.validation.reservedDisplayName'`. Existing 409 test
  (no errorCode) stays green.
- Representative insertion renders: AppShell.test.tsx (header badge shows with
  `isVerified: true`, absent with `false`), RankingsPage.test.tsx (verified entry
  row), FriendsPage.test.tsx (verified friend row), ProfilePage.test.tsx /
  MyProfilePage.test.tsx (badge + reserved-name save error message),
  MatchHistoryPage.test.tsx, MultiplayerPage.test.tsx (start/vs + **in-game
  header badge, S8**), ChallengeNotification (via multiplayerStore fixture).
- `__tests__/multiplayerSocketListeners.test.ts` (S6): fixtures at `:68-75` and
  `:100` lack `isVerified`, but assertions are loose (only
  `challenger.username`) → **no change needed**; verify it stays green in the
  fixture checklist.
- `i18n/i18n.test.ts`: add the new key to the en/es parity fixture if it
  enumerates keys.

## Open Questions

- None blocking. (Optional future: translate the badge `aria-label`; out of scope.)

## Out of Scope

- NotificationBell text badge / `Notification.fromVerified` plumbing (deferred
  per proposal).
- Stripping pre-existing non-creator `geocreator` display names (enforce-on-write
  only).
- Case-insensitive username uniqueness quirk (unchanged, per proposal).
- DB-level unique/check constraint on `display_name` (enforced in code only).

## Risks

- **Strict `toEqual` assertions**: every user-payload fixture must gain
  `isVerified` — the enumerated test files above; missing one fails CI loudly
  (good failure mode).
- **Drizzle aggregation**: selecting `users.isVerified` requires adding it to
  `groupBy` in both ranking queries (top-entries and the fallback `userScoreResult`,
  which now joins `users` to mirror the top-entries shape — S5); missing a
  `groupBy` column breaks SQL correctness.
- **Stale drizzle-kit journal**: never use it; migration 0008 lives only in the
  `runMigrations()` template (project convention).
- **Old localStorage users**: optional `isVerified` + undefined-falsy rendering
  keeps them safe; no migration needed.
- **Socket raw emits**: the invite/start payloads skip serializers — the
  SELECTs in D3 must not be missed or the badge silently disappears in
  ChallengeNotification/MultiplayerPage.

## Files Touched

Backend: `db/schema/users.ts`, `db/index.ts`, `lib/displayName.ts` (new),
`routes/auth.ts`, `routes/friends.ts`, `routes/rankings.ts`, `routes/profile.ts`,
`routes/matches.ts`, `services/matchService.ts`.
Shared: `packages/shared/src/types/index.ts`.
Frontend: `components/ui/VerifiedBadge.tsx` (new) + test,
`store/authStore.ts`, `store/friendsStore.ts`, `features/profile/ProfilePage.tsx`,
`features/profile/MyProfilePage.tsx`, `features/friends/FriendsPage.tsx`,
`features/friends/ChatPage.tsx`, `features/rankings/RankingsPage.tsx`,
`features/multiplayer/MatchHistoryPage.tsx`,
`features/multiplayer/MultiplayerPage.tsx`,
`features/multiplayer/ChallengeNotification.tsx`, `components/AppShell.tsx`,
`i18n/en.json`, `i18n/es.json`.
Tests: backend `__tests__/auth.routes.test.ts`, `friends.routes.test.ts`,
`rankings.test.ts`, `rankings.detailed.test.ts`, `profile.test.ts`,
`matchService.test.ts`, `matches.routes.test.ts`, `server.test.ts`; frontend
`__tests__/stores.test.ts`, component tests listed in D9.
