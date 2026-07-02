# Rankings Specification

## Purpose

Global + friends leaderboards per mode, cumulative and daily.

## Requirements

### Requirement: Persistence
MUST persist final score, player, mode, and timestamp per session.
- **Save**: GIVEN completed game, WHEN session ends, THEN score record created.

### Requirement: Global board
MUST expose GET /api/rankings/global?mode=X — top 100 descending.
- **View**: GIVEN multiple player scores, WHEN global rankings called, THEN top 100 per mode returned.

### Requirement: Friends board
MUST expose GET /api/rankings/friends — authenticated user's friends only.
- **Friends**: GIVEN user has friends with scores, WHEN friends ranking called, THEN only friends' scores.

### Requirement: Daily snapshots
MUST reset per UTC day for daily leaderboard.
- **Daily**: GIVEN scores from different dates, WHEN /daily called, THEN only today's UTC scores.
