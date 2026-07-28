# Proposal: Async Multiplayer

## Intent

Replace in-memory real-time Socket.IO multiplayer with DB-backed async model. Friends challenge each other, play independently, scores compare when both finish. Enables match history and persistence.

## Scope

### In Scope
- DB: `match_challenges` + `match_games` tables via Drizzle
- REST: challenge CRUD, match history, match play/answer endpoints
- Frontend: game mode picker on ⚔️, Match History tab, async match play page
- Remove Socket.IO match gameplay events
- Keep Socket.IO for chat, notifications, online, challenge:invite

### Out of Scope
- Challenge expiry, push notifications, matchmaking, leaderboard

## Capabilities

### New Capabilities
- `match-history`: View completed/pending matches with scores, winner, mode, date

### Modified Capabilities
- `multiplayer-1v1-mode`: Replace real-time race with async per-player model. Remove shared timer, disconnection logic, live opponent feedback. Add DB persistence, REST lifecycle, mode selection, per-player timer.
- `friend-system`: Challenge no longer needs both online. Add game mode picker. Challenges persist; Socket.IO for notification only.
- `quiz-gameplay`: Race variant — shared timer → per-player timer on first answer.

## Approach

Full async replacement (exploration Approach 1). New Drizzle tables → migration. REST for match lifecycle and gameplay. Frontend reuses solo quiz UI. 50 questions pre-generated at creation; per-player shuffle. 3-min per-player timer starts on "Play". Winner determined server-side when both finish.

## Affected Areas

| Area | Impact |
|------|--------|
| `db/schema/` | New tables |
| `services/matchService.ts` | DB-backed async |
| `routes/matches.ts` | New REST endpoints |
| `socket/index.ts` | Strip gameplay events |
| `features/multiplayer/` | Async play page |
| `features/friends/FriendsPage.tsx` | Mode picker |
| `features/friends/MatchHistory.tsx` | New tab |
| `store/multiplayerStore.ts` | Simplify state |
| `packages/shared/types/` | New match types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| In-memory matches lost on deploy | Low | Accept for MVP |
| 50-question pool slow at creation | Med | Background generation |
| Timer clock drift | Low | Server-side deadline |

## Rollback Plan

Revert migration (`drizzle-kit drop`), restore changed files from git. Feature-flag new routes.

## Dependencies

- Solo quiz components for match play page
- Drizzle ORM migration

## Success Criteria

- [ ] Challenge with mode selection works end-to-end; persists in DB
- [ ] Accept creates match_games record with 50 questions
- [ ] Both play independently; answers persisted via REST
- [ ] Winner correctly determined when both finish
- [ ] Match history shows status, scores, winner, mode, date
- [ ] No Socket.IO gameplay events remain
- [ ] All state survives server restart
