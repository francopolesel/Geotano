# Multiplayer 1v1 Mode Specification

## Purpose

Real-time 1v1 geography quiz matches with invitation-only matchmaking, race-format gameplay, and friendly rankings that do not affect global scores or achievements.

## Requirements

### Requirement: Invitation flow

The system MUST support challenge invitations between friends via Socket.IO with accept, reject, and timeout handling.

- **Send**: GIVEN A is friends with B, WHEN A sends a challenge via socket event, THEN B receives a real-time notification with challenge details.
- **Accept**: GIVEN B receives A's challenge, WHEN B accepts, THEN a match room is created and both players join immediately.
- **Reject**: GIVEN B receives A's challenge, WHEN B rejects, THEN A is notified and no match is created.
- **Timeout**: GIVEN A sends a challenge to B, WHEN B does not respond within 30 seconds, THEN the challenge expires and A is notified.

### Requirement: Race format

The 1v1 match MUST use a race format: same question pool, randomized different order per player, shared 3-minute timer, unlimited questions, no per-question timeout.

- **Same pool**: GIVEN a 1v1 match starts, WHEN questions are generated, THEN both players draw from the same question pool.
- **Different order**: GIVEN both players in a 1v1 match, WHEN race starts, THEN each receives questions in randomized order distinct from the opponent.
- **Shared timer**: GIVEN a 1v1 match in progress, WHEN time passes or a player answers, THEN the remaining match time is identical for both players.
- **No per-question timer**: GIVEN a question is presented in race mode, WHEN the player answers after any duration within match time, THEN no per-question timeout is enforced.

### Requirement: Scoring

The system MUST award base points per correct answer plus streak bonus for 3+ consecutive correct answers. Speed bonus MUST NOT apply.

- **Correct**: GIVEN a player submits a correct answer, WHEN scored, THEN base points are added to their total.
- **Streak bonus**: GIVEN a player has answered 3 consecutive questions correctly, WHEN the 4th consecutive correct answer is scored, THEN a streak multiplier is applied.
- **No speed bonus**: GIVEN a player answers correctly in 2 seconds, WHEN scored, THEN no additional time-based points are awarded.

### Requirement: In-game feedback

The system MUST show an indicator when the opponent has answered the current question. The opponent's accumulated score MUST NOT be shown until the end screen.

- **Opponent answered**: GIVEN the opponent submits an answer, WHEN the current player's client receives the event, THEN an "opponent answered" indicator is displayed.
- **No live score**: GIVEN the opponent answers correctly, WHEN the current player is on a different question, THEN the opponent's score is NOT revealed.

### Requirement: End screen

The system MUST display a match results screen showing scores, correct counts, and max streaks for both players.

- **Results display**: GIVEN the match timer expires or both players exhaust the pool, WHEN the end screen loads, THEN each player sees their own and the opponent's score, correct answers count, and max streak.
- **Tie**: GIVEN both players have equal final scores, WHEN the end screen loads, THEN it shows a tie outcome. No tiebreaker is required.

### Requirement: Disconnection handling

The system MUST allow a disconnected player to rejoin within a 60-second grace period. After the grace period expires, the opponent is declared the winner.

- **Reconnect**: GIVEN a player disconnects mid-match, WHEN they reconnect via match ID within 60 seconds, THEN the match resumes from its current state.
- **Grace expired**: GIVEN a player disconnects, WHEN 60 seconds pass without reconnection, THEN the opponent is declared winner and the match ends.
- **Both disconnect**: GIVEN both players disconnect, WHEN the grace period expires for both, THEN the match is abandoned with no winner.
