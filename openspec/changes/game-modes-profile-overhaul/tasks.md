# Tasks: Game Modes & Profile Overhaul

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~300–350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + Configs + Seed updates | Single PR | Foundation, no UI deps |
| 2 | Achievements + Engine changes | Single PR | Depends on types |
| 3 | Frontend (Settings, Home, Quiz, AppShell, Store, i18n) | Single PR | Depends on types + engine response |
| 4 | Tests | Single PR | Depends on everything above |

## Phase A — Types + Configs (infrastructure)

- [x] 1.1 `packages/shared/src/types/index.ts` — Add 5 `-hardcore` slugs to `GameModeSlug` union
- [x] 1.2 `apps/backend/src/services/gameModes.ts` — Add `hardcore` to `createVariant` suffix union (with `livesOverride` param), add 5 hardcore configs, set Standard `totalQuestions: 50`, remove Express variants
- [x] 1.3 `apps/backend/scripts/seed-modes.ts` — Remove Express variants, add 5 hardcore rows, set Standard 60→50, fix base free lives 5→3

## Phase B — Quiz engine (maxLives in response)

- [x] 2.1 `apps/backend/src/services/quizEngine.ts` — Add `maxLives` to `StartSessionResponse` interface, return `config.lives` in `startSession()` response
- [x] 2.2 `apps/frontend/src/store/gameStore.ts` — Add `maxLives` field, wire into `reset()` from session response

## Phase C — Achievements

- [x] 3.1 `apps/backend/src/services/achievements.ts` — Add 3 hardcore achievement checks (`hardcore_win`, `hardcore_5`, `hardcore_perfect`); fix `all_modes` to strip suffix before dedupe (count base families ≥ 5)
- [x] 3.2 `apps/backend/scripts/seed-achievements.ts` — Add 3 hardcore rows (sortOrder 16–18)

## Phase D — Frontend: HomePage

- [x] 4.1 `apps/frontend/src/features/quiz/HomePage.tsx` — Remove Express from `MODE_GROUPS` variants, add `hardcore` variant to each group

## Phase E — Frontend: Settings + My Profile

- [x] 5.1 `apps/frontend/src/features/settings/SettingsPage.tsx` — Convert from stacked sections to tabbed layout (segmented-control pattern); extract `ProfileSection`, `PreferencesSection`, `PasswordSection` as tabs, add `MyProfileTab` with stat cards (bestScore/totalGames/perfectGames/streak) + achievements grid

## Phase F — Frontend: AppShell + QuizPage

- [x] 6.1 `apps/frontend/src/components/AppShell.tsx` — Add `My Profile` nav link pointing to `/settings?tab=my-profile`
- [x] 6.2 `apps/frontend/src/features/quiz/QuizPage.tsx` — Replace hardcoded `Array.from({length: 3})` with `Array.from({length: maxLives})` using `maxLives` from gameStore

## Phase G — i18n

- [ ] 7.1 `apps/frontend/src/i18n/en.json` — Add keys for: 5 hardcore mode names/descriptions, `modes.variantHardcore`, `settings.tabMyProfile`, profile stats (`perfectGames`, `streak`), 3 hardcore achievement titles/descriptions
- [ ] 7.2 `apps/frontend/src/i18n/es.json` — Same new keys in Spanish

## Phase H — Tests

- [ ] 8.1 `apps/backend/src/__tests__/gameModes.test.ts` — Update: ALL_SLUGS to 20, Express→Hardcore slugs, Standard totalQuestions=50, hardcore lives=1, config count 15→20
- [ ] 8.2 `apps/backend/src/__tests__/achievements.test.ts` — Update: ALL_ACHIEVEMENTS to 18 rows, add hardcore achievement tests, add `all_modes` base-family grouping test, update mock query count
