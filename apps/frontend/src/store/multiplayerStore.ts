import { create } from 'zustand';
import type { ChallengeInvitePayload } from '@geotano/shared';

interface MultiplayerState {
  challengeNotification: ChallengeInvitePayload | null;
  showChallengeNotification: (payload: ChallengeInvitePayload) => void;
  dismissChallengeNotification: () => void;
}

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  challengeNotification: null,

  showChallengeNotification: (payload) =>
    set({ challengeNotification: payload }),

  dismissChallengeNotification: () =>
    set({ challengeNotification: null }),
}));
