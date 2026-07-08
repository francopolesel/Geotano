# Exploration: game-modes-profile-overhaul

## Current State

### 1. Game Modes (`apps/backend/src/services/gameModes.ts`)
- **15 configs**: 5 base modes × 3 variants (standard, express, unlimited)
- Every mode has **3 lives** (hardcoded in config, same for all)
- **Standard** (`totalQuestions: 60`), **Express** (`totalQuestions: 30`), **Unlimited** (`totalQuestions: undefined`)
- Variants generated via `createVariant(base, suffix, totalQuestions?)` — inherit everything (lives, timer, multiplier, questionTypes) from the base
- `GameModeSlug` is a **union type** with all 15 explicit slug strings — adding variants requires extending this union

### 2. Quiz Engine (`apps/backend/src/services/quizEngine.ts`)
- **End conditions** (checked in `submitAnswer`):
  1. **Lives exhausted** (`newLives <= 0`) → game over, session closed
  2. **Question limit reached** (`config.totalQuestions && answered >= totalQuestions`) → win, session closed
  3. **Country exhaustion** (unlimited only, when fallback generation can't find new countries) → win, session closed
- **Lives**: decremented by 1 on wrong answer, start at `config.lives` (always 3 currently)
- **Score**: `BASE_SCORE (100)` + time bonus (up to 50%) × streak multiplier (1.5× after 3 correct) × mode multiplier, minus -50 penalty for wrong answers
- **No hardcore-specific logic** exists — no config flag for 1-life mode, no special ending conditions

### 3. Achievements (`apps/backend/src/services/achievements.ts`)
- **15 achievements** across 3 categories: gameplay (8), social (3), mastery (4)
- Checked via `checkAchievements(userId)` — called **fire-and-forget** after every completed game (when `result.result` exists)
- Checks stats queries: totalGames, totalScore, maxStreak, friendCount, perfectGameCount, modeSlugs played
- **`all_modes`**: checks `modeSlugs.size >= 5` — groups by slug from completed sessions, only counts 5 base slugs currently
- Seeded from `scripts/seed-achievements.ts` (static list, insert on conflict do nothing)
- No hardcore-specific achievements exist

### 4. Profile Page (`apps/frontend/src/features/profile/ProfilePage.tsx`)
- **Route**: `/profile/:userId` — single-page, no tabs
- Shows: user header (avatar, username, bio), stats grid (bestScore, totalGames, friends), achievements grid, recent games list
- Friend actions for OTHER users only (add/accept/reject/unblock)
- **No "My Profile" concept** — it's a public profile viewer only
- Fetches from `GET /api/users/:id/profile` (backend route: `apps/backend/src/routes/profile.ts`)

### 5. Settings Page (`apps/frontend/src/features/settings/SettingsPage.tsx`)
- **Route**: `/settings` — single-page, no tabs
- Three sections stacked vertically: `ProfileSection`, `PreferencesSection`, `PasswordSection`
- ProfileSection: edit avatar, displayName, bio, username
- PreferencesSection: theme toggle, language toggle
- PasswordSection: change password form
- **No stats, achievements, or game history shown here**

### 6. Navigation / AppShell (`apps/frontend/src/components/AppShell.tsx`)
- Sidebar with `NavLink` items: Home, Start, Rankings, Friends, Settings
- **No "My Profile" nav item** — user's display name shown in top bar, not clickable
- navItems array is hardcoded inline

### 7. Routing (`apps/frontend/src/app/App.tsx`)
- react-router-dom v6 with `createBrowserRouter`
- All protected routes under `<AuthGuard>` → `<AppShell>` → `<Outlet />`
- Routes: Home (`/`), Quiz (`/quiz`), Friends (`/friends`), Chat (`/friends/chat/:userId`), Profile (`/profile/:userId`), Rankings (`/rankings`), Settings (`/settings`)
- **No nested routes** under `/settings` or `/profile`

### 8. FriendsPage Tab Pattern (`apps/frontend/src/features/friends/FriendsPage.tsx`)
- Uses local `useState<Tab>` with conditional rendering based on `activeTab`
- Tabs rendered as inline buttons in a segmented control (rounded-lg border p-1 flex)
- Each tab manually renders its content with `{activeTab === 'friends' && (...)}` pattern
- Tab values: `'friends' | 'requests' | 'search' | 'blocked'`

### 9. Test Coverage
| File | Lines | Quality |
|------|-------|---------|
| `gameModes.test.ts` | 167 | Excellent — all 15 slugs, variants, inheritance, edge cases |
| `quizEngine.test.ts` | 198 | Good — pure functions only (calculateScore, getQuestionText, getAnswerText) |
| `achievements.test.ts` | 394 | Excellent — all achievements, batches, race safety, edge cases |
| `ProfilePage.test.ts` | 274 | Good — states, rendering, lightbox |
| `SettingsPage.test.ts` | 247 | Excellent — all sections, save/password/preferences |
| `FriendsPage.test.ts` | 500 | Excellent — all tabs, invite/redeem, modals |
| `AppShell.test.ts` | 212 | Excellent — nav items, logout, toggle |

### 10. Notable Discrepancy
The **seed script** (`seed-modes.ts`) has different values than the code configs:
- `continent`: seed has `timerSeconds: 10, multiplier: 0.8` vs config `timerSeconds: 20, multiplier: 1.2`
- `free`: seed has `lives: 5` vs config `lives: 3`
- The code configs (`gameModes.ts`) are the **source of truth** for gameplay, but DB seed values are used for records

---

## Affected Areas

### Game Modes (backend)
- `apps/backend/src/services/gameModes.ts` — add Hardcore variant factory or new base config parameter
- `packages/shared/src/types/index.ts` — extend `GameModeSlug` union type (if new slugs)
- `apps/backend/src/db/schema/gameModes.ts` — add `lives` override column? (already exists)
- `apps/backend/scripts/seed-modes.ts` — add Hardcore mode rows

### Quiz Engine (backend)
- `apps/backend/src/services/quizEngine.ts` — no changes expected (lives already config-driven)

### Achievements (backend)
- `apps/backend/src/services/achievements.ts` — add hardcore-specific achievement checks
- `apps/backend/src/__tests__/achievements.test.ts` — new test cases
- `packages/shared/src/types/index.ts` — no changes needed (Achievement type is generic)
- `apps/backend/scripts/seed-achievements.ts` — add new achievement definitions

### Profile & Settings (frontend)
- `apps/frontend/src/features/profile/ProfilePage.tsx` — possibly split into public vs self view
- `apps/frontend/src/features/settings/SettingsPage.tsx` — add "My Profile" tab showing stats/achievements
- `apps/frontend/src/components/AppShell.tsx` — add "My Profile" nav link
- `apps/frontend/src/app/App.tsx` — new route for self-profile if separate
- `apps/frontend/src/i18n/en.json` — new translation keys
- `apps/frontend/src/i18n/es.json` — new translation keys

### Backend API
- `apps/backend/src/routes/profile.ts` — possibly new self-profile endpoint or enhanced existing
- `apps/backend/src/routes/quiz.ts` — achievement check is already fire-and-forget, no changes needed

### Tests
- All files listed above have corresponding `.test.ts` files that need updating

---

## Approaches

### 1. Hardcore Mode

#### Option A: New slug suffix (`-hardcore`)
- Create `*hardcore` variants for each of the 5 base modes: `flag-guess-hardcore`, `capital-guess-hardcore`, etc.
- `lives: 1`, otherwise identical to unlimited (no totalQuestions)
- Extend `GameModeSlug` union type with 5 new values
- Extend `createVariant` or add `createHardcoreVariant`
- **Pros**: Explicit, follows existing pattern, easy to understand, works with existing mode select UI
- **Cons**: Blows up from 15 to 20 slugs, `all_modes` achievement would need updating
- **Effort**: Medium

#### Option B: Config parameter approach (no new slugs)
- Add a `hardcore: boolean` field to `GameModeConfig`, false by default
- When `hardcore: true`, override `lives` to 1 at runtime
- Show toggle button on home page for each mode
- **Pros**: No slug explosion, cleaner type system, flexible
- **Cons**: Breaks existing pattern (all modes are explicit slugs), complicates backend URL/query params, `all_modes` achievement would need to check the hardcore flag instead
- **Effort**: High (ripple through DB, API, UI)

#### Option C: Only unlimited gets Hardcore (fewer slugs)
- Only create hardcore variants for the `-unlimited` suffix: `flag-guess-unlimited-hc`, etc.
- Or: Hardcore is a checkbox modifier that overrides lives to 1 on any mode
- **Pros**: Reduced scope
- **Cons**: Inconsistent UX — why can't I play hardcore express?
- **Effort**: Low-Medium

### 2. Standard + Express Merge

#### Option A: Remove Express, keep Standard as middle ground
- Keep 15 modes, remove express variants (totalQuestions: 30)
- Standard stays at 60 questions
- Unlimited stays as-is
- **Pros**: Simplifies the mode grid, clear differentiation (60 vs all)
- **Cons**: Removes the quick-session option, existing DB sessions reference express slugs
- **Effort**: Medium (slug type narrowing, test updates, UI cleanup, DB migration handling)

#### Option B: Keep all three but rename for clarity
- Rename "Standard" → "Classic" (60 questions, 3 lives)
- Rename "Express" → "Quick" (30 questions, 3 lives)
- Keep Unlimited as-is
- **Pros**: Less confusing naming, no functional changes
- **Cons**: Doesn't actually fix the underlying confusion, just renames
- **Effort**: Low

#### Option C: Merge Standard + Express into a mode config choice
- Remove the variant slug pattern
- Make each base mode have configurable params (questions: 30|60|∞, timer, lives)
- **Pros**: Maximum flexibility, clean architecture
- **Cons**: Massive rewrite of mode selection, backend, types — overkill for this scope
- **Effort**: Very High

### 3. My Profile Tab

#### Option A: New nav item + re-use ProfilePage with self-ID
- Add "My Profile" nav link in AppShell sidebar
- Navigate to `/profile/{currentUserId}` — reuse existing ProfilePage
- No code changes to ProfilePage needed
- **Pros**: Minimal changes, reuses existing component and API
- **Cons**: Still a separate page, not integrated with Settings, no edit capability from here
- **Effort**: Low

#### Option B: Add "Profile" tab to SettingsPage
- Convert SettingsPage from vertical sections to tabbed layout
- Tabs: Profile (edit), Preferences, Password, My Profile (stats/achievements/games)
- My Profile tab reuses the read-only display from ProfilePage but for current user
- **Pros**: All account-related features in one place, natural UX
- **Cons**: Settings page redesign, need to share data between ProfileSection and My Profile tab
- **Effort**: Medium

#### Option C: Separate "My Profile" page with edit capability
- Create a new `/my-profile` route
- Shows current user's profile with inline edit (avatar, bio) + stats + achievements + games
- Combines what ProfilePage shows + what Settings ProfileSection edits
- **Pros**: Comprehensive, clear separation of concerns
- **Cons**: More files, more routes, duplicates edit logic from Settings
- **Effort**: High

### 4. Achievement Updates

#### Option A: Add hardcore-specific achievements
- Add 2-3 new achievements: "Hardcore Win" (win any hardcore mode), "Hardcore Streak" (win 5/10 hardcore games), "Hardcore Perfect" (perfect game on hardcore)
- Add `hardcore_completed` stat query to `checkAchievements()`
- Update `all_modes` to require playing hardcore variants too (if new slugs)
- **Pros**: Hardcore mode feels rewarding, clear progression
- **Cons**: More DB queries, more seeded achievements
- **Effort**: Low

#### Option B: Avoid new achievements, just update all_modes
- Don't add hardcore-specific achievements
- Update `all_modes` threshold if new slugs are added (e.g., require all 20 slugs instead of 5)
- **Pros**: Minimal changes
- **Cons**: Hardcore mode doesn't feel special, no reward for the challenge
- **Effort**: Very Low

---

## Recommendation

### Hardcore Mode → **Option A: New slug suffix (`-hardcore`)**
Follows the existing pattern faithfully, is explicit in the type system, and integrates naturally with the current mode selection UI. Create 5 new `*-hardcore` variants (identical to unlimited but with `lives: 1`). The slug explosion is acceptable because it's consistent with the existing design.

Add a `HC_GROUP` to `MODE_GROUPS` in HomePage or a hardcore variant row per mode group (like a 4th button in each card). The existing `all_modes` achievement logic already iterates completed mode slugs — it will naturally count hardcore modes too if the threshold is updated.

### Standard + Express → **Option A: Remove Express and make Standard = Intermediate (60 qs)**
The user has expressed that Standard and Express feel too similar (the only diff is 60 vs 30 questions, same lives). Removing Express reduces the grid from 3 variants to 2 (Standard 60, Unlimited ∞), which is clearer. Keep 3 lives for Standard, 3 lives for Unlimited, 1 life for Hardcore.

This simplifies the mode selection UI significantly: each mode card shows Standard, Unlimited, Hardcore — three clear, different options.

**Migration concern**: Express slugs (10 variants) would need handling in the backend — existing DB records reference them. The `GameModeSlug` type can gradually drop express values.

### My Profile → **Option B: Add tab to SettingsPage**
Settings is the natural place for "my stuff." Convert SettingsPage from vertical sections to a **tabbed layout** (mimicking the FriendsPage segmented control pattern). Tabs: "Profile" (edit), "Preferences", "Password", "My Profile" (stats, achievements, recent games — read-only). The "My Profile" tab reuses the read-only display of ProfilePage but for the current user, fetched from the same `/users/{id}/profile` endpoint.

Then add a sidebar nav item "My Profile" that links to `/settings?tab=profile` or simply to `/settings` with the My Profile tab active. This keeps settings consolidated.

### Achievement Updates → **Option A: Add hardcore-specific achievements**
Add 3 new achievements:
- `hardcore_win` (Win 1 hardcore game)
- `hardcore_5` (Win 5 hardcore games)  
- `hardcore_perfect` (Perfect game on hardcore mode)

These incentivize the challenge mode. Update `all_modes` to require playing 5 distinct base variants (not hardcore), so players don't feel forced into hardcore for the completionist achievement.

---

## Risks

1. **Standard+Express removal breaks existing DB references**: Express slugs exist in `game_sessions` records. The `GameModeSlug` type and DB queries need backward-compatible handling. Consider a data migration or just keeping express as valid slugs (for read purposes) while removing them from the UI and mode selection.

2. **`all_modes` achievement threshold**: Currently checks `modeSlugs.size >= 5` for base modes. Adding hardcore slugs could inflate this count. The query groups by `gameModes.slug` from completed sessions — if someone plays only hardcore modes, they'd have 5+ slugs from hardcore variants, which would already trigger the achievement. Need to ensure `all_modes` tracks base slug uniqueness (strip suffix) or keeps a separate concept of "mode families completed."

3. **Settings page tab pattern**: Converting from stacked sections to tabs changes the UX flow. Users may miss seeing all sections at once (vertical scroll). Consider a sticky tab bar at top with content below, preserving the max-w-2xl layout.

4. **Test effort**: The existing tests are comprehensive (\~1,900 lines across 7 files). Any change to slugs, mode counts, or achievement logic will require updating `ALL_SLUGS` arrays, test data fixtures, and assertion counts. The tests use `vi.hoisted` for shared state — pattern is consistent and easy to extend.

5. **Seed data desync**: The discrepancy between config values and seed values (continent timer, free lives, etc.) could affect `all_modes` or mode-specific achievements if the DB seed is used for lookups rather than the code config.

---

## Ready for Proposal
Yes — all areas have been explored, approaches identified, and risks documented. The orchestrator should proceed to the **proposal** phase with the recommendations above.
