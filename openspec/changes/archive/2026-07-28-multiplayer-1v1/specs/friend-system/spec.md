# Delta for friend-system

## ADDED Requirements

### Requirement: Challenge action

A friend entry MUST include a "Desafiar" button to send a 1v1 challenge. The system MUST verify both users are online before sending.

- **Online challenge**: GIVEN A views their friends list, WHEN A clicks "Desafiar" on online friend B, THEN a challenge invitation is sent to B via Socket.IO.
- **Offline guard**: GIVEN A views their friends list, WHEN A clicks "Desafiar" on offline friend B, THEN an error message is shown and no challenge is sent.

### Requirement: Challenge notification

A friend entry MUST surface incoming challenge notifications with accept and reject actions. The system MUST notify the challenger of the response.

- **Receive**: GIVEN B is online, WHEN A sends a challenge, THEN B sees an in-app notification with the challenger's name and accept/reject buttons.
- **Accept**: GIVEN B clicks accept on the challenge, THEN A receives confirmation and both join the match room.
- **Reject**: GIVEN B clicks reject on the challenge, THEN A receives a rejection notification and no match is created.
