import { create } from 'zustand';
import type { TrucoInvitePayload } from '../lib/socket';

interface TrucoInviteState {
  /** Latest truco invite push; rendered globally by TrucoInviteBanner. */
  invite: TrucoInvitePayload | null;
  showInvite: (invite: TrucoInvitePayload) => void;
  dismissInvite: () => void;
}

/**
 * Global landing spot for `truco:invite` pushes (remediation #11). Mirrors
 * the multiplayerStore.challengeNotification slice: the socket layer feeds
 * it, AppShell renders it, so invites are visible from ANY screen — not only
 * while a match page keeps its handler object registered.
 */
export const useTrucoInviteStore = create<TrucoInviteState>((set) => ({
  invite: null,
  showInvite: (invite) => set({ invite }),
  dismissInvite: () => set({ invite: null }),
}));
