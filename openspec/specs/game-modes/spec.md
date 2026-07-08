# Game Modes Specification

## Purpose

Five base quiz types with variant system: Standard (50 questions, 3 lives), Unlimited (no limit, 3 lives), Hardcore (no limit, 1 life). Express variant removed from UI/config; Express strings kept in type union for DB backward compat.

## Requirements

### Requirement: Selection

MUST let player choose any base mode + variant before starting.

- **Pick mode + variant**: GIVEN home screen, WHEN player selects "Capital→Country" + "Hardcore", THEN session starts with capital questions, 1 life, unlimited questions.

### Requirement: Domain rules

MUST generate questions matching each mode's type.

- **Flag→Country**: GIVEN Flag mode active, WHEN question generated, THEN flag image + country name options.
- **Free Mixed**: GIVEN Mixed mode, WHEN generated, THEN each question randomly picks from the other 4 types.

### Requirement: Mode metadata

SHOULD display mode name, icon, and brief description on selection screen.

- **Info**: GIVEN mode carousel, WHEN rendered, THEN each card shows name + icon + description.

### Requirement: Available variants

MUST provide 3 active variant families: `standard`, `unlimited`, `hardcore`. Express strings remain in type union for DB backward compat only.

| Variant | Questions | Lives | UI Visible |
|---------|-----------|-------|------------|
| standard | 50 | 3 | Yes |
| unlimited | unlimited | 3 | Yes |
| hardcore | unlimited | 1 | Yes |
| express | 30 (legacy) | 3 | No |

- **Standard**: GIVEN Standard selected, WHEN game starts, THEN 50 questions, 3 lives.
- **Unlimited**: GIVEN Unlimited selected, WHEN game starts, THEN no limit, 3 lives.
- **Hardcore**: GIVEN Hardcore selected, WHEN game starts, THEN no limit, 1 life.
- **Express hidden**: GIVEN mode selection screen, WHEN viewing available variants, THEN Express SHALL NOT appear.

### Requirement: Ending conditions per variant

Each variant MUST end explicitly: lives=0→game over, limit reached→win, pool exhausted→win.

| Variant | Game Over | Win | Win (alt) |
|---------|-----------|-----|-----------|
| standard | lives=0 | 50 answered | pool exhausted |
| unlimited | lives=0 | — | pool exhausted |
| hardcore | lives=0 | — | pool exhausted |

- **Standard limit win**: GIVEN Standard game with 48 correct, WHEN 2 more answered, THEN session ends as win.
- **Pool exhaustion**: GIVEN any variant, WHEN no questions remain, THEN session ends as win.
- **Game over**: GIVEN any variant with 0 lives, WHEN unanswered question, THEN session ends as game over.
