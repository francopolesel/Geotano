# Verified Badge Specification

## Purpose

Single source of truth (`users.is_verified`) for the creator's verified status, exposed in every user-bearing payload and rendered as an inline-SVG badge wherever the creator's name appears.

## Requirements

### Requirement: Verified status persistence

The system MUST persist verified status per user in the `users.is_verified` column (boolean, NOT NULL, default false). The column MUST be created by the startup migration runner (`runMigrations()`), idempotently. The migration MUST backfill `is_verified = true` for the creator username `francopolesel99`. Every newly created user MUST default to `is_verified = false`.

- **Migration idempotent**: GIVEN the startup migration has already run, WHEN `runMigrations()` executes again, THEN no error occurs and the column remains `boolean NOT NULL DEFAULT false`.
- **Creator backfill**: GIVEN a user with username `francopolesel99`, WHEN the migration runs, THEN that row's `is_verified` is `true`.
- **Default false**: GIVEN a new user is registered, WHEN the row is inserted, THEN `is_verified` is `false`.

### Requirement: isVerified payload exposure

The system MUST expose `isVerified` as a boolean in the shared `UserProfile` and `RankingEntry` types and MUST include it in every user-bearing list/get payload: current user (`mapUser`), friends (list, incoming, outgoing, blocked, search), rankings (entries and `userRank`), public profile, match history, challenge invite, and `getMatchState` (`MatchStateResponse`).

- **Current user**: GIVEN a request that returns the current user profile, WHEN the payload is built, THEN it includes an `isVerified` boolean.
- **Friends lists**: GIVEN friends, search, incoming, outgoing, or blocked lists are fetched, WHEN each entry is serialized, THEN every entry includes `isVerified`.
- **Rankings**: GIVEN rankings entries or `userRank` are fetched, WHEN serialized, THEN each entry includes `isVerified`.
- **Profile and matches**: GIVEN a public profile, match history, challenge invite, or match-state payload is returned, WHEN serialized, THEN every included user object includes `isVerified`.

### Requirement: VerifiedBadge rendering

The system MUST render a `VerifiedBadge` (inline SVG, no icon library) immediately next to a user's display name when `isVerified` is `true`, on every in-scope surface: FriendsPage (5 spots), RankingsPage (2), ProfilePage, AppShell, ChatPage, MatchHistoryPage, MultiplayerPage (3: start screen, in-game header, result screen), and ChallengeNotification. The badge MUST NOT render when `isVerified` is `false` or absent. The badge MUST be a pure icon and MUST NOT require i18n keys.

- **Renders for verified**: GIVEN a friend with `isVerified: true`, WHEN FriendsPage renders, THEN the badge appears next to the friend's name.
- **Absent for non-verified**: GIVEN a user with `isVerified: false`, WHEN any in-scope surface renders, THEN no badge is shown.
- **Rankings entry**: GIVEN a rankings entry with `isVerified: true`, WHEN RankingsPage renders, THEN the badge appears next to the entry username.
- **Challenge notification**: GIVEN an incoming challenge whose challenger `UserProfile` has `isVerified: true`, WHEN ChallengeNotification renders, THEN the badge appears next to the challenger's name.
