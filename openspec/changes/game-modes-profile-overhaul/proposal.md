# Proposal: Game Modes & Profile Overhaul

## Intent

5 base modes × 3 variants (standard/express/unlimited) all with 3 lives creates a bloated grid. Hardcore mode (1 life), remove Express, add My Profile tab in Settings, and new achievements.

## Scope

### In Scope
- 5 new `-hardcore` slugs: 1 life, unlimited questions, same 5 base types
- Remove Express from UI + config; Standard → 50 questions
- Every mode ends: lives=0 → game over, limit → win, pool exhausted → win
- SettingsPage tabs: Profile | Preferences | Password | My Profile
- AppShell sidebar: add My Profile nav link
- 3 hardcore achievements; `all_modes` counts base families, not variant slugs

### Out of Scope
- Backend architecture rewrite (slug pattern stays)
- Removing Express from DB types (kept for backward compat)
- Quiz engine or scoring rewrite
- Public profile page redesign

## Capabilities

### New
- `hardcore-mode`: 1-life unlimited variant across all 5 question types

### Modified
- `game-modes`: Remove Express, Standard → 50q, add hardcore lifecycle
- `quiz-gameplay`: Lives configurable (1 or 3); all end conditions verified

## Approach

5 hardcore variants via `createVariant(lives:1, totalQuestions:undefined)`. Remove Express from config/UI/seed data; keep Express strings in type union for DB reads. Standard 60→50q. SettingsPage: stacked sections → tabbed layout (FriendsPage pattern). My Profile tab: stats + achievements (read-only from `/users/:id/profile`). 3 new hardcore achievements in `checkAchievements()`. `all_modes` groups by base prefix (5 families, not 20 slugs).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `gameModes.ts` | Modified | Hardcore variants, remove Express |
| `types/index.ts` | Modified | Extend `GameModeSlug`, keep Express |
| `achievements.ts` | Modified | 3 hardcore checks, all_modes logic |
| `seed-achievements.ts` | Modified | 3 new rows |
| `SettingsPage.tsx` | Modified | Tabs + My Profile tab |
| `AppShell.tsx` | Modified | My Profile nav link |
| `i18n/*.json` | Modified | New keys |
| `.test.ts` files | Modified | New slugs + mode counts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Express slugs in DB sessions break reads | Medium | Keep in type union for reads, UI-only removal |
| `all_modes` overcounts hardcore slugs | Low | Group by base prefix, not full slug |
| Settings tab UX differs from stacked | Low | Use proven FriendsPage pattern |

## Rollback Plan

Revert `gameModes.ts` + `types/index.ts`. Restore SettingsPage stacked sections. Remove My Profile nav. Hardcore achievement seeds are safe (`ON CONFLICT DO NOTHING`).

## Success Criteria

- [ ] 20 slugs functional (15 + 5 hardcore); all modes end explicitly
- [ ] SettingsPage: 4 tabs (Profile, Preferences, Password, My Profile)
- [ ] AppShell: My Profile nav link renders
- [ ] 3 hardcore achievements award correctly
- [ ] `all_modes` counts 5 base families, not 20 slugs
- [ ] All existing tests pass with updated slugs + counts
