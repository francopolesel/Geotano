import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock questions ─────────────────────────────────────────────

function makeMockQuestions(count: number) {
  const qs: any[] = [];
  for (let i = 0; i < count; i++) {
    qs.push({
      id: `q-${i}`,
      countryId: `c-${i}`,
      questionType: 'free',
      questionText: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      correctAnswer: 'A',
      flagUrl: undefined,
      timeLimitMs: 15000,
      questionNumber: i + 1,
      optionsCountryIds: [`c-${i}`, `c2-${i}`, `c4-${i}`, `c4-${i}`],
    });
  }
  return qs;
}

const POOL_50 = makeMockQuestions(50);
const POOL_5 = makeMockQuestions(5);

// ─── Hoisted mocks ──────────────────────────────────────────────

const pendingResults: any[] = [];

const mockDb = vi.hoisted(() => {
  function makeChainable() {
    const chain: any = () => chain;
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.then = vi.fn((resolve: any) => {
      const data = pendingResults.shift();
      resolve(data !== undefined ? data : []);
    });
    chain.catch = vi.fn();
    return chain;
  }
  return makeChainable();
});

vi.mock('../db/index.js', () => ({ db: mockDb }));

const mockGenerateMatchQuestionPool = vi.hoisted(() => vi.fn());
vi.mock('../services/quizEngine.js', () => ({
  generateMatchQuestionPool: mockGenerateMatchQuestionPool,
}));

// ─── Imports ────────────────────────────────────────────────────

import {
  calculateRaceScore,
  createChallenge,
  acceptChallenge,
  declineChallenge,
  getMatchState,
  getPlayerMatchHistory,
  startMatchPlay,
  submitAnswer,
} from '../services/matchService.js';

// ─── Fixtures ───────────────────────────────────────────────────

const USER1_PROFILE = { id: 'user-1', username: 'player1', displayName: null, avatarUrl: null };
const USER2_PROFILE = { id: 'user-2', username: 'player2', displayName: null, avatarUrl: null };

function createMockMatch(overrides: Record<string, any> = {}) {
  return {
    id: 'm-1',
    challengeId: 'ch-1',
    player1Id: 'user-1',
    player2Id: 'user-2',
    gameModeSlug: 'classic',
    player1Score: 0,
    player2Score: 0,
    player1Finished: false,
    player2Finished: false,
    player1StartedAt: null,
    player2StartedAt: null,
    winnerId: null,
    status: 'in_progress',
    createdAt: new Date('2026-01-01'),
    questionPool: POOL_50,
    playerAOrder: Array.from({ length: 50 }, (_, i) => i),
    playerBOrder: Array.from({ length: 50 }, (_, i) => i),
    ...overrides,
  };
}

function pushProfiles() {
  pendingResults.push([USER1_PROFILE]);
  pendingResults.push([USER2_PROFILE]);
}

/**
 * Push all pendingResults entries for a single submitAnswer() call.
 *
 * submitAnswer internally calls, in order:
 *   1. getFullMatch → db.select().from(matchGames).where(...).limit(1)
 *   2. db.select().from(matchAnswers).where(...).orderBy(...)
 *   3. db.insert(matchAnswers).values(...)
 *   4. db.update(matchGames).set(...).where(...)
 *   5. getMatchState → getFullMatch → db.select().from(matchGames).where(...).limit(1)
 *   6. db.select().from(users).where(...).limit(1)  [profile 1]
 *   7. db.select().from(users).where(...).limit(1)  [profile 2]
 *   8. if bothFinished → db.update(matchGames).set({status,winnerId}).where(...)
 */
function pushSubmitAnswerMocks(
  correctSoFar: number,
  isCorrect: boolean,
  playerScoreBefore: number,
  isPlayer1: boolean,
  totalQuestions: number,
  bothFinished: boolean,
  otherScore = 0,
  otherFinished = false,
) {
  const orderArr = Array.from({ length: totalQuestions }, (_, i) => i);
  // 1. getFullMatch
  pendingResults.push([createMockMatch({
    player1Score: isPlayer1 ? playerScoreBefore : otherScore,
    player2Score: isPlayer1 ? otherScore : playerScoreBefore,
    player1Finished: isPlayer1 ? false : otherFinished,
    player2Finished: isPlayer1 ? otherFinished : false,
    playerAOrder: orderArr,
    playerBOrder: orderArr,
  })]);

  // 2. prev answers
  const prev: any[] = [];
  for (let j = 0; j < correctSoFar; j++) {
    prev.push({
      streakAtAnswer: j + 1,
      wasCorrect: true,
      scoreEarned: j >= 2 ? 150 : 100,
    });
  }
  pendingResults.push(prev);

  // 3. insert answer
  pendingResults.push(undefined);

  // 4. update match
  pendingResults.push(undefined);

  // 5. getMatchState → getFullMatch
  const afterScore = playerScoreBefore + (isCorrect ? (correctSoFar >= 2 ? 150 : 100) : 0);
  const thisFinished = correctSoFar + 1 >= totalQuestions;
  pendingResults.push([createMockMatch({
    player1Score: isPlayer1 ? afterScore : otherScore,
    player2Score: isPlayer1 ? otherScore : afterScore,
    player1Finished: isPlayer1 ? thisFinished : otherFinished,
    player2Finished: isPlayer1 ? otherFinished : thisFinished,
    playerAOrder: orderArr,
    playerBOrder: orderArr,
  })]);

  // 6–7. profiles
  pushProfiles();

  // 8. bothFinished update
  if (bothFinished) {
    pendingResults.push(undefined);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  pendingResults.length = 0;
});

// ===================================================================
//  calculateRaceScore (pure function)
// ===================================================================

describe('calculateRaceScore', () => {
  it('should return 100 for correct answer with no streak', () => {
    expect(calculateRaceScore(true, 0)).toBe(100);
  });

  it('should return 100 for correct answer with streak below threshold', () => {
    expect(calculateRaceScore(true, 1)).toBe(100);
    expect(calculateRaceScore(true, 2)).toBe(100);
  });

  it('should return 150 for correct answer with streak >= 3', () => {
    expect(calculateRaceScore(true, 3)).toBe(150);
    expect(calculateRaceScore(true, 5)).toBe(150);
    expect(calculateRaceScore(true, 10)).toBe(150);
  });

  it('should return 0 for wrong answer regardless of streak', () => {
    expect(calculateRaceScore(false, 0)).toBe(0);
    expect(calculateRaceScore(false, 3)).toBe(0);
    expect(calculateRaceScore(false, 10)).toBe(0);
  });
});

// ===================================================================
//  createChallenge
// ===================================================================

describe('createChallenge', () => {
  it('should insert a challenge row and return its id', async () => {
    pendingResults.push(undefined); // db.insert().values()

    const id = await createChallenge('user-1', 'user-2', 'classic');

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        challengerId: 'user-1',
        receiverId: 'user-2',
        gameModeSlug: 'classic',
        status: 'pending',
      }),
    );
  });
});

// ===================================================================
//  acceptChallenge
// ===================================================================

describe('acceptChallenge', () => {
  it('should accept a pending challenge, generate questions, create match, and return result', async () => {
    const challengeRow = {
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      gameModeSlug: 'classic',
      status: 'pending',
    };
    pendingResults.push([challengeRow]); // select challenge
    mockGenerateMatchQuestionPool.mockResolvedValueOnce(POOL_5 as any);
    pendingResults.push(undefined);        // insert match
    pendingResults.push(undefined);        // update challenge status

    const result = await acceptChallenge('ch-1', 'user-2');

    expect(result).not.toBeNull();
    expect(result!.matchId).toBeDefined();
    expect(typeof result!.matchId).toBe('string');
    expect(result!.challenge.challengerId).toBe('user-1');
    expect(result!.challenge.receiverId).toBe('user-2');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should return null for unknown challenge', async () => {
    pendingResults.push([]);

    const result = await acceptChallenge('nonexistent', 'user-2');

    expect(result).toBeNull();
  });

  it('should return null when userId is not the receiver', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'pending',
    }]);

    const result = await acceptChallenge('ch-1', 'user-1');

    expect(result).toBeNull();
  });

  it('should return null when challenge is not pending', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'accepted',
    }]);

    const result = await acceptChallenge('ch-1', 'user-2');

    expect(result).toBeNull();
  });
});

// ===================================================================
//  declineChallenge
// ===================================================================

describe('declineChallenge', () => {
  it('should decline a valid pending challenge and return true', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'pending',
    }]);
    pendingResults.push(undefined);

    const result = await declineChallenge('ch-1', 'user-2');

    expect(result).toBe(true);
  });

  it('should return false for unknown challenge', async () => {
    pendingResults.push([]);

    const result = await declineChallenge('nonexistent', 'user-2');

    expect(result).toBe(false);
  });

  it('should return false when userId is not the receiver', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'pending',
    }]);

    const result = await declineChallenge('ch-1', 'user-1');

    expect(result).toBe(false);
  });

  it('should return false when challenge is not pending', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'declined',
    }]);

    const result = await declineChallenge('ch-1', 'user-2');

    expect(result).toBe(false);
  });
});

// ===================================================================
//  getMatchState
// ===================================================================

describe('getMatchState', () => {
  it('should return match state with player profiles', async () => {
    pendingResults.push([createMockMatch()]); // getFullMatch
    pushProfiles();

    const result = await getMatchState('m-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('m-1');
    expect(result!.player1Id).toBe('user-1');
    expect(result!.player2Id).toBe('user-2');
    expect(result!.status).toBe('in_progress');
    expect(result!.player1).toEqual(USER1_PROFILE);
    expect(result!.player2).toEqual(USER2_PROFILE);
  });

  it('should return null for unknown match', async () => {
    pendingResults.push([]);

    const result = await getMatchState('nonexistent');

    expect(result).toBeNull();
  });
});

// ===================================================================
//  getPlayerMatchHistory
// ===================================================================

describe('getPlayerMatchHistory', () => {
  it('should return matches where user is player1 or player2', async () => {
    const rows = [
      createMockMatch({ id: 'm-1' }),
      createMockMatch({ id: 'm-2', player1Id: 'user-1', player2Id: 'user-3' }),
    ];
    pendingResults.push(rows);

    const result = await getPlayerMatchHistory('user-1');

    expect(result).toHaveLength(2);
  });

  it('should return empty array for user with no matches', async () => {
    pendingResults.push([]);

    const result = await getPlayerMatchHistory('user-42');

    expect(result).toEqual([]);
  });
});

// ===================================================================
//  startMatchPlay
// ===================================================================

describe('startMatchPlay', () => {
  it('should return the first question and remaining time for a new player', async () => {
    pendingResults.push([createMockMatch({ status: 'pending' })]); // getFullMatch
    pendingResults.push([{ count: 0 }]);                            // count answers
    pendingResults.push(undefined);                                // update startedAt
    pendingResults.push(undefined);                                // update status → in_progress

    const result = await startMatchPlay('m-1', 'user-1');

    expect(result).not.toBeNull();
    expect(result!.question).toBeDefined();
    expect(result!.question.questionNumber).toBe(1);
    expect(result!.remainingMs).toBeGreaterThan(170_000);
    expect(result!.remainingMs).toBeLessThanOrEqual(180_000);
  });

  it('should return null for unknown match', async () => {
    pendingResults.push([]);

    const result = await startMatchPlay('nonexistent', 'user-1');

    expect(result).toBeNull();
  });

  it('should return null when player has exhausted all questions', async () => {
    pendingResults.push([createMockMatch()]);
    pendingResults.push([{ count: 50 }]);

    const result = await startMatchPlay('m-1', 'user-1');

    expect(result).toBeNull();
  });

  it('should skip startedAt update when player already started', async () => {
    pendingResults.push([createMockMatch({
      status: 'in_progress',
      player1StartedAt: new Date('2026-01-01T00:00:00Z'),
    })]);
    pendingResults.push([{ count: 1 }]);

    const result = await startMatchPlay('m-1', 'user-1');

    expect(result).not.toBeNull();
    expect(result!.question).toBeDefined();
    // Should NOT have called update for startedAt or status
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ===================================================================
//  submitAnswer
// ===================================================================

describe('submitAnswer', () => {
  it('should return null for unknown match', async () => {
    pendingResults.push([]);

    const result = await submitAnswer('nonexistent', 'user-1', 0);

    expect(result).toBeNull();
  });

  it('should return null for completed match', async () => {
    pendingResults.push([createMockMatch({ status: 'completed' })]);

    const result = await submitAnswer('m-1', 'user-1', 0);

    expect(result).toBeNull();
  });

  it('should mark correct answer and award base score', async () => {
    pushSubmitAnswerMocks(0, true, 0, true, 50, false);

    const result = await submitAnswer('m-1', 'user-1', 0);

    expect(result).not.toBeNull();
    expect(result!.correct).toBe(true);
    expect(result!.scoreEarned).toBe(100);
    expect(result!.streak).toBe(1);
    expect(result!.finished).toBe(false);
    expect(result!.matchEnded).toBe(false);
    expect(result!.nextQuestion).not.toBeNull();
  });

  it('should mark wrong answer with 0 score and reset streak', async () => {
    // First answer correct
    pushSubmitAnswerMocks(0, true, 0, true, 50, false);
    await submitAnswer('m-1', 'user-1', 0);

    // Second answer wrong
    pushSubmitAnswerMocks(1, false, 100, true, 50, false);

    const result = await submitAnswer('m-1', 'user-1', 1);

    expect(result).not.toBeNull();
    expect(result!.correct).toBe(false);
    expect(result!.scoreEarned).toBe(0);
    expect(result!.streak).toBe(0);
  });

  it('should apply streak multiplier at 3+ consecutive correct', async () => {
    // Answer 1: correct, streak 1
    pushSubmitAnswerMocks(0, true, 0, true, 50, false);
    await submitAnswer('m-1', 'user-1', 0);

    // Answer 2: correct, streak 2
    pushSubmitAnswerMocks(1, true, 100, true, 50, false);
    await submitAnswer('m-1', 'user-1', 0);

    // Answer 3: correct, streak 3 → streakBefore = 2 (below threshold) → score 100
    pushSubmitAnswerMocks(2, true, 200, true, 50, false);
    const r3 = await submitAnswer('m-1', 'user-1', 0);
    expect(r3!.scoreEarned).toBe(100);
    expect(r3!.streak).toBe(3);

    // Answer 4: correct, streak 4 → streakBefore = 3 (>= threshold) → score 150
    pushSubmitAnswerMocks(3, true, 300, true, 50, false);
    const r4 = await submitAnswer('m-1', 'user-1', 0);
    expect(r4!.scoreEarned).toBe(150);
    expect(r4!.streak).toBe(4);
  });

  it('should finish the match and set matchEnded when both players finish', async () => {
    // Player A answers all 3 correctly
    // Player B answers 2 correctly, then 3rd → bothFinished = true
    for (let i = 0; i < 3; i++) {
      pushSubmitAnswerMocks(i, true, i * 100, true, 3, false, 0, false);
    }
    for (let i = 0; i < 2; i++) {
      pushSubmitAnswerMocks(i, true, i * 100, false, 3, false, 300, true);
    }
    // Player B last answer → bothFinished = true
    pushSubmitAnswerMocks(2, true, 200, false, 3, true, 300, true);

    for (let i = 0; i < 3; i++) {
      await submitAnswer('m-1', 'user-1', 0);
    }
    let lastResult: any = null;
    for (let i = 0; i < 3; i++) {
      lastResult = await submitAnswer('m-1', 'user-2', 0);
    }

    expect(lastResult).not.toBeNull();
    expect(lastResult!.finished).toBe(true);
    expect(lastResult!.matchEnded).toBe(true);
    expect(lastResult!.nextQuestion).toBeNull();
  });
});

// ===================================================================
//  Edge cases
// ===================================================================

describe('edge cases', () => {
  it('should return null for getMatchState on non-existent match', async () => {
    pendingResults.push([]);

    const result = await getMatchState('no-such-match');

    expect(result).toBeNull();
  });

  it('should return false when declining already-declined challenge', async () => {
    pendingResults.push([{
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      status: 'declined',
    }]);

    const result = await declineChallenge('ch-1', 'user-2');

    expect(result).toBe(false);
  });

  it('should use the same shuffled order for both players on acceptChallenge', async () => {
    const challengeRow = {
      id: 'ch-1',
      challengerId: 'user-1',
      receiverId: 'user-2',
      gameModeSlug: 'classic',
      status: 'pending',
    };
    pendingResults.push([challengeRow]);
    mockGenerateMatchQuestionPool.mockResolvedValueOnce(POOL_5 as any);
    pendingResults.push(undefined);
    pendingResults.push(undefined);

    const result = await acceptChallenge('ch-1', 'user-2');

    expect(result).not.toBeNull();
    const insertCall = mockDb.values.mock.calls[0][0];
    expect(insertCall.playerAOrder).toBeDefined();
    expect(insertCall.playerBOrder).toBeDefined();
    expect(insertCall.playerAOrder).toHaveLength(5);
    expect(insertCall.playerBOrder).toHaveLength(5);
    expect(insertCall.playerAOrder.join(',')).toBe(insertCall.playerBOrder.join(','));
  });
});
