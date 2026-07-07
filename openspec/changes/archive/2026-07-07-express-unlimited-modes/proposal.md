# Proposal: Express + Unlimited Game Modes

## Intent

Currently all game modes are lives-based with no question limit. Users want:
1. **Express mode**: Fixed 30-question games per mode — quick, finite sessions
2. **Unlimited mode**: Play through ALL available countries until the DB is exhausted
3. **Win screen**: Congratulation when completing all questions with lives remaining

## Scope

### In Scope
- 10 new game mode slugs (express + unlimited for each of 5 existing modes)
- Express: game ends after 30 correct questions or lives depleted
- Unlimited: game ends when all countries used or lives depleted
- Win screen: "🎉 You answered all questions!" when mode completed successfully
- Backend detection of country exhaustion + question limit
- DB seed data for new modes
- i18n keys for mode names, descriptions, and win screen
- Frontend HomePage: show express/unlimited variants per mode
- Frontend QuizPage: win screen vs game over screen
- TDD: tests for win condition, express limit, unlimited exhaustion

### Out of Scope
- Scoring system changes
- Lives system changes
- New UI components beyond win screen
- Animation/celebration effects on win

## Capabilities

### New Capabilities
- `express-unlimited-modes`: Express (30-q) and unlimited (all-countries) variants per game mode with win-screen detection

### Modified Capabilities
- `quiz-gameplay`: Game-over logic extended to detect win-by-completion vs loss-by-lives
- `game-modes`: Mode slugs expanded to include express/unlimited variants

## Approach

1. Extend `GameModeSlug` union type with 10 new slugs (`*-express`, `*-unlimited`)
2. Add `totalQuestions?: number` to `GameModeConfig` — null = unlimited/lives-based, 30 = express
3. Extend quiz engine `submitAnswer` to detect win conditions (question limit reached or country pool exhausted)
4. Return `QuizAnswerResponse.win: true` with congratulation data when win detected
5. Frontend QuizPage renders win screen when `gameResult.win` instead of `gameResult`
6. Add express/unlimited mode configs to `gameModes.ts`
7. Seed new mode rows in DB
8. Add HomePage mode group cards showing express/unlimited options

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/types/index.ts` | Modified | New GameModeSlug variants |
| `apps/backend/src/services/gameModes.ts` | Modified | Express/unlimited configs |
| `apps/backend/src/services/quizEngine.ts` | Modified | Win detection in submitAnswer |
| `apps/backend/src/db/schema/gameModes.ts` | Modified | Optional total_questions column |
| `apps/backend/scripts/seed-modes.ts` | Modified | Seed new mode rows |
| `apps/frontend/src/features/quiz/HomePage.tsx` | Modified | Express/unlimited cards |
| `apps/frontend/src/features/quiz/QuizPage.tsx` | Modified | Win screen rendering |
| `apps/frontend/src/i18n/en.json` | Modified | New mode + win screen keys |
| `apps/frontend/src/i18n/es.json` | Modified | New mode + win screen keys |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Country exhaustion detection edge case | Low | Already tracked via `sessionCountryIds` set — question batch returns empty → win |
| Existing sessions with new mode slugs | Low | New slugs only used in new sessions — old sessions unaffected |
| Lives display hardcoded to 3 hearts | Low | Pre-existing bug, not part of this change |

## Rollback Plan

Revert: `git revert` the merge commit. Remove new mode slugs from DB seed.

## Dependencies

None.

## Success Criteria

- [ ] Express mode ends after 30 questions with win screen if lives remain
- [ ] Unlimited mode ends when all countries exhausted with win screen if lives remain
- [ ] Both modes show game over if lives depleted before completion
- [ ] All 390 existing tests + new tests pass
- [ ] TypeScript clean
