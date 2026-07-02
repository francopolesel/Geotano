# Game Modes Specification

## Purpose

Five quiz variants: flag→country, capital→country, country→flag, continent, free mixed.

## Requirements

### Requirement: Selection
MUST let player choose any mode before starting.
- **Pick mode**: GIVEN home screen, WHEN player selects "Capital→Country", THEN session starts with capital questions only.

### Requirement: Domain rules
MUST generate questions matching each mode's type.
- **Flag→Country**: GIVEN Flag mode active, WHEN question generated, THEN flag image + country name options.
- **Free Mixed**: GIVEN Mixed mode, WHEN generated, THEN each question randomly picks from the other 4 types.

### Requirement: Mode metadata
SHOULD display mode name, icon, and brief description on selection screen.
- **Info**: GIVEN mode carousel, WHEN rendered, THEN each card shows name + icon + description.
