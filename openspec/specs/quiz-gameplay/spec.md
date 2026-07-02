# Quiz Gameplay Specification

## Purpose

Question engine with timer, lives, streaks, and scoring.

## Requirements

### Requirement: Questions
MUST generate 4-option multiple-choice; correct answer hidden from client.
- **Generation**: GIVEN game mode + country data, WHEN question requested, THEN text + 4 options returned.

### Requirement: Timer
MUST enforce 15s countdown per question.
- **On time**: GIVEN active question, WHEN correct answer before timeout, THEN marked correct + advance.
- **Timeout**: GIVEN active question, WHEN timer expires, THEN missed + lose life.

### Requirement: Lives
MUST start 3 lives, lose 1 per wrong/missed, game over at 0.
- **Death**: GIVEN 0 lives, WHEN wrong or timeout, THEN session ends + score persisted.

### Requirement: Scoring
MUST calculate base points + streak multiplier (3+ consecutive correct).
- **Streak**: GIVEN 3 correct in a row, WHEN 4th correct, THEN streak bonus applied to score.
