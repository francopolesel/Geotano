# Delta for quiz-gameplay

## ADDED Requirements

### Requirement: Explicit end conditions

Every quiz session MUST end under one of these scenarios: lives reach 0 (game over), question limit reached (win), or pool exhausted (win). The system MUST NOT hang, crash, or enter an unhandled state.

- **Lives zero**: GIVEN active session with 0 lives, WHEN next question would be served, THEN session ends as game over.
- **Limit reached**: GIVEN Standard variant with `totalQuestions` reached, WHEN all questions answered, THEN session ends as win.
- **Pool exhausted**: GIVEN Unlimited or Hardcore variant, WHEN no unused questions remain in the pool for the selected mode, THEN session ends as win.

## MODIFIED Requirements

### Requirement: Lives

MUST start with configurable lives: 3 for Standard and Unlimited, 1 for Hardcore. Lose 1 per wrong or timeout.
(Previously: fixed at 3 lives for all modes.)

- **Standard death**: GIVEN Standard game with 3 lives, WHEN wrong answer, THEN lives decrement to 2, session continues.
- **Hardcore death**: GIVEN Hardcore game with 1 life, WHEN wrong answer, THEN lives reach 0, session ends as game over.
- **Unlimited death**: GIVEN Unlimited game with 3 lives, WHEN timeout, THEN lives decrement to 2, session continues.

### Requirement: Timer

MUST enforce 15s countdown per question. Timer behavior is unchanged across all variants.
(Previously: no variant-specific timer rules — this is a clarification, not a behavioral change.)

- **On time**: GIVEN active question, WHEN correct before timeout, THEN marked correct + advance.
- **Timeout**: GIVEN active question, WHEN timer expires, THEN missed + lose life (no change from existing behavior).
