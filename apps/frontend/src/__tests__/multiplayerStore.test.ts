import { describe, it, expect, beforeEach } from 'vitest';
import { useMultiplayerStore } from '../store/multiplayerStore';
import type { UserProfile } from '@geotano/shared';

describe('multiplayerStore', () => {
  beforeEach(() => {
    useMultiplayerStore.setState({ challengeNotification: null });
  });

  it('should start with null challenge notification', () => {
    const state = useMultiplayerStore.getState();
    expect(state.challengeNotification).toBeNull();
  });

  describe('challenge notification', () => {
    it('should set challenge notification', () => {
      const challenger: UserProfile = {
        id: 'user-5', username: 'mallory', email: '',
        language: 'en', joinCode: '', createdAt: '',
      };
      useMultiplayerStore.getState().showChallengeNotification({
        challengeId: 'ch-1', challenger,
      });

      const state = useMultiplayerStore.getState();
      expect(state.challengeNotification).not.toBeNull();
      expect(state.challengeNotification?.challengeId).toBe('ch-1');
      expect(state.challengeNotification?.challenger.username).toBe('mallory');
    });

    it('should dismiss challenge notification', () => {
      const challenger: UserProfile = {
        id: 'user-5', username: 'mallory', email: '',
        language: 'en', joinCode: '', createdAt: '',
      };
      useMultiplayerStore.getState().showChallengeNotification({
        challengeId: 'ch-1', challenger,
      });
      useMultiplayerStore.getState().dismissChallengeNotification();

      expect(useMultiplayerStore.getState().challengeNotification).toBeNull();
    });

    it('should dismiss notification when no notification exists (no throw)', () => {
      expect(() => {
        useMultiplayerStore.getState().dismissChallengeNotification();
      }).not.toThrow();
    });
  });
});
