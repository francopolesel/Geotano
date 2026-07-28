# Design: 1v1 Multiplayer Mode

## Overview

A real-time 1v1 geography quiz mode where friends challenge each other via Socket.IO. The match uses a race format: same question pool, randomized different order per player, shared 3-minute timer, server-authoritative scoring.

No DB persistence for match state — all state lives in-memory on the server. This is acceptable for friendly matches (no global rankings affected).

---

## Architecture

```
┌──────────────────────┐     Socket.IO      ┌──────────────────────────┐
│  Frontend            │ ◄─────────────────► │  Backend                │
│                      │                     │                          │
│  multiplayer/        │   challenge:*       │  socket/index.ts        │
│  ├─ MultiplayerPage  │   match:*           │  (event handlers)       │
│  ├─ MultiplayerStore │                     │         │                │
│  └─ useMultiplayer   │                     │         ▼                │
│                      │                     │  services/matchService  │
│  lib/socket.ts       │                     │  (match state, timer,   │
│  (connection mgmt)   │                     │   scoring, questions)   │
└──────────────────────┘                     └──────────────────────────┘
```

### New Files

| File | Purpose |
|------|---------|
| `apps/backend/src/services/matchService.ts` | Match state, race timer, race scoring, question pool management |
| `apps/frontend/src/store/multiplayerStore.ts` | Zustand store for multiplayer flow |
| `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | Main multiplayer page — lobby, game, or end screen |
| `apps/frontend/src/features/multiplayer/useMultiplayerSocket.ts` | Hook to register/unregister multiplayer socket listeners |

### Modified Files

| File | Change |
|------|--------|
| `apps/backend/src/socket/index.ts` | Add multiplayer event handlers (challenge + match lifecycle) |
| `packages/shared/src/types/index.ts` | Add multiplayer types and socket event payloads |
| `apps/frontend/src/features/friends/FriendsPage.tsx` | Add "Desafiar" button per online friend |
| `apps/frontend/src/lib/socket.ts` | Add event listener registrations for challenge notification popup |

---

## Socket Event Contracts

All events follow the existing `namespace:action` naming convention (e.g., `chat:send`, `user:online`).

### Client → Server

| Event | Payload | When |
|-------|---------|------|
| `challenge:send` | `{ receiverId: string }` | A clicks Desafiar on B |
| `challenge:cancel` | `{}` | A cancels before B responds |
| `challenge:accept` | `{ challengeId: string }` | B clicks Accept |
| `challenge:decline` | `{ challengeId: string }` | B clicks Reject |
| `match:answer` | `{ matchId: string, optionIndex: number }` | Player submits answer |
| `match:rejoin` | `{ matchId: string }` | Player reconnects mid-match |

### Server → Client

| Event | Payload | When |
|-------|---------|------|
| `challenge:invite` | `{ challengeId, challenger: UserProfile }` | B receives A's challenge |
| `challenge:accepted` | `{ challengeId, matchId }` | A is notified B accepted |
| `challenge:declined` | `{ challengeId }` | A is notified B declined |
| `challenge:timeout` | `{ challengeId }` | A is notified challenge expired |
| `match:start` | `{ matchId, opponent: UserProfile, timeLimitMs: 180_000, question: QuizQuestion }` | Race begins |
| `match:question` | `{ matchId, question: QuizQuestion }` | Next question (after previous answer) |
| `match:opponent_answered` | `{ matchId }` | Opponent just answered — passive indicator |
| `match:end` | `{ matchId, result: MatchResult }` | Race over (timer/finish/disconnect) |
| `match:rejoined` | `{ matchId, remainingMs: number, state: RejoinState }` | Player reconnected successfully |

---

## Shared Types (added to `packages/shared/src/types/index.ts`)

```ts
// ── Multiplayer ────────────────────────────────────────────────────

export interface ChallengeInvitePayload {
  challengeId: EntityId;
  challenger: UserProfile;
}

export interface MatchStartPayload {
  matchId: EntityId;
  opponent: UserProfile;
  timeLimitMs: number; // 180_000
  question: QuizQuestion;
}

export interface MatchAnswerPayload {
  matchId: EntityId;
  optionIndex: number;
}

export interface PlayerStats {
  userId: EntityId;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  score: number;
  correctCount: number;
  totalAnswered: number;
  maxStreak: number;
}

export interface MatchResult {
  matchId: EntityId;
  winnerId: EntityId | null;    // null = tie
  reason: 'timer_expired' | 'both_finished' | 'opponent_disconnected' | 'abandoned';
  players: [PlayerStats, PlayerStats];
}

export interface RejoinState {
  question: QuizQuestion;
  remainingMs: number;
  opponentScore: number;      // hidden? actually good to show on reconnect
  opponentCorrectCount: number;
}
```

---

## Match State Management (`matchService.ts`)

### In-memory state — `matchService.ts`

```ts
interface MatchState {
  id: string;
  playerA: PlayerMatchState;
  playerB: PlayerMatchState;
  questionPool: GeneratedQuestion[];     // shared pool
  playerAOrder: number[];                // shuffled indices into pool
  playerBOrder: number[];
  timerStartedAt: number;                // Date.now()
  timerDurationMs: number;               // 180_000
  status: 'pending' | 'active' | 'finished';
  disconnectedAt: Map<string, number>;   // userId → timestamp
  graceTimer?: NodeJS.Timeout;
  winnerId: string | null;
}

interface PlayerMatchState {
  userId: string;
  score: number;
  correctCount: number;
  totalAnswered: number;
  streak: number;
  maxStreak: number;
  pos: number;              // current index in their order array
  finished: boolean;        // exhausted all questions
}
```

### Key data structures

```ts
const challenges = new Map<string, Challenge>();
const matches = new Map<string, MatchState>();
const userMatchMap = new Map<string, string>();  // userId → matchId
```

### Challenge lifecycle
1. `challenge:send` → create `Challenge` with 30s timeout → store in `challenges` map → emit `challenge:invite` to receiver
2. 30s timeout via `setTimeout` → if not accepted, emit `challenge:timeout` to sender, delete from map
3. `challenge:accept` → delete from `challenges` → generate match → emit `challenge:accepted` to sender, `match:start` to both
4. `challenge:decline` → delete from `challenges` → emit `challenge:declined` to sender
5. `challenge:cancel` → delete from `challenges` → emit nothing (sender cancelled proactively)

### Match creation — generateQuestionPool

When both players accept:

```ts
// 1. Determine question type from the challenger's requested mode
//    For MVP, use 'free' mode (mixed types) — no mode selector needed
// 2. Generate 50 questions using quizEngine's generateQuestionBatch
// 3. Shuffle into per-player orders
const pool = await generateQuestionBatch('free', 1, [], 50, lang);
const indices = Array.from({ length: pool.length }, (_, i) => i);
const playerAOrder = shuffle([...indices]);
const playerBOrder = shuffle([...indices]);
```

**Rationale**: Fixed 50-question pool pre-generated at match start. 3 minutes × ~5s per answer ≈ 36 max answers. 50 is enough headroom. The existing `generateQuestionBatch` is reused — no new question generation logic needed.

### Race scoring

```ts
function calculateRaceScore(wasCorrect: boolean, streakBefore: number): number {
  if (!wasCorrect) return 0;  // no penalty
  
  let score = BASE_SCORE;     // 100
  if (streakBefore >= STREAK_THRESHOLD) {
    score = Math.floor(score * STREAK_MULTIPLIER); // ×1.5
  }
  return score;
}
```

No time bonus, no wrong penalty, no mode multiplier. Streak bonus works the same as solo modes (base × 1.5 at 3+ consecutive). Wrong answer resets streak to 0.

### Timer

- Server-side only. Uses `setInterval` per match, firing every 250ms.
- Timer state derived from `Date.now() - timerStartedAt` (no drift accumulation).
- Broadcast `match:timer_tick` every second with `remainingMs` to both players.
- When remaining reaches 0 → end match (anyone who hasn't answered their current question gets null result for that question).
- When both players have `finished = true` → end match early.

### Answer flow

```
Client A → match:answer { matchId, optionIndex }
  → Server validates against questionPool[playerAOrder[playerA.pos]]
  → Calculate score
  → Update playerA state (score, streak, pos++)
  → Emit match:question (next question in A's order) to Client A only
  → Emit match:opponent_answered to Client B only
  → If playerA.pos >= pool.length → set playerA.finished = true
  → If both finished → end match → emit match:end to both
```

**The `match:answer` payload does NOT include `timeMs`** — no speed bonus means we don't need per-question timing data from the client.

### Disconnection flow

1. Socket `disconnect` event fires in socket handler
2. Check `userMatchMap` for the disconnecting user
3. If found, set `matchState.disconnectedAt.set(userId, Date.now())`
4. Start 60s grace timer:
   - **If player reconnects within 60s**: emit `match:rejoined` with current state (current question, remaining time, opponent stats). Clear their `disconnectedAt`.
   - **If grace expires**: player forfeits → emit `match:end` to remaining player with `reason: 'opponent_disconnected'`, to disconnected player on reconnection attempt.
   - **If both disconnect**: clear match immediately (abandoned).
5. Grace timer uses a single `setTimeout` per match, not per-player polling.

### Reconnection

Client stores `matchId` in `sessionStorage`. On socket reconnection (after network drop), client emits `match:rejoin { matchId }`. Server checks:
- Match exists and is `active`
- `disconnectedAt[userId]` set and within 60s
- Re-adds socket to the Socket.IO room
- Sends current question, remaining time, and opponent's score/correctCount via `match:rejoined`

---

## Socket Handler Changes (`socket/index.ts`)

Following the existing pattern (all events in one file), add:

```ts
// ── Challenge events ───────────────────────────────────────────
socket.on('challenge:send', async (payload) => { ... });
socket.on('challenge:cancel', () => { ... });
socket.on('challenge:accept', async (payload) => { ... });
socket.on('challenge:decline', async (payload) => { ... });

// ── Match events ───────────────────────────────────────────────
socket.on('match:answer', async (payload) => { ... });
socket.on('match:rejoin', async (payload) => { ... });
```

Each handler calls into `matchService.ts` for business logic and emits responses via `io.to(roomId)` or `io.to(socketId)`.

The `disconnect` handler needs an additional check:
- If user has an active match, set them as disconnected in the match state.

---

## Frontend: Friends Page Changes (`FriendsPage.tsx`)

Add a "Desafiar" button per online friend entry:

```tsx
// Inside the friends.map loop, next to 💬 button:
{onlineUsers.has(friend.friendId) && (
  <button
    onClick={() => handleChallenge(friend.friendId)}
    disabled={challengeSentTo === friend.friendId}
    className="rounded-md min-h-[44px] min-w-[44px] border border-[var(--color-border)] px-2 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)]"
  >
    ⚔️
  </button>
)}
```

When clicked:
1. If `onlineUsers.has(friendId)` → emit `challenge:send` → disable button / show "challenge sent" state
2. If not online → show offline error (this path shouldn't be reached if button is gated, but add guard)

---

## Frontend: Multiplayer Page (`MultiplayerPage.tsx`)

```
/multiplayer/:matchId — active match or end screen
```

Three screens controlled by `multiplayerStore` state:

| State | Renders |
|-------|---------|
| `'lobby'` | Waiting for challenge to be accepted (challenger side) |
| `'playing'` | Race game UI |
| `'ended'` | Match results with both players' stats |

### `multiplayerStore.ts`

```ts
interface MultiplayerState {
  matchId: string | null;
  screen: 'lobby' | 'playing' | 'ended';
  opponent: UserProfile | null;
  question: QuizQuestion | null;
  score: number;
  streak: number;
  opponentAnswered: boolean;
  remainingMs: number;
  result: MatchResult | null;
  // actions
  setLobby: (opponent: UserProfile) => void;
  startMatch: (payload: MatchStartPayload) => void;
  setQuestion: (q: QuizQuestion) => void;
  updateScore: (points: number) => void;
  setStreak: (n: number) => void;
  showOpponentAnswered: () => void;
  updateTimer: (remainingMs: number) => void;
  endMatch: (result: MatchResult) => void;
}
```

### Race UI differences from solo QuizPage

- **No lives display** — lives are irrelevant
- **No per-question timer bar** — the shared 3-min timer replaces it
- **Shared timer bar** — full-width bar showing remaining match time
- **Opponent indicator** — subtle dot or pulse when `opponentAnswered` is true (auto-clears after 2s)
- **Opponent stats** — hidden during play (not even their score)
- **End screen** — shows both players side-by-side: score, correct count, max streak
- **Answer feedback** — same as solo (correct/wrong with borders), but next question comes via socket event `match:question` not HTTP

### `useMultiplayerSocket.ts`

Registers listeners on mount, cleans up on unmount:

```ts
export function useMultiplayerSocket(matchId: string) {
  const store = useMultiplayerStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onQuestion = (payload: { matchId: string; question: QuizQuestion }) => {
      store.setQuestion(payload.question);
      store.showOpponentAnswered(false); // new question → reset indicator
    };

    const onOpponentAnswered = () => {
      store.showOpponentAnswered(true);
      setTimeout(() => store.showOpponentAnswered(false), 2000);
    };

    const onTimer = (payload: { matchId: string; remainingMs: number }) => {
      store.updateTimer(payload.remainingMs);
    };

    const onEnd = (payload: { matchId: string; result: MatchResult }) => {
      store.endMatch(payload.result);
    };

    socket.on('match:question', onQuestion);
    socket.on('match:opponent_answered', onOpponentAnswered);
    socket.on('match:timer_tick', onTimer);
    socket.on('match:end', onEnd);

    return () => {
      socket.off('match:question', onQuestion);
      socket.off('match:opponent_answered', onOpponentAnswered);
      socket.off('match:timer_tick', onTimer);
      socket.off('match:end', onEnd);
    };
  }, [matchId]);
}
```

---

## Challenge Notification (In-App Popup)

The existing `lib/socket.ts` handles `notification:new`. For challenges, add a listener for `challenge:invite`:

```ts
socket.on('challenge:invite', (data: ChallengeInvitePayload) => {
  multiplayerStore.getState().showChallengeNotification(data);
});
```

This renders a floating modal/popup (using the same confirm modal pattern from `FriendsPage.tsx`):

```
┌──────────────────────────┐
│  ⚔️ Challenge!            │
│  PlayerX wants to duel!  │
│                          │
│  [Accept]    [Reject]    │
│  (auto-decline in 30s)   │
└──────────────────────────┘
```

---

## No DB Persistence — Rationale

Match state is purely in-memory. No tables added to the schema. Rationale:
- Friendly matches don't affect global scores or achievements
- In-memory is simpler and avoids write contention
- If a server restarts mid-match, the match is abandoned — acceptable for MVP
- Reconnection is within the same server process (no clustering for MVP)

The existing `gameSessions`, `gameAnswers` tables remain untouched — multiplayer matches do NOT write to them.

---

## Files Changed Summary

| # | File | Change |
|---|------|--------|
| 1 | `packages/shared/src/types/index.ts` | Add `ChallengeInvitePayload`, `MatchStartPayload`, `PlayerStats`, `MatchResult`, `RejoinState`, `MatchAnswerPayload` |
| 2 | `apps/backend/src/services/matchService.ts` | **New** — `MatchState`, challenge lifecycle, question pool generation, race scoring, timer, disconnect handling |
| 3 | `apps/backend/src/socket/index.ts` | Add handlers for `challenge:*` and `match:*` events; extend disconnect handler for match cleanup |
| 4 | `apps/frontend/src/lib/socket.ts` | Add `challenge:invite` listener for popup notification |
| 5 | `apps/frontend/src/store/multiplayerStore.ts` | **New** — Zustand store for multiplayer state |
| 6 | `apps/frontend/src/features/multiplayer/useMultiplayerSocket.ts` | **New** — Hook for match socket listeners |
| 7 | `apps/frontend/src/features/multiplayer/MultiplayerPage.tsx` | **New** — Lobby, race game, and end screen |
| 8 | `apps/frontend/src/features/friends/FriendsPage.tsx` | Add "Desafiar" button (online-only, gated by `onlineUsers`) |
| 9 | `apps/frontend/src/App.tsx` (or router config) | Add `/multiplayer/:matchId` route |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Server restart loses all match state | Same as existing in-memory caches — acceptable for MVP; all state `'abandoned'` on startup |
| Race condition: both players answer simultaneously | Socket.IO queues events per-connection; backend is single-threaded (Node.js event loop) — no race on the MatchState Map access |
| Challenge spamming | Limit 1 active challenge per user (check `challenges` map in `challenge:send` handler) |
| Connection drop during answer submission | Client retries `match:answer` on reconnect; server deduplicates by checking if answer already recorded |
