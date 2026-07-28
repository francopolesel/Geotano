# Match History Specification

## Purpose

Persistent record of all multiplayer matches for the authenticated user, showing status, scores, winner, game mode, and date.

## Requirements

### Requirement: Match history list

The system MUST provide a paginated list of matches for the authenticated user via `GET /matches/history`, returning all `match_games` where the user is player1 or player2, ordered by most recent first.

- **Has matches**: GIVEN the user has completed and pending matches, WHEN they call GET /matches/history, THEN the response includes all matches with status, scores, winner, mode slug, and created_at.
- **Empty history**: GIVEN the user has no matches, WHEN they call GET /matches/history, THEN an empty array is returned.
- **Authentication**: GIVEN an unauthenticated request, WHEN GET /matches/history is called, THEN a 401 error is returned.

### Requirement: Match detail view

The system MUST provide a match detail endpoint via `GET /matches/:id` returning the full match state including per-player scores, status, game mode, winner, and both players' identities.

- **Completed match**: GIVEN a completed match, WHEN the authenticated participant calls GET /matches/:id, THEN the response includes both players' scores, the winner, completion status, and timestamps.
- **In-progress match**: GIVEN a match where one player has finished but the other has not, WHEN the finished player views detail, THEN the opponent's score is null and status shows "in_progress".
- **Unauthorized viewer**: GIVEN a user who is NOT a participant in the match, WHEN they call GET /matches/:id, THEN a 403 error is returned.

### Requirement: Match History UI

The frontend MUST display a Match History tab on the Friends page listing matches with status badges, scores, winner indicator, game mode label, and relative date. Each entry MUST link to the match detail page.

- **List rendering**: GIVEN the user has match history, WHEN they open the Match History tab, THEN each match entry shows a status badge (pending/in_progress/completed), player scores, winner highlight, mode name, and relative date.
- **Empty state**: GIVEN the user has no match history, WHEN they open the tab, THEN an empty state message is shown with a prompt to challenge a friend.
- **Loading state**: GIVEN the history is being fetched, WHEN the tab renders, THEN a loading spinner is displayed.
