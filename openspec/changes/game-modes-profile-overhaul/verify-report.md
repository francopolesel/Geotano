# Verification Report

**Change**: game-modes-profile-overhaul
**Version**: N/A
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 14 (1.1–8.2) |
| Tasks complete | 14 (all phases A–H) |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Tests**: ✅ 709 passed
```text
Backend:  21 files, 291 passed
Frontend: 26 files, 418 passed
Total:    47 files, 709 passed
```

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Hardcore: 5 slugs exist | `flag-guess-hardcore` etc. in type union | `gameModes.test.ts` — ALL_SLUGS includes 5 hardcore slugs | ✅ COMPLIANT |
| Hardcore: lives=1 | Hardcore configs have `lives: 1` | `gameModes.test.ts` — hardcore variant configs lives=1 | ✅ COMPLIANT |
| Hardcore: no question limit | Hardcore configs `totalQuestions` undefined | `gameModes.test.ts` — hardcore configs no limit | ✅ COMPLIANT |
| Hardcore: seed data | `seed-modes.ts` creates 5 hardcore rows with lives=1 | Static: seed file verified | ✅ COMPLIANT |
| Hardcore: HomePage 1 ❤️ | Hardcore pills show "1 ❤️" badge | `HomePage.test.tsx` — "should show 1 ❤️ indicator on each hardcore button" | ✅ COMPLIANT |
| Standard: 50 questions | Base configs `totalQuestions: 50` | `gameModes.test.ts` — base configs totalQuestions=50 | ✅ COMPLIANT |
| Standard: seed 50q | `seed-modes.ts` base rows totalQuestions=50 | Static: seed file verified | ✅ COMPLIANT |
| Express: removed from UI | No Express in MODE_GROUPS | `HomePage.test.tsx` — no Express pills, all 3 variants are standard/unlimited/hardcore | ✅ COMPLIANT |
| Express: removed from seed | No Express rows in seed-modes | Static: seed file verified | ✅ COMPLIANT |
| Express: kept in type union | `GameModeSlug` still has express slugs | `types/index.ts` verified | ✅ COMPLIANT |
| maxLives: in StartSessionResponse | `maxLives` returned by `startSession()` | `quizEngine.ts` line 497 verifies return shape | ✅ COMPLIANT |
| maxLives: gameStore | `maxLives` field + parameterized `startSession`/`reset` | `gameStore.ts` verified; `stores.test.ts` 68 passed | ✅ COMPLIANT |
| maxLives: QuizPage hearts | Hearts use `Array.from({length: maxLives})` | `QuizPage.tsx` line 437 verified | ✅ COMPLIANT |
| Settings: 4 tabs | Profile, Preferences, Password, My Profile | `SettingsPage.test.tsx` 22 passed covering tabs | ✅ COMPLIANT |
| Settings: tab=my-profile URL param | `useSearchParams` reads/sets `?tab=` | `SettingsPage.test.tsx` covers URL param | ✅ COMPLIANT |
| My Profile: stats | bestScore, totalGames, perfectGames, bestStreak | `SettingsPage.test.tsx` — MyProfileTab stats render | ✅ COMPLIANT |
| My Profile: achievements grid | AchievementBadge[] grid renders | `SettingsPage.test.tsx` — achievement grid in MyProfileTab | ✅ COMPLIANT |
| Hardcore achievements | 3 new: hardcore_winner, hardcore_veteran, hardcore_perfect | `achievements.test.ts` — hardcore achievement tests | ✅ COMPLIANT |
| all_modes base grouping | Strips suffix, counts 5 base families | `achievements.test.ts` — all_modes with suffixed slugs → 5 families | ✅ COMPLIANT |
| AppShell: My Profile link | Nav item to `/settings?tab=my-profile` | `AppShell.test.tsx` 14 passed; nav items verified in code | ⚠️ PARTIAL |
| End conditions: lives=0 | Game over when lives reach 0 | `quizEngine.ts` — newLives <= 0 check | ✅ COMPLIANT |
| End conditions: limit reached | Win when totalQuestions reached | `quizEngine.ts` line 627 | ✅ COMPLIANT |
| End conditions: pool exhausted | Win on "No countries available" | `quizEngine.ts` lines 676–693 | ✅ COMPLIANT |
| All 709 tests pass | 291 backend + 418 frontend | Test run: 47 files, 709 passed | ✅ COMPLIANT |

**Compliance summary**: 23/24 scenarios compliant, 1 partial

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Hardcore mode: 5 slugs, lives=1, unlimited questions | ✅ Implemented | Types, configs, seed, HomePage all correct |
| Standard: 50 questions across all base configs | ✅ Implemented | gameModes.ts + seed-modes.ts both use 50 |
| Express removed from UI, kept for DB compat | ✅ Implemented | Not in MODE_GROUPS, seed, or i18n. Kept in type union + MODE_CONFIGS for backward compat |
| maxLives in session response + store | ✅ Implemented | Backend returns, store stores, QuizPage renders dynamically |
| SettingsPage: 4-tab layout | ✅ Implemented | Tabbed layout with segmented control, my-profile URL param |
| My Profile tab: stats + achievements | ✅ Implemented | 4 stat cards + achievement grid, API-backed |
| 3 hardcore achievements + all_modes grouping | ✅ Implemented | Checks, seeds, and tests all present |
| AppShell: My Profile nav link | ⚠️ Implemented with bug | Nav link exists and navigates, but **i18n key `settings.myProfile` is missing** |
| End conditions: correct in all modes | ✅ Implemented | Game over at 0 lives, win at limit/pool exhaustion |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Variant factory extension (livesOverride param) | ✅ Yes | `createVariant` accepts `livesOverride`, hardcore configs use it |
| maxLives in StartSessionResponse | ✅ Yes | Returned as `config.lives` in `startSession()` |
| Express type kept, removed from UI/seed/i18n | ✅ Mostly | Removed from MODE_GROUPS, seed, i18n. Still in `createVariant` suffix union + MODE_CONFIGS for DB compat — pragmatic deviation from design (which said "removed from createVariant") |
| all_modes strips suffix before dedupe | ✅ Yes | `slug.replace(/-(express\|unlimited\|hardcore)$/, '')` |
| SettingsPage tabbed layout (FriendsPage pattern) | ✅ Yes | Segmented-control tab bar, 4 tabs, same pattern |
| MyProfileTab: 4 stat cards + achievements grid | ✅ Yes | bestScore, totalGames, perfectGames, bestStreak + AchievementBadge grid |
| AppShell nav link to /settings?tab=my-profile | ✅ Yes | Exists in navItems array |

### Issues Found

**CRITICAL**:
1. **Missing i18n key `settings.myProfile`** — `AppShell.tsx` line 15 uses `label: 'settings.myProfile'` for the My Profile nav link, but this key does NOT exist in `en.json` or `es.json`. The existing correct keys are `nav.myProfile` (line 37 in en.json) and `settings.tabs.myProfile` (line 187). In production, `i18next` will render the literal key string `settings.myProfile` instead of "My Profile". The test mock masks this bug by hardcoding the key.

**WARNING**:
1. **Express configs still in `createVariant` suffix union** — The design document states Express should be removed from `createVariant`, but the suffix union still includes `'express'` and the `MODE_CONFIGS` map still defines 5 Express configs. This is technically a deviation from the design, though it's pragmatically required because `isValidModeSlug` and `getModeConfig` need to resolve Express slugs for existing DB sessions. The code comment on line 99 says "Express variants — totalQuestions = 30" confirming they're intentionally kept.

2. **Spec slug names differ from actual slugs** — The hardcore-mode spec at `openspec/specs/hardcore-mode/spec.md` lists slugs as `flag-hardcore`, `capital-hardcore`, `country-flag-hardcore`, `continent-hardcore`, `mixed-hardcore`, but the actual implementation uses `flag-guess-hardcore`, `capital-guess-hardcore`, `country-by-flag-hardcore`, `continent-hardcore`, `free-hardcore`. The actual slugs follow the existing naming convention correctly; the spec was aspirational. Not functionally wrong, but the spec document should be updated to match.

**SUGGESTION**:
1. **PerfectGames stat key mismatch** — `MyProfileTab` uses `t('profile.stats.perfectGames')` which matches `en.json` key `profile.stats.perfectGames`. Good. But the `ProfilePage` (separate component) may not render this stat — consider aligning the stat display between the two pages.
2. **seed-modes timer inconsistency** — The seed file's `capital-guess` has `timerSeconds: 20` and `continent` has `timerSeconds: 10`, while the base configs in `gameModes.ts` have `timerSeconds: 15` (continent) and `timerSeconds: 20` (capital-guess). The seed data parameters don't perfectly match the in-memory configs. The seed sets `timerSeconds: base.timerSeconds` for variants, so variants inherit the base seed value. This could cause a discrepancy if a mode is seeded with different timers than the config. Consider using a single source of truth for timer values.

### Verdict

**FAIL** — The missing `settings.myProfile` i18n key is a CRITICAL user-facing display bug. The nav link rendering "settings.myProfile" instead of "My Profile" fails the AppShell requirement from the my-profile spec. Fix requires either:
- Change `AppShell.tsx` label from `'settings.myProfile'` to `'nav.myProfile'` (simplest, key already exists), OR
- Add `"settings.myProfile": "My Profile"` to both `en.json` and `es.json`
