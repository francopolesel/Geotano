# Tasks: Async Multiplayer

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1300 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

## Phase 1: DB Schema + Types

- [x] 1.1 Create `packages/shared/src/types/multiplayer.ts` — MatchChallenge, MatchGame, MatchAnswer types
- [x] 1.2 Export new types from `packages/shared/src/types/index.ts`
- [x] 1.3 Create `apps/backend/src/db/schema/matchChallenges.ts` — Drizzle table (id, challenger_id, receiver_id, game_mode_slug, status, created_at)
- [x] 1.4 Create `apps/backend/src/db/schema/matchGames.ts` — Drizzle table (id, challenge_id, player1_id, player2_id, game_mode_slug, player1_score, player2_score, player1_finished, player2_finished, winner_id, status, created_at)
- [x] 1.5 Create `apps/backend/src/db/schema/matchAnswers.ts` — Drizzle table (id, match_id, user_id, question_index, option_index, was_correct, score_earned, streak_at_answer, created_at)
- [x] 1.6 Export new schemas from `apps/backend/src/db/schema/index.ts`
- [ ] 1.7 Write backend unit tests for new schema validation + matchService scoring

## Phase 2: Backend REST API + matchService Rewrite

- [ ] 2.1 Rewrite `apps/backend/src/services/matchService.ts` — remove in-memory maps; implement DB-backed: createChallenge, acceptChallenge, declineChallenge, startMatch (generate 50 questions with quizEngine), submitAnswer, getMatchState, getHistory
- [ ] 2.2 Create `apps/backend/src/routes/matches.ts` — POST /matches/challenge, POST /matches/accept, POST /matches/:id/play, POST /matches/:id/answer, GET /matches/:id, GET /matches/history
- [ ] 2.3 Register matches route in `apps/backend/src/routes/index.ts`
- [ ] 2.4 Write backend integration tests for all match endpoints

## Phase 3: Socket.IO Cleanup

- [ ] 3.1 Remove from `apps/backend/src/socket/index.ts`: match:start, match:question, match:answer, match:opponent_answered, match:timer_tick, match:end handlers
- [ ] 3.2 Keep in socket/index.ts: challenge:invite, challenge:cancel, challenge:decline, match:rejoin (keep as is)
- [ ] 3.3 Remove match-event listeners from `apps/frontend/src/lib/socket.ts`: match:answer, submitMatchAnswer (match:start listener stays for future real-time notifications)
- [ ] 3.4 Update backend multiplayer socket tests (remove tests for removed events)

## Phase 4: Frontend — Match Play

- [ ] 4.1 Simplify `apps/frontend/src/store/multiplayerStore.ts` — remove match state (matchId, screen, opponent, question, score, streak, opponentAnswered, remainingMs, result); keep only challengeNotification + dismiss/show
- [ ] 4.2 Rewrite `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` — fetch match state from GET /matches/:id, display question from question pool index, submit answer via POST /matches/:id/answer, show end screen when both finished
- [ ] 4.3 Delete `apps/frontend/src/features/multiplayer/useMultiplayerSocket.ts` (no longer needed)
- [ ] 4.4 Write frontend tests for async MultiplayerPage

## Phase 5: Frontend — Challenge with Mode + Match History

- [ ] 5.1 Create `apps/frontend/src/features/friends/ChallengeModal.tsx` — modal showing game modes (from solo list) + "Challenge" button; calls POST /matches/challenge
- [ ] 5.2 Create `apps/frontend/src/features/friends/MatchHistory.tsx` — tab/page listing match_games with status, scores, winner, mode, date; play/resume button for pending/in_progress matches
- [ ] 5.3 Modify `apps/frontend/src/features/friends/FriendsPage.tsx` — add Match History tab; replace ⚔️ direct trigger with ChallengeModal
- [ ] 5.4 Add match history route to `apps/frontend/src/app/App.tsx`
- [ ] 5.5 Write frontend tests for ChallengeModal + MatchHistory + updated FriendsPage

## Phase 6: i18n + Cleanup

- [ ] 6.1 Add i18n keys for match history, challenge modal (en.json + es.json)
- [ ] 6.2 Remove dead code: obsolete multiplayer store fields, unused socket listeners
- [ ] 6.3 Verify tsc --noEmit passes on both frontend and backend
- [ ] 6.4 Verify all 900+ tests pass
