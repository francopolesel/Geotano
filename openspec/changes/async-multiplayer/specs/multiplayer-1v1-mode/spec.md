# Delta for Multiplayer 1v1 Mode

## MODIFIED Requirements

### Requirement: Invitation flow

The system MUST support challenge invitations between friends via REST API with game mode selection. Challenges persist in the `match_challenges` table until accepted or declined. Socket.IO is used for live notifications only.

- **Send**: GIVEN A is friends with B, WHEN A selects a game mode and clicks "Desafiar", THEN POST /matches/challenge creates a challenge DB record and B receives a Socket.IO `challenge:invite` notification if online.
- **Accept**: GIVEN B receives a challenge notification, WHEN B calls POST /matches/accept, THEN a `match_games` record is created with 50 pre-generated questions, `match_challenges.status` becomes "accepted", and A is notified.
- **Decline**: GIVEN B receives a challenge, WHEN B calls POST /matches/decline, THEN `match_challenges.status` becomes "declined" and A is notified.
- **Mode selection**: GIVEN A opens the challenge modal, WHEN they pick a game mode, THEN the `game_mode_slug` is stored in the challenge and used to generate match questions.
(Previously: Socket.IO challenges with 30-second timeout, no mode selection, no persistence)

### Requirement: Async play format

The match MUST use an async format: same 50-question pool per match, randomized different order per player, per-player 3-minute timer starting on "Play" click. No per-question timeout.

- **Same pool**: GIVEN an async match is accepted, WHEN questions are generated, THEN both players draw from the same 50-question pool.
- **Different order**: GIVEN both players in an async match, WHEN each clicks "Play", THEN each receives the 50 questions in randomized order distinct from the opponent.
- **Per-player timer**: GIVEN a player clicks "Play", WHEN the match starts for them, THEN a 3-minute timer begins counting down for that player only; the opponent's timer is unaffected.
- **Fixed questions**: GIVEN an async match, WHEN a player answers all 50 questions or their timer expires, THEN their turn ends and no more questions are served.
- **No per-question timeout**: GIVEN a question is presented in async mode, WHEN the player answers after any duration within their 3-minute timer, THEN no per-question timeout is enforced.
(Previously: shared 3-minute timer, unlimited questions)

### Requirement: Scoring

The system MUST award base points per correct answer plus streak bonus for 3+ consecutive correct answers. Speed bonus MUST NOT apply.

- **Correct**: GIVEN a player submits a correct answer, WHEN scored, THEN base points are added to their total.
- **Streak bonus**: GIVEN a player has answered 3 consecutive questions correctly, WHEN the 4th consecutive correct answer is scored, THEN a streak multiplier is applied.
- **No speed bonus**: GIVEN a player answers correctly in 2 seconds, WHEN scored, THEN no additional time-based points are awarded.

### Requirement: End screen

The system MUST display match results when the user views a completed match, showing both players' scores, correct counts, and max streaks. Winner is determined server-side when both players finish.

- **Results display**: GIVEN both players have finished the match, WHEN a participant views GET /matches/:id, THEN they see each player's score, correct answers count, max streak, and the winner.
- **Pending opponent**: GIVEN the current player has finished but the opponent has not, WHEN they view the match, THEN the opponent's stats show as "pending" and winner is null.
- **Tie**: GIVEN both players have equal final scores, WHEN the match is completed, THEN a tie outcome is displayed. No tiebreaker is required.
(Previously: real-time end screen shown immediately after match ends)

## REMOVED Requirements

### Requirement: In-game feedback

(Reason: Async play has no real-time opponent presence. No "opponent answered" indicator or live feedback during gameplay.)
(Migration: Remove opponent-answered indicator from the match play UI. No replacement needed.)

### Requirement: Disconnection handling

(Reason: Async model has no persistent connection requirement. Players may close the browser mid-game and resume later. Disconnection is a non-event.)
(Migration: No replacement needed. Player progress is persisted per-answer submission via REST.)
