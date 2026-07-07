# Tasks: Express + Unlimited Game Modes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Types/Schema/Backend (shared + backend), PR 2: Frontend (i18n + UI) |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: Yes — resolved: stacked-to-main (PR 1 = backend, PR 2 = frontend)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + Schema + Backend Config + Quiz Engine | PR 1 | All backend changes, tests, seed, migration |
| 2 | Frontend i18n + HomePage + QuizPage | PR 2 | i18n keys, mode card restructure, win screen |

## Phase 1: Types & Schema

- [x] 1.1 `packages/shared/src/types/index.ts` — add 10 `GameModeSlug` variants, `totalQuestions?: number` to `GameMode`, `win?: boolean` + `totalQuestions?: number` to `QuizAnswerResponse`
- [x] 1.2 `apps/backend/src/db/schema/gameModes.ts` — add `totalQuestions: integer('total_questions')` column
- [x] 1.3 Create `apps/backend/src/db/migrations/0004_express_unlimited_modes.sql` — `ALTER TABLE game_modes ADD COLUMN total_questions integer`
- [x] 1.4 `apps/backend/scripts/seed-modes.ts` — add 10 new mode rows with express (totalQuestions=30) and unlimited (null) variants

## Phase 2: Backend Config

- [x] 2.1 `apps/backend/src/services/gameModes.ts` — add `totalQuestions?: number` to `GameModeConfig`, add `createVariant()` factory, add 10 variant configs, update `getModeConfig`/`isValidModeSlug`
- [x] 2.2 `apps/backend/src/__tests__/gameModes.test.ts` — update count to 15, assert `totalQuestions` per variant, test new slugs resolvable

## Phase 3: Backend Quiz Engine

- [x] 3.1 `apps/backend/src/services/quizEngine.ts` — track `totalQuestionsAnswered` per session; after answer processing check express win (≥30 correct) and unlimited exhaustion (pool empty), return `QuizAnswerResponse.win: true`
- [x] 3.2 `apps/backend/src/__tests__/quizEngine.test.ts` — write tests: express win at 30, express loss before 30, unlimited win on exhaustion, unlimited loss before exhaustion; verify existing tests still pass

## Phase 4: Frontend — i18n

- [x] 4.1 `apps/frontend/src/i18n/en.json` — add keys: 10 mode names/descriptions (`modes.flagGuessExpress` etc.), win screen keys (`quiz.winTitle`, `quiz.winMessage`, `quiz.totalQuestions`)
- [x] 4.2 `apps/frontend/src/i18n/es.json` — add Spanish translations for all new keys

## Phase 5: Frontend — HomePage

- [x] 5.1 `apps/frontend/src/features/quiz/HomePage.tsx` — restructure mode cards into groups with express/unlimited sub-options; slug-based routing `/quiz?mode=flag-guess-express`

## Phase 6: Frontend — QuizPage

- [x] 6.1 `apps/frontend/src/features/quiz/QuizPage.tsx` — read `win` flag from answer response; render win screen (congratulations + score + stats + Play Again + Back to Home) when `win: true`
- [x] 6.2 `apps/frontend/src/features/quiz/QuizPage.test.tsx` — write tests for win screen rendering with correct stats data
