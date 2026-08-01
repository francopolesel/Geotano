# Delta for Multiplayer 1v1 Mode

## MODIFIED Requirements

### Requirement: End screen

The system MUST display a match results screen showing scores, correct counts, and max streaks for both players. When both players have finished, the match MUST complete atomically: after each finish (answer submit or timer expiry), the backend MUST re-read both finished flags and both scores in a fresh read and compute `winnerId` from those fresh scores. Simultaneous finish MUST transition the match to `completed` and MUST NOT leave it `in_progress` with both `finished=true`. On completion, the backend MUST emit a `match:finished` socket event (`matchId`, `status`) to both players' connected sockets, and each client MUST connect to the socket on match-screen mount and transition from the waiting screen to the results screen immediately upon receipt; the 10s poll MUST remain as a fallback for offline or reconnected players. When a finish response reports `matchEnded=true`, the client MUST transition to the results screen directly, without waiting for a poll tick. On a completed match, the results screen MUST also offer a rematch action that sends a new challenge to the same opponent, reusing the match's game mode and duration.

(Previously: results were delivered only via 10s polling; completion was decided from a stale pre-fetch snapshot, so simultaneous finish could stick the match `in_progress` with both `finished=true` and no `winnerId`)

- **Results display**: GIVEN the match timer expires or both players exhaust the pool, WHEN the end screen loads, THEN each player sees their own and the opponent's score, correct answers count, and max streak.
- **Tie**: GIVEN both players have equal final scores, WHEN the end screen loads, THEN it shows a tie outcome. No tiebreaker is required.
- **Rematch button**: GIVEN the end screen shows a completed match, WHEN it renders, THEN a Rematch button using the `multiplayer.rematch` i18n key is displayed before the Back to Home button.
- **Rematch payload**: GIVEN a player taps Rematch, WHEN the challenge is sent, THEN POST /matches/challenge is called with `receiverId` = opponent.id, `gameModeSlug` = match.gameModeSlug, and `durationMinutes` = match.durationMinutes.
- **Sending state**: GIVEN a player taps Rematch, WHEN the request is in flight, THEN the button is disabled, the waiting label `multiplayer.waitingResponse` is shown, and a second tap MUST NOT send another challenge.
- **Rematch accepted**: GIVEN a rematch challenge is accepted, WHEN the `challenge:accepted` socket event arrives, THEN the client auto-navigates to the new match room.
- **Rematch error**: GIVEN the rematch challenge request fails, THEN the error is mapped to an existing i18n key — `challengeNotFriends` (403), `challengeInFlight` (409), `challengePending` (409), `challengeError` (other) — and the button re-enables for retry.
- **Real-time arrival**: GIVEN the current player has finished and is on the waiting screen, WHEN the opponent finishes and the match completes, THEN the backend emits `match:finished` and the result screen loads within 1 second, without waiting for the next poll tick.
- **Simultaneous finish**: GIVEN both players finish near-simultaneously (their finish requests overlap), WHEN the last finish write is processed, THEN the backend re-reads both flags and scores fresh, transitions the match to `completed`, and sets `winnerId` from the fresh scores; the match MUST NOT remain `in_progress` with both `finished=true`.
- **Fresh-score winner**: GIVEN a player's final answer is scored after the opponent's finish request was read, WHEN the match completes, THEN `winnerId` reflects the final fresh scores, not the earlier snapshot.
- **Time-up direct transition**: GIVEN a player finishes via answer submit or timer expiry and the finish response reports `matchEnded=true`, WHEN the response is handled, THEN the client transitions to the result screen directly without waiting for a poll tick.
- **Poll fallback**: GIVEN the socket is disconnected or the `match:finished` event was missed, WHEN a 10s poll returns `status='completed'`, THEN the client transitions to the result screen as before.
