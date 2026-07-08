# Quiz Gameplay Specification

## Purpose

Question engine with timer, lives, streaks, scoring, and explicit end conditions for every scenario.

## Requirements

### Requirement: Questions

MUST generate 4-option multiple-choice; correct answer hidden from client.

- **Generation**: GIVEN game mode + country data, WHEN question requested, THEN text + 4 options returned.

### Requirement: Timer

MUST enforce 15s countdown per question across all variants.

- **On time**: GIVEN active question, WHEN correct answer before timeout, THEN marked correct + advance.
- **Timeout**: GIVEN active question, WHEN timer expires, THEN missed + lose life.

### Requirement: Lives

MUST start with configurable lives: 3 for Standard and Unlimited, 1 for Hardcore. Lose 1 per wrong or timeout.

- **Standard death**: GIVEN Standard game with 3 lives, WHEN wrong answer, THEN lives → 2, session continues.
- **Hardcore death**: GIVEN Hardcore game with 1 life, WHEN wrong answer, THEN lives → 0, session ends as game over.
- **Timeout**: GIVEN Unlimited game with 3 lives, WHEN timer expires, THEN lives → 2, session continues.

### Requirement: Explicit end conditions

Every quiz session MUST end under one of these scenarios and MUST NOT hang, crash, or enter an unhandled state.

- **Lives zero** → game over: GIVEN session with 0 lives, WHEN next question would be served, THEN session ends as game over.
- **Limit reached** → win: GIVEN Standard variant where `answeredCount = totalQuestions`, WHEN question answered, THEN session ends as win.
- **Pool exhausted** → win: GIVEN Unlimited or Hardcore variant, WHEN no unused questions remain for the selected mode, THEN session ends as win.

### Requirement: Scoring

MUST calculate base points + streak multiplier (3+ consecutive correct).

- **Streak**: GIVEN 3 correct in a row, WHEN 4th correct, THEN streak bonus applied to score.

### Requirement: Localized questions

Quiz questions MUST use `nameEs`/`capitalEs` fields when `?lang=es` query param is sent, and English templates with `nameEn`/`capitalEn` by default.

- **Spanish**: GIVEN quiz endpoint called with `?lang=es`, WHEN generating a question, THEN `nameEs` and `capitalEs` fields are used.
- **Default English**: GIVEN quiz endpoint called without `?lang`, WHEN generating, THEN `nameEn`/`capitalEn` are used.
- **Invalid lang fallback**: GIVEN quiz endpoint with `?lang=fr`, WHEN generating, THEN fall back to English (`nameEn`/`capitalEn`).
