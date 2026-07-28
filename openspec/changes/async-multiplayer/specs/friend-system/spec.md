# Delta for Friend System

## MODIFIED Requirements

### Requirement: Challenge action

A friend entry MUST include a "Desafiar" button that opens a game mode picker modal. The system MUST allow challenging friends regardless of online status. Challenge is sent via REST API.

- **Mode picker**: GIVEN A views their friends list, WHEN A clicks "Desafiar" on friend B, THEN a game mode picker modal opens showing available quiz modes (Standard, Unlimited, Hardcore).
- **Challenge sent**: GIVEN A selects a mode and confirms, WHEN POST /matches/challenge succeeds, THEN A sees a confirmation toast and B receives a Socket.IO `challenge:invite` notification if online.
- **Offline allowed**: GIVEN A clicks "Desafiar" on offline friend B, WHEN A picks a mode and confirms, THEN the challenge is persisted in `match_challenges` regardless of B's online status.
(Previously: Socket.IO-only, online check required, no mode selection)

### Requirement: Challenge notification

A friend entry MUST surface incoming challenge notifications with accept and decline actions. The system MUST notify the challenger of the response via Socket.IO.

- **Receive**: GIVEN B is online, WHEN A sends a challenge, THEN B sees an in-app notification with the challenger's name, game mode, and accept/decline buttons.
- **Accept**: GIVEN B clicks accept, WHEN POST /matches/accept succeeds, THEN A receives a Socket.IO confirmation and a `match_games` record is created.
- **Decline**: GIVEN B clicks decline, WHEN POST /matches/decline succeeds, THEN A receives a Socket.IO rejection notification and challenge status becomes "declined".
(Previously: Socket.IO-based "join match room" on accept)
