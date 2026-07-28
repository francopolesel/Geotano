# Delta for Quiz Gameplay

## MODIFIED Requirements

### Requirement: Questions

MUST generate 4-option multiple-choice; correct answer hidden from client. Async multiplayer mode MUST present the same 50-question pool with randomized different order per player.
(Previously: "Race mode MUST present the same question pool with randomized different order per player" — no pool size specified)

- **Generation**: GIVEN game mode + country data, WHEN question requested, THEN text + 4 options returned.
- **Async pool**: GIVEN an async match, WHEN 50 questions are pre-generated at match creation, THEN both players draw from the same 50-question pool in individually randomized order.

### Requirement: Timer

MUST enforce 15s countdown per question across Standard, Unlimited, and Hardcore variants. Async multiplayer mode MUST use a per-player 3-minute timer starting when the player clicks "Play". Does NOT apply to async mode per-question.
(Previously: "Does NOT apply to race mode" — no per-player timer specified)

- **On time**: GIVEN active question, WHEN correct answer before timeout, THEN marked correct + advance.
- **Timeout**: GIVEN active question, WHEN timer expires, THEN missed + lose life.
- **Async per-player timer**: GIVEN an async match player clicks "Play", WHEN their 3-minute timer expires, THEN their turn ends and no more questions are served without any life penalty.

### Requirement: Lives

MUST start with configurable lives: 3 for Standard and Unlimited, 1 for Hardcore. Lose 1 per wrong or timeout. Async multiplayer mode MUST NOT use a lives system.
(Previously: "Race mode MUST NOT use a lives system")

- **Standard death**: GIVEN Standard game with 3 lives, WHEN wrong answer, THEN lives → 2, session continues.
- **Hardcore death**: GIVEN Hardcore game with 1 life, WHEN wrong answer, THEN lives → 0, session ends as game over.
- **Timeout**: GIVEN Unlimited game with 3 lives, WHEN timer expires, THEN lives → 2, session continues.

### Requirement: Explicit end conditions

Every quiz session MUST end under one of these scenarios and MUST NOT hang, crash, or enter an unhandled state.

- **Lives zero → game over**: GIVEN session with 0 lives, WHEN next question would be served, THEN session ends as game over.
- **Limit reached → win**: GIVEN Standard variant where `answeredCount = totalQuestions`, WHEN question answered, THEN session ends as win.
- **Pool exhausted → win**: GIVEN Unlimited or Hardcore variant, WHEN no unused questions remain for the selected mode, THEN session ends as win.
- **Async timer expired → end**: GIVEN async match, WHEN the per-player 3-minute timer reaches zero, THEN that player's turn ends and their current answers are finalized with the score calculated.
(Previously: "Timer expired → end: GIVEN race mode match, WHEN the shared 3-minute timer reaches zero, THEN the match ends and results are displayed")

### Requirement: Async match variant

The system MUST support an async match variant for 1v1 multiplayer with the following parameters: per-player 3-minute timer, no lives, no per-question timeout, and 50 questions served per match.
(Previously: "Race mode variant with shared 3-minute timer, no lives, no per-question timeout, and unlimited questions served within the match duration")

- **Per-player timer**: GIVEN an async match, WHEN a player answers questions, THEN their remaining time is independent of the opponent's timer.
- **No lives**: GIVEN an async match, WHEN a player answers incorrectly, THEN no life is deducted and the game continues.
- **No per-question timeout**: GIVEN a question is presented in async mode, WHEN the player answers after any duration within their 3-minute timer, THEN the answer is accepted without timeout penalty.
- **Fixed 50 questions**: GIVEN an async match in progress, WHEN a player answers all 50 questions, THEN their turn ends and no more questions are served.

## REMOVED Requirements

### Requirement: Race mode variant

(Reason: Replaced by async match variant. The shared-timer race model is removed in favor of per-player async timers.)
(Migration: The "Async match variant" requirement above replaces this. Update all references from "race mode" to "async match" or "multiplayer match".)
