import { describe, it, expect, beforeEach } from 'vitest';
import { useMultiplayerStore } from '../store/multiplayerStore';
import type { UserProfile, QuizQuestion, MatchResult, PlayerStats } from '@geotano/shared';

describe('multiplayerStore', () => {
  beforeEach(() => {
    useMultiplayerStore.setState({
      matchId: null,
      screen: 'lobby',
      opponent: null,
      question: null,
      score: 0,
      streak: 0,
      opponentAnswered: false,
      remainingMs: 180_000,
      result: null,
      challengeNotification: null,
    });
  });

  it('should start in lobby screen with default values', () => {
    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('lobby');
    expect(state.matchId).toBeNull();
    expect(state.opponent).toBeNull();
    expect(state.question).toBeNull();
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.opponentAnswered).toBe(false);
    expect(state.remainingMs).toBe(180_000);
    expect(state.result).toBeNull();
    expect(state.challengeNotification).toBeNull();
  });

  it('should set lobby state with opponent info', () => {
    const opponent: UserProfile = {
      id: 'user-2', username: 'alice', email: '',
      displayName: 'Alice', language: 'en', joinCode: '', createdAt: '',
    };
    useMultiplayerStore.getState().setLobby(opponent);

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('lobby');
    expect(state.opponent?.username).toBe('alice');
    expect(state.opponent?.displayName).toBe('Alice');
  });

  it('should transition to playing on match start', () => {
    const opponent: UserProfile = {
      id: 'user-2', username: 'bob', email: '',
      language: 'en', joinCode: '', createdAt: '',
    };
    const question: QuizQuestion = {
      id: 'q-1', countryId: 'c-1', questionType: 'flag-to-country',
      questionText: 'Which country is this?', options: ['A', 'B', 'C', 'D'],
      correctIndex: 0, timeLimitMs: 3000, questionNumber: 1,
    };

    useMultiplayerStore.getState().startMatch({
      matchId: 'match-1', opponent, timeLimitMs: 180_000, question,
    });

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('playing');
    expect(state.matchId).toBe('match-1');
    expect(state.opponent?.username).toBe('bob');
    expect(state.question?.id).toBe('q-1');
    expect(state.remainingMs).toBe(180_000);
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.opponentAnswered).toBe(false);
  });

  it('should update the current question', () => {
    const question: QuizQuestion = {
      id: 'q-2', countryId: 'c-2', questionType: 'capital-to-country',
      questionText: 'What is the capital?', options: ['X', 'Y', 'Z', 'W'],
      correctIndex: 2, timeLimitMs: 3000, questionNumber: 2,
    };
    useMultiplayerStore.getState().setQuestion(question);

    expect(useMultiplayerStore.getState().question?.id).toBe('q-2');
    expect(useMultiplayerStore.getState().question?.questionText).toBe('What is the capital?');
  });

  it('should update score and streak', () => {
    useMultiplayerStore.getState().updateScore(100);
    expect(useMultiplayerStore.getState().score).toBe(100);

    useMultiplayerStore.getState().updateScore(150);
    expect(useMultiplayerStore.getState().score).toBe(250);

    useMultiplayerStore.getState().setStreak(3);
    expect(useMultiplayerStore.getState().streak).toBe(3);
  });

  it('should toggle opponent answered indicator', () => {
    useMultiplayerStore.getState().showOpponentAnswered(true);
    expect(useMultiplayerStore.getState().opponentAnswered).toBe(true);

    useMultiplayerStore.getState().showOpponentAnswered(false);
    expect(useMultiplayerStore.getState().opponentAnswered).toBe(false);
  });

  it('should update the timer', () => {
    useMultiplayerStore.getState().updateTimer(90_000);
    expect(useMultiplayerStore.getState().remainingMs).toBe(90_000);

    useMultiplayerStore.getState().updateTimer(45_000);
    expect(useMultiplayerStore.getState().remainingMs).toBe(45_000);
  });

  it('should transition to ended screen with result', () => {
    const playerA: PlayerStats = {
      userId: 'user-1', username: 'charlie', score: 500,
      correctCount: 5, totalAnswered: 8, maxStreak: 3,
    };
    const playerB: PlayerStats = {
      userId: 'user-2', username: 'dave', score: 300,
      correctCount: 3, totalAnswered: 7, maxStreak: 2,
    };
    const result: MatchResult = {
      matchId: 'match-1', winnerId: 'user-1',
      reason: 'timer_expired', players: [playerA, playerB],
    };

    useMultiplayerStore.getState().endMatch(result);

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('ended');
    expect(state.result?.winnerId).toBe('user-1');
    expect(state.result?.reason).toBe('timer_expired');
    expect(state.result?.players).toHaveLength(2);
    expect(state.result?.players[0].score).toBe(500);
  });

  it('should handle tie result', () => {
    const playerA: PlayerStats = {
      userId: 'user-1', username: 'eve', score: 400,
      correctCount: 4, totalAnswered: 6, maxStreak: 2,
    };
    const playerB: PlayerStats = {
      userId: 'user-2', username: 'frank', score: 400,
      correctCount: 4, totalAnswered: 6, maxStreak: 2,
    };
    const result: MatchResult = {
      matchId: 'match-2', winnerId: null,
      reason: 'both_finished', players: [playerA, playerB],
    };

    useMultiplayerStore.getState().endMatch(result);

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('ended');
    expect(state.result?.winnerId).toBeNull();
    expect(state.result?.reason).toBe('both_finished');
  });

  it('should handle opponent_disconnected result', () => {
    const playerA: PlayerStats = {
      userId: 'user-1', username: 'grace', score: 200,
      correctCount: 2, totalAnswered: 3, maxStreak: 1,
    };
    const playerB: PlayerStats = {
      userId: 'user-2', username: 'heidi', score: 100,
      correctCount: 1, totalAnswered: 2, maxStreak: 1,
    };
    const result: MatchResult = {
      matchId: 'match-3', winnerId: 'user-1',
      reason: 'opponent_disconnected', players: [playerA, playerB],
    };

    useMultiplayerStore.getState().endMatch(result);

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('ended');
    expect(state.result?.reason).toBe('opponent_disconnected');
    expect(state.result?.winnerId).toBe('user-1');
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

  it('should reset to lobby state', () => {
    // Set up playing state first
    const opponent: UserProfile = {
      id: 'user-2', username: 'ivan', email: '',
      language: 'en', joinCode: '', createdAt: '',
    };
    const question: QuizQuestion = {
      id: 'q-5', countryId: 'c-5', questionType: 'free',
      questionText: 'Test?', options: ['A', 'B', 'C', 'D'],
      correctIndex: 0, timeLimitMs: 3000, questionNumber: 1,
    };
    const result: MatchResult = {
      matchId: 'match-4', winnerId: 'user-1',
      reason: 'both_finished',
      players: [
        { userId: 'user-1', username: 'judy', score: 500, correctCount: 5, totalAnswered: 5, maxStreak: 5 },
        { userId: 'user-2', username: 'ivan', score: 400, correctCount: 4, totalAnswered: 5, maxStreak: 4 },
      ],
    };

    useMultiplayerStore.getState().startMatch({
      matchId: 'match-4', opponent, timeLimitMs: 180_000, question,
    });
    useMultiplayerStore.getState().updateScore(500);
    useMultiplayerStore.getState().setStreak(5);
    useMultiplayerStore.getState().endMatch(result);

    // Now reset
    useMultiplayerStore.getState().reset();

    const state = useMultiplayerStore.getState();
    expect(state.screen).toBe('lobby');
    expect(state.matchId).toBeNull();
    expect(state.opponent).toBeNull();
    expect(state.question).toBeNull();
    expect(state.score).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.remainingMs).toBe(180_000);
    expect(state.result).toBeNull();
  });
});
