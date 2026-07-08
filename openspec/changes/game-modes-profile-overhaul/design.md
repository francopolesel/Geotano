# Design: Game Modes & Profile Overhaul

## Technical Approach

Extend the existing variant factory pattern (`createVariant`) to support 3 suffixes instead of 2, adding `hardcore` (1 life, no question limit). Remove Express from UI/config/seed data while keeping Express strings in the type union for DB backward compat. Convert SettingsPage from stacked sections to a tabbed layout reusing FriendsPage's segmented-control pattern. Add 3 hardcore achievements and fix `all_modes` grouping by base prefix.

## Architecture Decisions

### Decision: Variant factory extension
| Option | Tradeoff | Decision |
|--------|----------|----------|
| New configs hardcoded | Duplicates logic, but no factory change | ❌ |
| Add `hardcore` to `createVariant` suffix param | Single change, reuses all inheritance | ✅ |

**Rationale**: `hardcore` differs from express/unlimited only in `lives: 1` and `totalQuestions: undefined`. The factory needs a `lives` override param.

### Decision: Lives in StartSessionResponse
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Hardcode 3 hearts on frontend | Breaks hardcore mode (shows 3 hearts) | ❌ |
| Add `maxLives` to API response | One field, frontend renders dynamically | ✅ |

**Rationale**: Backend already has `config.lives`. Returning it alongside `totalQuestions` lets the QuizPage render the correct number of hearts.

### Decision: Express type removal
| Decision | Details |
|----------|---------|
| Express slugs removed from `GameModeSlug` type union | No — kept for DB backward compat |
| Express removed from `createVariant`, `seed-modes`, `MODE_GROUPS`, i18n keys | Yes |
| Express records in DB are orphaned (never served by UI) | Acceptable — `ON CONFLICT DO NOTHING` in seed |

### Decision: all_modes grouping
| Option | Tradeoff | Decision |
|--------|----------|----------|
| Count distinct slugs | 20 slugs = too many, unlocks too fast | ❌ |
| Group by base prefix (strip `-*` suffix) | 5 families match user intent | ✅ |

**Rationale**: A user playing all 5 base modes across any variant should earn this.

## Data Flow

```
HomePage:MODE_GROUPS ──→ GET /quiz/session?mode=X ──→ quizEngine.startSession()
                                                           │
                                                      config.lives=1 (hardcore)
                                                           │
                                                    { sessionId, question, maxLives }

QuizPage ──→ POST /quiz/answer ──→ submitAnswer()
  ──→ livesRemaining, win/result  ──→ result screen or next question
  ──→ pool exhausted             ──→ win (unlimited modes)
  ──→ lives=0                    ──→ game over

SettingsPage (tabs) ──→ Profile | Preferences | Password | My Profile
                                        ↕
MyProfileTab ──→ GET /users/:id/profile (own user) ──→ stats + achievements + recentGames

checkAchievements() ──→ modeSlugs → strip suffix → dedupe by base → count ≥ 5 for all_modes
```

## Component Tree

```
AppShell
├── NavLink: My Profile (/profile/:userId)
└── SettingsPage
    ├── TabBar (segmented: Profile | Preferences | Password | My Profile)
    ├── ProfileTab       ← ProfileSection (moved from stacked)
    ├── PreferencesTab   ← PreferencesSection (moved)
    ├── PasswordTab      ← PasswordSection (moved)
    └── MyProfileTab
        ├── StatCard (bestScore)
        ├── StatCard (totalGames)
        ├── StatCard (perfectGames)  ← NEW
        ├── StatCard (streak)
        └── AchievementBadge[] grid
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/types/index.ts` | Modify | Add 5 hardcore slugs to `GameModeSlug`; keep Express slugs |
| `apps/backend/src/services/gameModes.ts` | Modify | Add `hardcore` to `createVariant` suffix union, add lives param override, add 5 hardcore configs, Standard 60→50 |
| `apps/backend/src/services/quizEngine.ts` | Modify | Return `maxLives` in `StartSessionResponse`; audit end conditions |
| `apps/backend/src/services/achievements.ts` | Modify | 3 hardcore checks; `all_modes` strips suffix before dedupe |
| `apps/backend/scripts/seed-modes.ts` | Modify | Remove Express variants; add 5 hardcore variants; Standard 60→50 |
| `apps/backend/scripts/seed-achievements.ts` | Modify | 3 new hardcore achievement rows (sortOrder 16-18) |
| `apps/frontend/src/features/quiz/HomePage.tsx` | Modify | Remove Express variants from `MODE_GROUPS`; add hardcore variant |
| `apps/frontend/src/features/quiz/QuizPage.tsx` | Modify | Dynamic hearts based on `maxLives`; update `SessionResponse` type |
| `apps/frontend/src/features/settings/SettingsPage.tsx` | Modify | Convert to tabbed layout; add MyProfileTab component |
| `apps/frontend/src/features/settings/SettingsPage.test.tsx` | Modify | Update tests for tab navigation |
| `apps/frontend/src/store/gameStore.ts` | Modify | Add `maxLives` field; `reset()` uses parameterized lives |
| `apps/frontend/src/components/AppShell.tsx` | Modify | Add My Profile nav link to `navItems` |
| `apps/frontend/src/i18n/en.json` | Modify | New keys for hardcore modes, profile my-profile tab, achievements |
| `apps/frontend/src/i18n/es.json` | Modify | Same new keys (Spanish) |
| `apps/backend/src/__tests__/gameModes.test.ts` | Modify | 15→20 configs; Standard 60→50; hardcore lives=1 |
| `apps/backend/src/__tests__/achievements.test.ts` | Modify | 15→18 achievements; all_modes grouping test |

## Interfaces / Contracts

```typescript
// StartSessionResponse — new maxLives field
export interface StartSessionResponse {
  sessionId: string;
  question: ClientQuestion;
  totalQuestions?: number;
  maxLives: number; // NEW — enables dynamic heart rendering
}

// GameModeSlug — 5 new hardcore slugs added (Express slugs kept)
export type GameModeSlug =
  | 'flag-guess' | 'flag-guess-express' | 'flag-guess-unlimited' | 'flag-guess-hardcore'
  | 'capital-guess' | 'capital-guess-express' | 'capital-guess-unlimited' | 'capital-guess-hardcore'
  | 'country-by-flag' | 'country-by-flag-express' | 'country-by-flag-unlimited' | 'country-by-flag-hardcore'
  | 'continent' | 'continent-express' | 'continent-unlimited' | 'continent-hardcore'
  | 'free' | 'free-express' | 'free-unlimited' | 'free-hardcore';

// gameStore — dynamic maxLives
interface GameState {
  maxLives: number; // NEW — stores mode's configured lives (3 or 1)
  lives: number;    // current remaining lives (updated from backend)
}

// createVariant — new lives override param
function createVariant(
  base: GameModeConfig,
  suffix: 'express' | 'unlimited' | 'hardcore',
  totalQuestions?: number,
  livesOverride?: number, // NEW: 1 for hardcore
): GameModeConfig;
```

## Quiz Engine End Conditions Audit

| Path | Trigger | Current Behavior | Correct? |
|------|---------|-----------------|----------|
| Game over | `livesRemaining <= 0` after wrong answer | Sets `isActive=false`, returns `result` | ✅ |
| Win by limit | `totalQuestions >= config.totalQuestions` | Sets `win=true`, `isActive=false`, returns `result` | ✅ |
| Win by exhaustion | Pool empty + no countries available | Catches `No countries available`, returns `win=true` | ✅ |
| Infinite loop | `generateQuestion` retry loop (30 max) | Breaks after 30 attempts, throws `No countries available` | ✅ — caught by exhaustion path |
| Timer expiry | `timeMs > timeLimitMs + GRACE_MS` | Treated as wrong answer, deducted life | ✅ |

**No changes needed** — all 3 end conditions are correct. The audit confirms no infinite loops or crashes.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | gameModes.ts | 20 configs, hardcore lives=1, Standard totalQuestions=50 |
| Unit | achievements.ts | 18 achievements; all_modes with `-hardcore` slugs in DB groups to 5 |
| Unit | quizEngine.ts | Hardcore mode: lives=1, game over on first wrong, unlimited pool |
| Integration | quiz routes | Start + answer with hardcore mode slug |
| Unit | SettingsPage test | 4 tabs render, MyProfileTab fetches profile |
| E2E | Full flow | Play hardcore mode → game over on wrong → check achievement |

## Migration / Rollout

No data migration required. Express DB records remain orphaned — seed script uses `ON CONFLICT DO NOTHING`. Hardcore slugs are new inserts. `all_modes` re-evaluates on next game completion (no backfill needed).

## Open Questions

- None resolved during reading. The existing quizEngine end conditions are already correct.
