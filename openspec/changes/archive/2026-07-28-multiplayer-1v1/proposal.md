# Proposal: 1v1 Multiplayer Mode

## Intent

Allow friends to challenge each other to real-time 1v1 geography quiz matches via Socket.IO, with invitation-only matchmaking, race-format gameplay, and friendly rankings that don't affect global scores or achievements.

## Scope

### In Scope
- Invitation-only matchmaking: "Desafiar" button on friends list → in-app notification → accept → match starts immediately
- Race format: same questions, different order, 3-min shared timer, unlimited questions, no per-question timeout
- Scoring: points per correct + streak bonus (3+ consecutive), no speed bonus
- In-game feedback: opponent answered-current-question indicator, no live scores
- End screen: own score, opponent score, correct answers, max streak for both
- Disconnection: grace period for reconnection, match concludes if timeout
- Socket.IO rooms for 1v1 match lifecycle

### Out of Scope
- Matchmaking queue (invitation-only only)
- Tiebreaker (ties allowed)
- Global rankings or achievements
- Match history persistence

## Capabilities

### New Capabilities
- `multiplayer-1v1-mode`: match lifecycle (challenge → accept → race → end), Socket.IO room management, race-scoring with streaks, disconnection handling

### Modified Capabilities
- `friend-system`: add "Desafiar" action to friend entries, in-app challenge notification with accept/reject flow
- `quiz-gameplay`: race mode variant — 3-min shared timer, no lives system, no per-question timeout, unlimited questions within duration, different-question-order per player

## Approach

Socket.IO rooms for real-time state sync. Backend is authority: sends questions, validates answers, tracks time, calculates score. Frontend shows race UI with opponent status via socket events. Match state in-memory with Redis-backed session for reconnection resilience.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/backend/src/plugins/socket.ts` | Modified | Add multiplayer rooms + match lifecycle |
| `apps/backend/src/services/matchService.ts` | New | Match state, race scoring, timer logic |
| `apps/backend/src/services/friendService.ts` | Modified | Challenge notification flow |
| `apps/frontend/src/features/friends/FriendList.tsx` | Modified | "Desafiar" button per friend entry |
| `apps/frontend/src/features/multiplayer/` | New | Race lobby, race UI, end screen components |
| `packages/shared/src/types.ts` | Modified | Multiplayer types, socket event contracts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Socket disconnection mid-match | Medium | Grace period + reconnect via match ID |
| Race condition on answer submission | Low | Backend-authoritative scoring |
| Challenge notification delay | Low | Socket.IO message (not polling) |

## Rollback Plan

Remove multiplayer rooms and events from socket plugin; delete friend challenge button; frontend multiplayer routes become 404. No DB schema changes to roll back.

## Dependencies

- Redis (optional, for reconnection state persistence)

## Success Criteria

- [ ] Two friends can challenge, accept, and complete a 1v1 race match
- [ ] Both see correct end screen with scores and stats
- [ ] Disconnection + reconnection works within grace period
- [ ] No regression to single-player quiz gameplay
