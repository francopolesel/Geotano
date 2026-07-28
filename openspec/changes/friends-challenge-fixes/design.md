# Design: Friends Layout + Challenge Flow

## Overview

Two independent concerns in one change:
1. **UI layout**: Responsive friend card with uniform widths and larger tap targets
2. **Challenge flow**: Complete the end-to-end challenge lifecycle with notifications, socket events, and navigation

---

## Part 1: Friend Card Layout

### Current Structure (simplified)

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ... px-4 py-3">
  <div className="flex items-center gap-3 min-w-0">  {/* avatar + name */}
    <UserAvatar />
    <button>displayName / @username</button>
  </div>
  <div className="flex flex-wrap gap-1 sm:flex-nowrap sm:shrink-0 sm:justify-end">
    <button className="min-h-[36px] ...">⚔️</button>
    <button className="min-h-[36px] ...">💬</button>
    <button className="min-h-[36px] ...">Remove</button>
    <button className="min-h-[36px] ...">Block</button>
  </div>
</div>
```

### Problems
- Mobile: `flex-col` stacks everything vertically, buttons are 36px (below 44px recommended minimum)
- Desktop: no `w-full` on card, flex distribution varies by name length
- Card width perceived as inconsistent

### New Structure

```tsx
<div className="flex flex-col gap-2 rounded-lg border ... px-4 py-3 w-full">
  {/* Row 1: avatar + name + desktop actions */}
  <div className="flex items-center gap-3 min-w-0">
    <UserAvatar />                          {/* shrink-0 */}
    <button className="flex-1 min-h-[44px]">displayName / @username</button>
    <div className="hidden sm:flex items-center gap-1 shrink-0">
      <button className="min-h-[44px]">⚔️</button>
      <button className="min-h-[44px]">💬</button>
      <button className="min-h-[44px]">Remove</button>
      <button className="min-h-[44px]">Block</button>
    </div>
  </div>
  {/* Row 2: mobile-only actions */}
  <div className="flex sm:hidden items-center gap-2">
    <button className="flex-1 min-h-[44px]">⚔️ Challenge</button>
    <button className="flex-1 min-h-[44px]">💬 Chat</button>
    <button className="flex-1 min-h-[44px]">Remove</button>
    <button className="flex-1 min-h-[44px]">Block</button>
  </div>
</div>
```

### Key CSS Decisions
| Class | Why |
|-------|-----|
| `w-full` | Cards fill container width equally regardless of content |
| `hidden sm:flex` | Desktop actions inline with name row |
| `flex sm:hidden` | Mobile actions in dedicated row below |
| `flex-1` on action buttons (mobile) | Equal-width buttons fill the row |
| `min-h-[44px]` on all action buttons | WCAG minimum touch target |
| `shrink-0` on desktop action group | Prevents action buttons from compressing |

---

## Part 2: Challenge Flow

### Current Sequence

```
Sender                   Backend                    Receiver
  │                         │                          │
  │─ POST /matches/challenge ──→│                        │
  │  { receiverId, slug }       │─ INSERT match_challenge │
  │                             │─ socket.emit if online ─→│ (may not exist)
  │← { challengeId } ──────────│                          │
  │                             │                          │
  │ "Challenge sent!" (3s)      │                          │
  │ (disappears)                │                          │
  │                             │                          │
  │                             │← POST /matches/accept ──│
  │                             │  { challengeId }         │
  │ (NO notification)           │─ INSERT matchGames       │
  │                             │─ { matchId } ──────────→│
  │                             │               (no navigation)
```

### New Sequence

```
Sender                   Backend                    Receiver
  │                         │                          │
  │─ POST /matches/challenge ──→│                        │
  │  { receiverId, slug }       │─ INSERT match_challenge │
  │                             │─ createNotification()   │ (ALWAYS — offline fallback)
  │                             │─ socket.emit(           │ (if online)
  │                             │    "challenge:invite") ──→│
  │← { challengeId } ──────────│                          │
  │                             │                          │
  │ "Waiting for response..."   │                          │
  │ (persistent state)          │                          │
  │                             │                          │
  │                             │← POST /matches/accept ──│
  │                             │  { challengeId }         │
  │                             │─ INSERT matchGames       │
  │                             │─ socket.emit(           │
  │  ← "challenge:accepted" ────│    "challenge:accepted", │
  │    { matchId })             │    { matchId })          │
  │                             │─ { matchId } ──────────→│
  │                             │                          │
  │ Navigate to /multiplayer/   │          Navigate to     │
  │ :matchId                    │          /multiplayer/   │
  │                             │          :matchId        │
```

### Backend Changes

#### `POST /matches/challenge` (routes/matches.ts)

**Add after successful challenge creation:**
```typescript
import { createNotification } from '../services/notifications';

// After INSERT match_challenge succeeds:
await createNotification({
  type: 'challenge_invite',
  receiverId: receiver.id,
  actorId: challenger.id,
  relatedEntityType: 'challenge',
  relatedEntityId: challenge.id.toString(),
  metadata: {
    challengerUsername: challenger.username,
    challengerDisplayName: challenger.displayName,
    gameModeSlug,
  },
});
```

The socket emit already exists — keep it. The notification is the **fallback** for offline users and provides a DB record regardless.

#### `POST /matches/accept` (routes/matches.ts)

**Add after successful accept:**
```typescript
import { getIO } from '../socket';

// After match is created and challenge status updated:
const io = getIO();
if (io) {
  const challengerSockets = userSockets.get(challenge.challengerId);
  if (challengerSockets) {
    for (const socketId of challengerSockets) {
      io.to(socketId).emit('challenge:accepted', {
        matchId: match.id.toString(),
        challengeId: challenge.id.toString(),
      });
    }
  }
}
```

### Frontend Changes

#### `socket.ts` — Add listener

```typescript
// After existing socket.on setup:
socket.on('challenge:accepted', (data: { matchId: string }) => {
  useMultiplayerStore.getState().clearChallengeNotification();
  // Navigate to match
  window.location.href = `/multiplayer/${data.matchId}`;
});
```

#### `FriendsPage.tsx` — Challenge state

- Change `challengeSentTo` from 3s timeout to persistent state
- Add a `challengeState` map: `{ [friendId]: 'sending' | 'waiting' | 'accepted' | 'rejected' }`
- Listen to `challenge:accepted` and `challenge:rejected` events from socket
- Show "Waiting for response…" while in 'waiting' state
- Navigate to match when 'accepted'

#### `ChallengeNotification.tsx` — Auto-navigate

After POST /matches/accept succeeds, navigate:
```typescript
const handleAccept = async () => {
  const res = await api.post('/matches/accept', { challengeId });
  setShow(false);
  navigate(`/multiplayer/${res.matchId}`);
};
```

### Data Flow Summary

| Event | Transport | Payload | Effect |
|-------|-----------|---------|--------|
| Challenge sent | REST POST → 200 | `{ challengeId }` | Show "Waiting for response…" |
| Notification to receiver | Socket `challenge:invite` | `ChallengeInvitePayload` | Show challenge modal |
| Offline fallback | DB notification | `createNotification(...)` | Delivered on next connect |
| Accept | REST POST → 200 | `{ matchId }` | Navigate acceptor to match |
| Notify challenger | Socket `challenge:accepted` | `{ matchId, challengeId }` | Navigate challenger to match |

---

## Files Changed

| File | Change |
|------|--------|
| `apps/frontend/src/features/friends/FriendsPage.tsx` | New responsive card layout + challenge state management |
| `apps/frontend/src/lib/socket.ts` | Add `challenge:accepted` listener |
| `apps/frontend/src/features/multiplayer/ChallengeNotification.tsx` | Navigate to match on accept |
| `apps/backend/src/routes/matches.ts` | Add `createNotification()` on challenge + `challenge:accepted` emit on accept |

## Verified — All Infrastructure Exists

| Component | Status |
|-----------|--------|
| `getIO()` in socket/index.ts | ✅ Exported |
| `getUserSocketIds()` in socket/index.ts | ✅ Exported |
| `createNotification()` in services/notifications.ts | ✅ Signature: `{ userId, type, fromUserId, metadata? }` |
| `challenge_invite` as NotificationType | ✅ Already in shared types |
| `challenge:invite` socket emit in matches.ts | ✅ Already implemented (lines 92-99) |
| `challenge:invite` listener in frontend socket.ts | ✅ Already implemented (line 81) |
| `createNotification` import in socket/index.ts | ✅ Already used for `chat:send` |

The backend route `matches.ts` already imports `getIO` and `getUserSocketIds` from `../socket/index.js`. The `createNotification` function is already used in `socket/index.ts` for chat messages. No new imports needed.
