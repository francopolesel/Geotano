# Delta for quiz-gameplay

## ADDED Requirements

### Requirement: Race mode variant

The system MUST support a race mode for 1v1 multiplayer with the following parameters: shared 3-minute timer, no lives, no per-question timeout, and unlimited questions served within the match duration.

- **Shared timer**: GIVEN a race mode match, WHEN players answer questions, THEN the same remaining duration is displayed and enforced for both.
- **No lives**: GIVEN a race mode match, WHEN a player answers incorrectly, THEN no life is deducted and the game continues.
- **No per-question timeout**: GIVEN a question is presented in race mode, WHEN the player answers after any duration within match time, THEN the answer is accepted without timeout penalty.
- **Unlimited questions**: GIVEN a race mode match in progress, WHEN questions remain in the pool, THEN the next question is served until the 3-minute timer expires.

## MODIFIED Requirements

### Requirement: Questions

MUST generate 4-option multiple-choice; correct answer hidden from client. Race mode MUST present the same question pool with randomized different order per player.
(Previously: single-player ordering only)

- **Generation**: GIVEN game mode + country data, WHEN question requested, THEN text + 4 options returned.
- **Race order**: GIVEN a race mode match, WHEN both players start, THEN each receives questions from the same pool in randomized order distinct from the opponent.

### Requirement: Timer

MUST enforce 15s countdown per question across Standard, Unlimited, and Hardcore variants. Does NOT apply to race mode.
(Previously: applied to all variants)

- **On time**: GIVEN active question, WHEN correct answer before timeout, THEN marked correct + advance.
- **Timeout**: GIVEN active question, WHEN timer expires, THEN missed + lose life.

### Requirement: Lives

MUST start with configurable lives: 3 for Standard and Unlimited, 1 for Hardcore. Lose 1 per wrong or timeout. Race mode MUST NOT use a lives system.
(Previously: lives applied to all modes)

- **Standard death**: GIVEN Standard game with 3 lives, WHEN wrong answer, THEN lives → 2, session continues.
- **Hardcore death**: GIVEN Hardcore game with 1 life, WHEN wrong answer, THEN lives → 0, session ends as game over.
- **Timeout**: GIVEN Unlimited game with 3 lives, WHEN timer expires, THEN lives → 2, session continues.

### Requirement: Explicit end conditions

Every quiz session MUST end under one of these scenarios and MUST NOT hang, crash, or enter an unhandled state.

- **Lives zero** → game over: GIVEN session with 0 lives, WHEN next question would be served, THEN session ends as game over.
- **Limit reached** → win: GIVEN Standard variant where `answeredCount = totalQuestions`, WHEN question answered, THEN session ends as win.
- **Pool exhausted** → win: GIVEN Unlimited or Hardcore variant, WHEN no unused questions remain for the selected mode, THEN session ends as win.
- **Timer expired** → end: GIVEN race mode match, WHEN the shared 3-minute timer reaches zero, THEN the match ends and results are displayed.
