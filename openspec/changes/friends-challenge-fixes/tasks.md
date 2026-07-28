# Tasks: Friends Challenge Fixes

## Review Workload Forecast

- **Estimated changed lines**: ~100
- **Files touched**: 4
- **400-line budget risk**: Low
- **Chained PRs recommended**: No
- **Decision needed before apply**: No

## Task List

### Task 1: Friend card responsive layout

**File**: `apps/frontend/src/features/friends/FriendsPage.tsx`

**Description**: Restructure the friend card div for responsive layout with uniform desktop widths and larger mobile tap targets.

**Changes**:
1. Add `w-full` to the outer card div
2. Restructure from single `flex-col sm:flex-row` to:
   - Outer: `flex flex-col gap-2 ... w-full`
   - Row 1 (always visible): `flex items-center gap-3 min-w-0` with avatar + name button (`flex-1 min-h-[44px]`)
   - Row 1 desktop: `hidden sm:flex items-center gap-1 shrink-0` with 4 action buttons
   - Row 2 mobile: `flex sm:hidden items-center gap-2` with 4 equal-width action buttons (`flex-1 min-h-[44px]`)
3. Change all action button heights from `min-h-[36px]` to `min-h-[44px]`

**Verification**: Visual check on desktop (cards equal width) and mobile (buttons 44px+).

**Effort**: Small

---

### Task 2: Challenge state management (persistent UI)

**File**: `apps/frontend/src/features/friends/FriendsPage.tsx`

**Description**: Replace the 3s timeout for `challengeSentTo` with a persistent challenge state that shows "Waiting for response…" until the challenge is accepted or rejected.

**Changes**:
1. Add state: `challengeState: { [friendId]: 'sending' | 'waiting' | 'accepted' | 'rejected' | null }`
2. On challenge send: set to `'waiting'`
3. On socket `challenge:accepted`: set to `'accepted'` then navigate
4. On socket `challenge:rejected` or error: reset to `null`
5. Button shows: `⚔️` (default), `"Sending…"` (sending), `"Waiting for response…"` (waiting), navigates away (accepted)

**Verification**: Send challenge → button changes to "Waiting for response…" and stays.

**Effort**: Small

---

### Task 3: Socket listener for challenge:accepted

**File**: `apps/frontend/src/lib/socket.ts`

**Description**: Add listener for `challenge:accepted` socket event that navigates to the match page.

**Changes**:
1. After line 83 (challenge:invite handler), add:
```typescript
socket.on('challenge:accepted', (data: { matchId: string }) => {
  useMultiplayerStore.getState().clearChallengeNotification();
  if (navigateFn) {
    navigateFn(`/multiplayer/${data.matchId}`);
  }
});
```

**Verification**: When backend emits `challenge:accepted`, frontend navigates to `/multiplayer/:matchId`.

**Effort**: Small

---

### Task 4: ChallengeNotification auto-navigation

**File**: `apps/frontend/src/features/multiplayer/ChallengeNotification.tsx`

**Description**: After successful accept API call, navigate to match page.

**Changes**:
1. In the accept handler, after `await api.post('/matches/accept', ...)`, navigate to `/multiplayer/${res.matchId}`
2. Add `useNavigate` or use the stored `navigateFn`

**Verification**: Click Accept → navigates to match page.

**Effort**: Small

---

### Task 5: Backend — notification on challenge + accept socket event

**File**: `apps/backend/src/routes/matches.ts`

**Description**: Two backend changes:
1. In `POST /matches/challenge` (after challenge creation): call `createNotification` as offline fallback
2. In `POST /matches/accept` (after successful accept): emit `challenge:accepted` to challenger's sockets

**Changes**:

**a) POST /matches/challenge** (after line 99, inside the try block):
```typescript
// Add notification (offline fallback)
import { createNotification } from '../services/notifications.js'; // already imported in socket, verify import in route

await createNotification({
  userId: receiverId,
  type: 'challenge_invite',
  fromUserId: userId,
  metadata: {
    challengerUsername: challengerUser?.username,
    gameModeSlug,
  },
}).catch(() => {});
```

**b) POST /matches/accept** (after line 128, after successful accept):
```typescript
// Notify challenger that challenge was accepted
const challenge = await db
  .select()
  .from(matchChallenges)
  .where(eq(matchChallenges.id, challengeId))
  .limit(1)
  .then(rows => rows[0]);

if (challenge) {
  const io = getIO();
  const challengerSids = getUserSocketIds(challenge.challengerId);
  for (const sid of challengerSids) {
    io.to(sid).emit('challenge:accepted', {
      matchId: result.matchId,
      challengeId,
    });
  }
}
```

**Verification**:
- POST /matches/challenge → notification row created in DB (check notifications table)
- POST /matches/accept → challenger receives `challenge:accepted` socket event

**Effort**: Medium

---

## Dependency Order

```
Task 1 (layout) ──┐
                  ├──> independent (parallel with Task 3/5)
Task 3 (socket) ──┤
Task 5 (backend) ─┘
                  │
Task 2 (state) ───┤ (depends on Task 3 socket listener existing)
Task 4 (nav) ─────┘ (depends on Task 5 backend event + Task 3 listener)
```

**Execution order**: 1 + 3 + 5 (parallel), then 2 + 4
