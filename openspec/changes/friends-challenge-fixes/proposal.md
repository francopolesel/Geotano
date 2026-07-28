# Proposal: Friends Challenge Fixes

## Intent

Fix three usability bugs in the friends + multiplayer challenge flow:
1. Mobile friend cards have tiny tap targets and cramped layout
2. Desktop friend cards don't have uniform width
3. Challenge flow doesn't work end-to-end — receiver gets no notification if offline, sender gets no confirmation, no one navigates to match

## Scope

### In Scope
- Responsive friend card layout with larger tap targets (min-h-[44px])
- Desktop cards enforce uniform width via w-full
- Offline notification fallback for challenge invites (DB notifications)
- Socket event `challenge:accepted` from backend to challenger
- Auto-navigation to match on accept for both players
- Persistent challenge state ("Waiting for response…") instead of 3s timeout

### Out of Scope
- Realtime UI during active match (already works)
- Friend request layout changes (not reported as broken)
- Challenge timeout/cancellation after N minutes

## Capabilities

### Modified Capabilities
- `friend-system`: UI layout only — responsive card breakpoints and tap target sizing. No behavior change.
- `multiplayer-1v1-mode`: Challenge flow now delivers notifications to offline receivers, emits accept event to challenger, and auto-navigates both players to match page.

## Approach

- **Layout**: Outer card gets `w-full`. Responsive row structure — avatar+name+actions inline on desktop, two rows on mobile (info row + action row with larger buttons).
- **Challenge notification**: `POST /matches/challenge` calls `createNotification()` like chat:send already does, so offline receivers get DB-persisted notifications.
- **Accept flow**: `POST /matches/accept` emits `challenge:accepted` via socket to the challenger with matchId.
- **Frontend navigation**: Socket listener for `challenge:accepted` navigates to match. ChallengeNotification navigates on accept click.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/frontend/src/features/friends/FriendsPage.tsx` | Modified | Friend card layout + challenge state management |
| `apps/frontend/src/lib/socket.ts` | Modified | Add `challenge:accepted` listener |
| `apps/frontend/src/features/multiplayer/ChallengeNotification.tsx` | Modified | Navigate to match on accept |
| `apps/backend/src/routes/matches.ts` | Modified | Add notification + socket emit |
| `apps/backend/src/socket/index.ts` | Modified | Permit `challenge:accepted` emit |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Socket emit fails if challenger disconnected | Medium | Notification serves as offline fallback |
| Layout change breaks existing screens | Low | Responsive classes tested at both breakpoints |

## Rollback Plan

Revert the 5 modified files. No DB migration — challenge table schema unchanged. Socket events are additive and ignored by old clients.

## Success Criteria

- [ ] Mobile friend cards have min-h-[44px] buttons, no overlap
- [ ] Desktop cards render at equal width regardless of username length
- [ ] Offline user receives challenge notification on reconnect
- [ ] Sender sees "Waiting for response…" until accept, then auto-navigates
- [ ] Acceptor auto-navigates to match on accept
- [ ] All existing tests pass
