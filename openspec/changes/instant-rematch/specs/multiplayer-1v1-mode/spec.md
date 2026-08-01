# Delta for Multiplayer 1v1 Mode

## MODIFIED Requirements

### Requirement: End screen

The system MUST display a match results screen showing scores, correct counts, and max streaks for both players. On a completed match, the results screen MUST also offer a rematch action that sends a new challenge to the same opponent, reusing the match's game mode and duration.

- **Results display**: GIVEN the match timer expires or both players exhaust the pool, WHEN the end screen loads, THEN each player sees their own and the opponent's score, correct answers count, and max streak.
- **Tie**: GIVEN both players have equal final scores, WHEN the end screen loads, THEN it shows a tie outcome. No tiebreaker is required.
- **Rematch button**: GIVEN the end screen shows a completed match, WHEN it renders, THEN a Rematch button using the `multiplayer.rematch` i18n key is displayed before the Back to Home button.
- **Rematch payload**: GIVEN a player taps Rematch, WHEN the challenge is sent, THEN POST /matches/challenge is called with `receiverId` = opponent.id, `gameModeSlug` = match.gameModeSlug, and `durationMinutes` = match.durationMinutes.
- **Sending state**: GIVEN a player taps Rematch, WHEN the request is in flight, THEN the button is disabled, the waiting label `multiplayer.waitingResponse` is shown, and a second tap MUST NOT send another challenge.
- **Rematch accepted**: GIVEN a rematch challenge is accepted, WHEN the `challenge:accepted` socket event arrives, THEN the client auto-navigates to the new match room.
- **Rematch error**: GIVEN the rematch challenge request fails, THEN the error is mapped to an existing i18n key — `challengeNotFriends` (403), `challengeInFlight` (409), `challengePending` (409), `challengeError` (other) — and the button re-enables for retry.
(Previously: end screen showed results and tie only, with no rematch action)
