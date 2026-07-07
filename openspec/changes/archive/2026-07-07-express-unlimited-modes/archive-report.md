# Archive Report: express-unlimited-modes

**Archived**: 2026-07-07
**Status**: Complete

## Summary

Added 10 new game mode variants (Express + Unlimited for each of the 5 existing modes: flag-guess, capital-guess, country-by-flag, continent, free) with win detection on the backend and win screen rendering on the frontend. Express mode limits to 30 questions; Unlimited mode plays until all countries in the DB are exhausted. Both modes show a win screen when completed with lives remaining.

## Artifacts

| Artifact | Location |
|----------|----------|
| Spec | openspec/changes/express-unlimited-modes/spec.md |
| Design | openspec/changes/express-unlimited-modes/design.md |
| Tasks | openspec/changes/express-unlimited-modes/tasks.md |
| Apply-Progress | engram: sdd/express-unlimited-modes/apply-progress (obs #84) |

## Tasks Completed

- [x] 1.1 Shared types — GameModeSlug variants, totalQuestions?, win?
- [x] 1.2 DB schema — total_questions column
- [x] 1.3 Migration — 0004_express_unlimited_modes.sql
- [x] 1.4 Seed script — 10 new mode rows
- [x] 2.1 GameMode service — createVariant() factory
- [x] 2.2 GameMode tests — 31 tests
- [x] 3.1 Quiz engine — win detection
- [x] 3.2 Win detection tests — 13 tests
- [x] 4.1 en.json — mode + win screen keys
- [x] 4.2 es.json — Spanish translations
- [x] 5.1 HomePage — mode grouping with pills
- [x] 6.1 QuizPage — win screen rendering
- [x] 6.2 QuizPage tests — 8 win screen tests

## Test Results

- **Total tests**: 404 (was 390)
- **New tests**: 14 (6 HomePage + 8 QuizPage)
- **Regressions**: 0
- **Pre-existing failures**: 1 (server.test.ts anti-cache headers — unrelated)
- **TypeScript**: Clean across all 3 packages

## Files Changed (14 files)

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types/index.ts` | Modified | 10 new `GameModeSlug` variants, `totalQuestions?` on `GameMode`, `win?` on `QuizAnswerResponse` |
| `apps/backend/src/db/schema/gameModes.ts` | Modified | Added `totalQuestions: integer('total_questions')` column |
| `apps/backend/src/db/migrations/0004_express_unlimited_modes.sql` | Created | `ALTER TABLE game_modes ADD COLUMN total_questions integer` |
| `apps/backend/scripts/seed-modes.ts` | Modified | 10 new mode rows (express totalQuestions=30, unlimited null) |
| `apps/backend/src/services/gameModes.ts` | Modified | `createVariant()` factory + 10 variant configs |
| `apps/backend/src/__tests__/gameModes.test.ts` | Modified | Updated count to 15, assert totalQuestions per variant |
| `apps/backend/src/services/quizEngine.ts` | Modified | Win detection in `submitAnswer`: express limit at 30, unlimited on country exhaustion |
| `apps/backend/src/__tests__/quizEngine.full.test.ts` | Created | 4 win/loss scenarios |
| `apps/frontend/src/i18n/en.json` | Modified | 10 mode names/descriptions + 5 win screen keys + 3 variant pill keys |
| `apps/frontend/src/i18n/es.json` | Modified | Spanish translations for all new keys |
| `apps/frontend/src/features/quiz/HomePage.tsx` | Modified | Mode groups with Standard/Express/Unlimited pills; slug-based routing |
| `apps/frontend/src/features/quiz/HomePage.test.tsx` | Modified | 6 tests covering pill types + navigation |
| `apps/frontend/src/features/quiz/QuizPage.tsx` | Modified | Win screen rendering when `win: true` (congrats, score, stats, play again, back to home) |
| `apps/frontend/src/features/quiz/QuizPage.test.tsx` | Modified | 8 win screen tests (rendering, stats, buttons, win=false, win=undefined) |

## Key Commits

| Commit | Description |
|--------|-------------|
| `b0f46b4` | Types, schema, migration, and seed for express/unlimited modes |
| `971a031` | GameModeConfig factory with 10 express/unlimited variants |
| `ae007c0` | Win detection for express and unlimited modes |
| `d9a8857` | Task checkbox updates in tasks.md |

## Verified Scenarios

- Express win at 30 with lives remaining
- Express loss before 30 (lives depleted)
- Unlimited win on country exhaustion
- Unlimited loss before exhaustion
- Win screen renders with congratulations, score, stats
- Win screen visually distinct from game-over
- All 10 new slugs resolvable
- DB migration + seed data
- EN and ES i18n labels

## Key Design Decisions

- `createVariant()` factory for DRY mode configs
- Win detection inline in `submitAnswer` after game-over check
- Country exhaustion caught via generation error (zero new DB queries)
- `win?: boolean` on shared `QuizAnswerResponse` (not separate type)
- iOS-style pill buttons for mode variants on HomePage
- stacked-to-main PR strategy (PR 1 = backend, PR 2 = frontend)

## Rollback

- Revert the merge commits: `git revert b0f46b4 971a031 ae007c0`
- Run migration rollback: `ALTER TABLE game_modes DROP COLUMN total_questions`
- Delete seeded rows: `DELETE FROM game_modes WHERE slug LIKE '%-express' OR slug LIKE '%-unlimited'`
