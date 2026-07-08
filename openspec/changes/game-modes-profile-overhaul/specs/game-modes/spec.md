# Delta for game-modes

## ADDED Requirements

### Requirement: Available variants

The system MUST provide exactly 3 active variant families: `standard`, `unlimited`, `hardcore`. Express variant is removed from UI and config; Express strings remain in type union for DB backward compat only.

- **Standard**: GIVEN Standard selected, WHEN game starts, THEN 50 questions, 3 lives.
- **Unlimited**: GIVEN Unlimited selected, WHEN game starts, THEN no limit, 3 lives.
- **Hardcore**: GIVEN Hardcore selected, WHEN game starts, THEN no limit, 1 life.
- **Express hidden**: GIVEN mode selection screen, WHEN viewing available variants, THEN Express SHALL NOT appear.

### Requirement: Slug pattern

Each mode MUST use `{base}-{variant}` slug pattern. Hardcore slugs: `flag-hardcore`, `capital-hardcore`, `country-flag-hardcore`, `continent-hardcore`, `mixed-hardcore`. Express slugs (`flag-express`, etc.) MUST remain in the `GameModeSlug` type union for DB reads.

- **15 active slugs**: GIVEN 5 base types × 3 variants, WHEN listing active modes, THEN exactly 15 slugs.
- **Express readable**: GIVEN persisted session with `flag-express` slug, WHEN reading from DB, THEN no crash — Express is in the type union.

### Requirement: Ending conditions per variant

Each variant MUST end under explicit conditions:

| Variant | Game Over | Win | Win (alt) |
|---------|-----------|-----|-----------|
| standard | lives=0 | 50 questions answered | pool exhausted |
| unlimited | lives=0 | — | pool exhausted |
| hardcore | lives=0 | — | pool exhausted |

- **Standard limit win**: GIVEN Standard game with 48 correct, WHEN 2 more answered correctly, THEN session ends as win.
- **Pool exhaustion**: GIVEN any variant, WHEN no questions remain, THEN session ends as win.
- **Game over**: GIVEN any variant with 0 lives, WHEN unanswered question occurs, THEN session ends as game over.

## MODIFIED Requirements

### Requirement: Selection

MUST let player choose any base mode + variant before starting.
(Previously: player chose mode only, variant not specified.)

- **Pick mode + variant**: GIVEN home screen, WHEN player selects "Capital→Country" + "Hardcore", THEN session starts with capital questions, 1 life, unlimited questions.

## REMOVED Requirements

None — Express variant was not captured in the existing spec.
