# Design: Express + Unlimited Game Modes

## Technical Approach

Add 10 game mode variants (express + unlimited for each of 5 existing modes) by extending `GameModeConfig` with `totalQuestions`, injecting win detection into `submitAnswer`, and rendering a win screen on the frontend when a mode is completed instead of lost.

---

## Architecture Decisions

### Decision: Mode variant configs via factory function

| Option | Tradeoff |
|--------|----------|
| Duplicate all 10 configs manually | Explicit but verbose — 80+ lines of copy-paste |
| **Factory function extending base** | **DRY — variants inherit questionTypes, timer, lives, multiplier; only override slug + totalQuestions** |

**Rationale**: A `createVariant(base, suffix, totalQuestions)` helper keeps configs data-driven and ensures express/unlimited variants stay in sync with their base modes automatically.

### Decision: Win detection inline in `submitAnswer`

| Option | Tradeoff |
|--------|----------|
| Separate win-detection service | Cleaner separation but requires refactoring session-completion logic out of submitAnswer |
| **Inline in submitAnswer** | **Minimal change — plug into existing game-over flow at line ~607** |

**Rationale**: The win check is a single branch inserted between the game-over check and the get-next-question flow. A separate service would duplicate session-state management and is unjustified for ~5 condition lines.

### Decision: Country exhaustion → win via caught generation error

| Option | Tradeoff |
|--------|----------|
| Pre-count unused countries via DB query | Correct but adds a DB call on every answer |
| **Catch "No countries available" in question generation** | **Zero new DB queries — uses existing error path. Generate returns empty → win** |

**Rationale**: The `generateQuestion` function already reaches the "no countries" state when all session countries are used. Rather than aborting with an error, `submitAnswer` catches this during the get-next-question flow and returns a win result.

### Decision: Shared win/game-over result shape

| Option | Tradeoff |
|--------|----------|
| Separate response type for win | New shared type + frontend branch, doubles response surface |
| **Add `win?: boolean` to `QuizAnswerResponse`** | **Single type, single result path. Frontend checks `win` flag to decide rendering** |

**Rationale**: Both win and game-over carry the same `result` stats block. A boolean flag minimizes type changes and simplifies frontend branching.

---

## Data Flow

```
HomePage
  │  navigate(/quiz?mode=flag-guess-express)
  ▼
QuizPage
  │  GET /quiz/session?mode=flag-guess-express  →  startSession()
  │     (recognizes express slug, pre-generates pool)
  ▼
  │  Answer loop: POST /quiz/answer
  ▼
quizEngine.submitAnswer()
  │
  ├─ Evaluate answer, update lives
  ├─ gameOver (lives ≤ 0)? → return { result, gameOver: true }
  ├─ totalQuestions ≥ mode.totalQuestions? → return { result, win: true }   ✦ NEW
  ├─ Pool/country exhaustion?               → return { result, win: true }   ✦ NEW
  └─ Normal → return { nextQuestion }
                  │
                  ▼
            QuizPage
              ├─ win: true   → Win screen
              ├─ gameOver    → Game over screen
              └─ nextQuestion → Continue playing
```

---

## Win Detection Sequence

```
User                  QuizPage              quizEngine              DB
 │                       │                      │                    │
 │  POST /quiz/answer    │                      │                    │
 │─────────────────────►│                      │                    │
 │                       │  submitAnswer()      │                    │
 │                       │─────────────────────►│                    │
 │                       │                      │  UPDATE session    │
 │                       │                      │───────────────────►│
 │                       │                      │◄───────────────────│
 │                       │                      │                    │
 │                       │  ── Game over? ────  │                    │
 │                       │  lives ≤ 0 → end     │                    │
 │                       │                      │                    │
 │                       │  ── Express win? ──  │                    │
 │                       │  totalQuestions >=   │                    │
 │                       │  mode.totalQuestions │                    │
 │                       │                      │                    │
 │                       │  ── Exhaustion win?  │                    │
 │                       │  Pool empty AND      │                    │
 │                       │  generation fails    │                    │
 │                       │                      │                    │
 │  { result, win:true } │                      │                    │
 │◄─────────────────────│                      │                    │
 │                       │                      │                    │
 │  Win screen rendered  │                      │                    │
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types/index.ts` | Modify | Add 10 `GameModeSlug` variants, `totalQuestions` to `GameMode`, `win?` to `QuizAnswerResponse` |
| `apps/backend/src/services/gameModes.ts` | Modify | Add `totalQuestions` to `GameModeConfig`, add `createVariant` factory + 10 variant configs |
| `apps/backend/src/services/quizEngine.ts` | Modify | Insert express-win check after game-over check; catch country exhaustion in get-next-question |
| `apps/backend/src/db/schema/gameModes.ts` | Modify | Add `totalQuestions: integer('total_questions')` column |
| `apps/backend/src/db/migrations/0004_express_unlimited_modes.sql` | Create | Migration: `ALTER TABLE game_modes ADD COLUMN total_questions integer` |
| `apps/backend/scripts/seed-modes.ts` | Modify | Add 10 new mode rows with `totalQuestions` (30 for express, null for unlimited) |
| `apps/frontend/src/features/quiz/HomePage.tsx` | Modify | Group modes by base, show express/unlimited options per group |
| `apps/frontend/src/features/quiz/QuizPage.tsx` | Modify | Add win screen rendering when `result.win` is true |
| `apps/frontend/src/i18n/en.json` | Modify | Add mode names/descriptions + win screen keys |
| `apps/frontend/src/i18n/es.json` | Modify | Add mode names/descriptions + win screen keys |
| `apps/backend/src/__tests__/gameModes.test.ts` | Modify | Update count expectations (5 → 15), add variant tests |
| `apps/backend/src/__tests__/quizEngine.test.ts` | Modify | Add tests for win detection, express limit, unlimited exhaustion |

---

## Interfaces / Contracts

```typescript
// packages/shared/src/types/index.ts — additions

// 10 new slugs
type GameModeSlug = 
  | 'flag-guess' | 'capital-guess' | 'country-by-flag' | 'continent' | 'free'
  | 'flag-guess-express' | 'capital-guess-express' | 'country-by-flag-express'
  | 'continent-express' | 'free-express'
  | 'flag-guess-unlimited' | 'capital-guess-unlimited'
  | 'country-by-flag-unlimited' | 'continent-unlimited' | 'free-unlimited';

interface GameMode {
  // ... existing fields
  totalQuestions?: number;   // NEW: null = unlimited/lives, 30 = express
}

interface QuizAnswerResponse {
  // ... existing fields
  win?: boolean;             // NEW: true when mode completed successfully
}

// apps/backend/src/services/gameModes.ts — config extension
interface GameModeConfig {
  // ... existing fields
  totalQuestions?: number;   // NEW
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (gameModes) | All 15 configs resolvable, `totalQuestions` correct for express/unlimited | Update counts, assert `totalQuestions` per variant |
| Unit (quizEngine) | Express win at 30, unlimited win on exhaustion, game over before 30 | Test `submitAnswer` with mocked DB to verify `win: true` vs `gameOver` |
| Frontend (QuizPage) | Win screen renders for express/unlimited results | Component test with `win: true` response |

---

## Migration / Rollout

**DB**: Add `total_questions` column to `game_modes` (nullable, zero-downtime-compatible). Seed 10 new rows — existing modes unchanged, existing sessions unaffected.

**Rollback**: `git revert` the merge commit. Remove migration `0004` and 10 seeded rows via `DELETE FROM game_modes WHERE slug LIKE '%-express' OR slug LIKE '%-unlimited'`.

---

## Open Questions

None.
