# Multiplayer 1v1 Mode — Delta Spec

## Change Type

Behavioral change to the invitation flow: offline notification fallback, socket event on accept, and auto-navigation to match room.

## Modified Requirements

### Requirement: Invitation flow

**Old (base spec)**:
- Send via socket only, offline users get nothing
- Accept creates match but doesn't navigate or notify challenger
- No mention of navigation on accept

**New**:

#### Send challenge (offline fallback)

GIVEN A sends a challenge to B, WHEN B is offline, THEN a DB-persisted notification is created so B receives it on next connection. The notification service (`createNotification`) serves as the fallback path, matching the pattern already used by `chat:send`.

- **Online**: GIVEN B is online, WHEN A sends challenge via POST /matches/challenge, THEN B receives real-time `challenge:invite` via socket AND a DB notification is created as backup.
- **Offline**: GIVEN B is offline, WHEN A sends challenge via POST /matches/challenge, THEN a DB notification of type `challenge_invite` is persisted for B.

#### Accept challenge (challenger notification + navigation)

GIVEN B accepts A's challenge via POST /matches/accept, THEN:
1. The match room is created in the database
2. A (the challenger) receives a `challenge:accepted` socket event with `{ matchId }`
3. B (the acceptor) receives the matchId in the HTTP response
4. Both players' clients auto-navigate to `/multiplayer/:matchId`

- **Challenger notified**: GIVEN A sent a challenge, WHEN B accepts, THEN A's client receives `challenge:accepted` event and navigates to the match page.
- **Acceptor navigated**: GIVEN B clicks Accept in the challenge modal, WHEN POST /matches/accept succeeds, THEN B's client navigates to `/multiplayer/:matchId`.

#### Reject challenge

Unchanged from base spec — A receives rejection notification, no match created.

#### Sender UI state

GIVEN A sends a challenge, THEN the challenge button changes to "Waiting for response…" (persistent, not a 3s timeout). WHEN the challenge is accepted, A navigates to match. WHEN the challenge is rejected, the button reverts to the default state.

## Unchanged Requirements

Race format, scoring, in-game feedback, end screen, and disconnection handling remain unchanged.

## Test Scenarios

- **TC-CHALLENGE-1**: GIVEN A sends challenge to online B, WHEN POST returns 200, THEN A sees "Waiting for response…" and B sees challenge modal.
- **TC-CHALLENGE-2**: GIVEN A sends challenge to offline B, WHEN POST returns 200, THEN A sees "Waiting for response…" and B receives notification on next connect.
- **TC-CHALLENGE-3**: GIVEN B accepts challenge, WHEN POST /matches/accept succeeds, THEN B navigates to `/multiplayer/:matchId` and A receives `challenge:accepted` and navigates to match.
- **TC-CHALLENGE-4**: GIVEN B rejects challenge, THEN A's button reverts to default state.
