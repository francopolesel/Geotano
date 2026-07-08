# Hardcore Mode Specification

## Purpose

One-life variant across all 5 question types. Same rules as Unlimited mode (no question limit, standard scoring) but with 1 life instead of 3.

## Requirements

### Requirement: Life count

Hardcore mode MUST start with exactly 1 life. Losing that life ends the game.

- **Single life death**: GIVEN Hardcore game with 1 life, WHEN player answers wrong, THEN lives reach 0 and session ends as game over.

### Requirement: Question limit

Hardcore mode MUST NOT have a question limit. Questions continue until the pool is exhausted or the player loses their life.

- **Unlimited questions**: GIVEN Hardcore game active, WHEN player answers all available pool questions, THEN session ends as win.

### Requirement: Slug pattern

Hardcore mode MUST use `-hardcore` suffixed slugs: `flag-hardcore`, `capital-hardcore`, `country-flag-hardcore`, `continent-hardcore`, `mixed-hardcore`.

- **Slug creation**: GIVEN Hardcore variant selected for Flag mode, WHEN session initializes, THEN slug is `flag-hardcore`.
- **All 5 slugs**: GIVEN 5 base types, WHEN Hardcore variant exists for each, THEN 5 hardcore slugs are available.

### Requirement: Scoring

Hardcore mode MUST use the same scoring rules as Unlimited mode: base points + streak multiplier. No score changes specific to Hardcore.

- **Scoring match**: GIVEN Hardcore game, WHEN player answers correctly, THEN score calculation matches Unlimited mode rules.

### Requirement: Ending conditions

Hardcore mode MUST end explicitly under two conditions: lives = 0 (game over) or pool exhausted (win). No other terminal states.

- **Pool win**: GIVEN Hardcore game with questions remaining, WHEN player answers the last available question correctly, THEN session ends as win.
- **No crash on empty**: GIVEN Hardcore game, WHEN pool is already exhausted, THEN requesting a new question returns session-end instead of crashing.
