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
  finishMatch,
  deleteExpiredMatches,
} from '../services/matchService.js';

// ─── Fixtures ───────────────────────────────────────────────────

const USER1_PROFILE = { id: 'user-1', username: 'player1', displayName: null, avatarUrl: null, isVerified: false };
const USER2_PROFILE = { id: 'user-2', username: 'player2', displayName: null, avatarUrl: null, isVerified: false };

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
 * Builds the row returned by completeMatchIfBothFinished's fresh re-read
 * (the SELECT of flags+scores+status+winnerId that runs after every finish write).
 */
function makeFreshState(overrides: Record<string, any> = {}) {
  return [{
    player1Score: 0,
    player2Score: 0,
    player1Finished: false,
    player2Finished: false,
    winnerId: null,
    status: 'in_progress',
    ...overrides,
  }];
}

/**
 * Push all pendingResults entries for a single submitAnswer() call.
 *
 * submitAnswer internally calls, in order:
 *   1. getFullMatch → db.select().from(matchGames).where(...).limit(1)
 *   2. db.select({streakAtAnswer}).from(matchAnswers).where(...).orderBy(...)
 *   3. db.insert(matchAnswers).values(...)
 *   4. db.update(matchGames).set(score + finished).where(...)
 *   5. if finished → completeMatchIfBothFinished: fresh re-read of flags+scores+status
 *   6. if both finished → db.update(matchGames).set({status,winnerId}).where(...)
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

  // 2. prev answers (only streakAtAnswer column, matching the lighter select)
  const prev: any[] = [];
  for (let j = 0; j < correctSoFar; j++) {
    prev.push({ streakAtAnswer: j + 1 });
  }
  pendingResults.push(prev);

  // 3. insert answer
  pendingResults.push(undefined);

  // 4. update match (score + finished flag)
  pendingResults.push(undefined);

  // 5. completeMatchIfBothFinished: fresh re-read of flags + scores + status.
  //    Runs whenever THIS answer finishes the player (finished=true), even if
  //    the opponent hasn't finished yet.
  const isFinishingAnswer = correctSoFar + 1 >= totalQuestions;
  if (isFinishingAnswer) {
    const newScore = playerScoreBefore + (isCorrect ? 100 : -50);
    pendingResults.push(makeFreshState({
      player1Score: isPlayer1 ? newScore : otherScore,
      player2Score: isPlayer1 ? otherScore : newScore,
      player1Finished: isPlayer1 || otherFinished,
      player2Finished: isPlayer1 ? otherFinished : true,
    }));
  }

  // 6. completion update (only if both finished)
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

  it('should return -50 for wrong answer regardless of streak', () => {
    expect(calculateRaceScore(false, 0)).toBe(-50);
    expect(calculateRaceScore(false, 3)).toBe(-50);
    expect(calculateRaceScore(false, 10)).toBe(-50);
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

  it('should reject answers and finish the player when time has expired', async () => {
    // Player 1 started 4 minutes ago; default duration is 3 minutes
    const startedAt = new Date(Date.now() - 4 * 60 * 1000);
    pendingResults.push([createMockMatch({ player1StartedAt: startedAt })]);
    pendingResults.push(undefined); // markPlayerFinished → update finished flag
    pendingResults.push(makeFreshState({ player1Finished: true })); // fresh re-read → other not finished → no completion

    const result = await submitAnswer('m-1', 'user-1', 0);

    expect(result).not.toBeNull();
    expect(result!.finished).toBe(true);
    expect(result!.matchEnded).toBe(false);
    expect(result!.nextQuestion).toBeNull();
    expect(result!.correct).toBe(false);
    expect(result!.scoreEarned).toBe(0);
  });

  it('should complete the match when time expires and opponent already finished', async () => {
    const startedAt = new Date(Date.now() - 4 * 60 * 1000);
    pendingResults.push([createMockMatch({
      player1StartedAt: startedAt,
      player2Finished: true,
      player1Score: 200,
      player2Score: 300,
    })]);
    pendingResults.push(undefined); // markPlayerFinished → update finished flag
    pendingResults.push(makeFreshState({
      player1Finished: true,
      player2Finished: true,
      player1Score: 200,
      player2Score: 300,
    })); // fresh re-read → both finished
    pendingResults.push(undefined); // completion update

    const result = await submitAnswer('m-1', 'user-1', 0);

    expect(result).not.toBeNull();
    expect(result!.finished).toBe(true);
    expect(result!.matchEnded).toBe(true);
    expect(result!.nextQuestion).toBeNull();
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

  it('should penalize wrong answer with -50 and reset streak', async () => {
    // First answer correct
    pushSubmitAnswerMocks(0, true, 0, true, 50, false);
    await submitAnswer('m-1', 'user-1', 0);

    // Second answer wrong
    pushSubmitAnswerMocks(1, false, 100, true, 50, false);

    const result = await submitAnswer('m-1', 'user-1', 1);

    expect(result).not.toBeNull();
    expect(result!.correct).toBe(false);
    expect(result!.scoreEarned).toBe(-50);
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
//  finishMatch (time expiry / early finish)
// ===================================================================

describe('finishMatch', () => {
  it('should return null for unknown match', async () => {
    pendingResults.push([]);

    const result = await finishMatch('nonexistent', 'user-1');

    expect(result).toBeNull();
  });

  it('should return null for completed match', async () => {
    pendingResults.push([createMockMatch({ status: 'completed' })]);

    const result = await finishMatch('m-1', 'user-1');

    expect(result).toBeNull();
  });

  it('should mark the player finished without changing score', async () => {
    pendingResults.push([createMockMatch()]);
    pendingResults.push(undefined); // markPlayerFinished → update finished flag
    pendingResults.push(makeFreshState({ player1Finished: true })); // fresh re-read → other not finished → no completion

    const result = await finishMatch('m-1', 'user-1');

    expect(result).toEqual({ finished: true, matchEnded: false, winnerId: null });

    const setCall = mockDb.set.mock.calls[0][0];
    expect(setCall.player1Finished).toBe(true);
    expect(setCall.player1Score).toBeUndefined();
  });

  it('should complete the match when both players are finished', async () => {
    pendingResults.push([createMockMatch({
      player2Finished: true,
      player1Score: 500,
      player2Score: 300,
    })]);
    pendingResults.push(undefined); // markPlayerFinished → update finished flag
    pendingResults.push(makeFreshState({
      player1Finished: true,
      player2Finished: true,
      player1Score: 500,
      player2Score: 300,
    })); // fresh re-read → both finished
    pendingResults.push(undefined); // completion update

    const result = await finishMatch('m-1', 'user-1');

    expect(result).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });
  });

  it('should be idempotent when the player already finished', async () => {
    pendingResults.push([createMockMatch({ player1Finished: true })]);
    pendingResults.push(makeFreshState({ player1Finished: true })); // idempotent branch → fresh re-read → other not finished

    const result = await finishMatch('m-1', 'user-1');

    expect(result).toEqual({ finished: true, matchEnded: false, winnerId: null });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('should return null for a user not in the match', async () => {
    pendingResults.push([createMockMatch()]);

    const result = await finishMatch('m-1', 'user-99');

    expect(result).toBeNull();
  });
});

// ===================================================================
//  Atomic completion (completeMatchIfBothFinished — D1/D2/D7)
// ===================================================================

describe('atomic completion (completeMatchIfBothFinished)', () => {
  it('completes from FRESH scores — the last finisher never uses stale snapshot scores', async () => {
    // user-2 (last finisher) snapshots BEFORE user-1's final answer commits:
    // the snapshot shows p1Score=400 (stale) but the fresh re-read sees p1Score=700.
    // Stale logic would crown user-2 (500>400); fresh logic crowns user-1 (700>500).
    pendingResults.push([createMockMatch({
      player1Score: 400,
      player2Score: 500,
      player1Finished: false,
      player2Finished: false,
    })]);
    pendingResults.push(undefined); // markPlayerFinished → update p2Finished flag
    pendingResults.push(makeFreshState({
      player1Score: 700,
      player2Score: 500,
      player1Finished: true,
      player2Finished: true,
    })); // fresh re-read → both finished, fresh scores
    pendingResults.push(undefined); // completion update

    const result = await finishMatch('m-1', 'user-2');

    expect(result).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });

    const completionSets = mockDb.set.mock.calls.filter((c) => c[0]?.status === 'completed');
    expect(completionSets).toHaveLength(1);
    expect(completionSets[0][0]).toEqual({ status: 'completed', winnerId: 'user-1' });
  });

  it('D7-A: two finishMatch calls sharing one stale snapshot → exactly one completion UPDATE, winner from fresh scores', async () => {
    // Both requests read the SAME stale snapshot (other.finished=false), then each
    // writes its flag. The first fresh re-read sees both flags committed and
    // completes; the second fresh re-read sees status=completed and short-circuits
    // (idempotent). No timing, no races — the mock queue fixes the interleaving.
    const staleSnapshot = createMockMatch({
      player1Finished: false,
      player2Finished: false,
      player1Score: 400,
      player2Score: 500,
    });

    // call 1 (user-1): getFullMatch → write p1Finished → fresh read (both committed) → completion UPDATE
    pendingResults.push([staleSnapshot]);
    pendingResults.push(undefined); // write p1Finished
    pendingResults.push(makeFreshState({
      player1Finished: true,
      player2Finished: true,
      player1Score: 700,
      player2Score: 500,
    }));
    pendingResults.push(undefined); // completion UPDATE
    // call 2 (user-2): getFullMatch (same stale) → write p2Finished → fresh read (already completed) → no update
    pendingResults.push([staleSnapshot]);
    pendingResults.push(undefined); // write p2Finished
    pendingResults.push(makeFreshState({ status: 'completed', winnerId: 'user-1' }));

    const r1 = await finishMatch('m-1', 'user-1');
    const r2 = await finishMatch('m-1', 'user-2');

    expect(r1).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });
    expect(r2).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });

    // Exactly ONE completion UPDATE — winner from FRESH scores (700>500 → user-1,
    // NOT stale 400<500 → user-2).
    const completionSets = mockDb.set.mock.calls.filter((c) => c[0]?.status === 'completed');
    expect(completionSets).toHaveLength(1);
    expect(completionSets[0][0]).toEqual({ status: 'completed', winnerId: 'user-1' });

    // Explicit invocation ORDER (mock queue, no timing): call 1 writes its
    // flag, completes from the fresh read (which observed call 2's flag as
    // already committed), then call 2 writes its flag and short-circuits.
    const setOrder = mockDb.set.mock.calls.map((c) => c[0]);
    expect(setOrder).toHaveLength(3);
    expect(setOrder[0].player1Finished).toBe(true);
    expect(setOrder[1]).toEqual({ status: 'completed', winnerId: 'user-1' });
    expect(setOrder[2].player2Finished).toBe(true);
  });

  it('D7-B: first finisher fresh-read misses the other commit → last finisher completes, never stuck in_progress', async () => {
    const staleSnapshot = createMockMatch({
      player1Finished: false,
      player2Finished: false,
      player1Score: 400,
      player2Score: 500,
    });

    // call 1 (user-1): getFullMatch → write p1Finished → fresh read sees p2 NOT committed → no completion
    pendingResults.push([staleSnapshot]);
    pendingResults.push(undefined); // write p1Finished
    pendingResults.push(makeFreshState({ player1Finished: true, player2Finished: false }));
    // call 2 (user-2): getFullMatch (same stale) → write p2Finished → fresh read sees both → completion UPDATE
    pendingResults.push([staleSnapshot]);
    pendingResults.push(undefined); // write p2Finished
    pendingResults.push(makeFreshState({
      player1Finished: true,
      player2Finished: true,
      player1Score: 700,
      player2Score: 500,
    }));
    pendingResults.push(undefined); // completion UPDATE

    const r1 = await finishMatch('m-1', 'user-1');
    const r2 = await finishMatch('m-1', 'user-2');

    expect(r1).toEqual({ finished: true, matchEnded: false, winnerId: null });
    expect(r2).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });

    // Exactly one completion UPDATE — the last finisher always completes.
    const completionSets = mockDb.set.mock.calls.filter((c) => c[0]?.status === 'completed');
    expect(completionSets).toHaveLength(1);
    expect(completionSets[0][0]).toEqual({ status: 'completed', winnerId: 'user-1' });
  });

  it('repairs a stuck row (both finished, status still in_progress) via the idempotent branch', async () => {
    pendingResults.push([createMockMatch({
      player1Finished: true,
      player2Finished: true,
      player1Score: 500,
      player2Score: 300,
      winnerId: null,
      status: 'in_progress', // stuck: both flags set, no winner, not completed
    })]);
    pendingResults.push(makeFreshState({
      player1Finished: true,
      player2Finished: true,
      player1Score: 500,
      player2Score: 300,
    })); // idempotent branch → fresh re-read → both finished → completion UPDATE
    pendingResults.push(undefined); // completion UPDATE

    const result = await finishMatch('m-1', 'user-1');

    expect(result).toEqual({ finished: true, matchEnded: true, winnerId: 'user-1' });

    const completionSets = mockDb.set.mock.calls.filter((c) => c[0]?.status === 'completed');
    expect(completionSets).toHaveLength(1);
    expect(completionSets[0][0]).toEqual({ status: 'completed', winnerId: 'user-1' });
  });
});

// ===================================================================
//  deleteExpiredMatches (24h stale match cleanup)
// ===================================================================

describe('deleteExpiredMatches', () => {
  it('should do nothing when no expired matches or stale challenges exist', async () => {
    pendingResults.push([]); // no expired matches
    pendingResults.push([]); // no stale pending challenges

    const result = await deleteExpiredMatches();

    expect(result).toEqual({ deleted: 0 });
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('should permanently delete expired matches, their answers, and challenges', async () => {
    pendingResults.push([
      { id: 'm-1', challengeId: 'ch-1' },
      { id: 'm-2', challengeId: 'ch-2' },
    ]);
    pendingResults.push([]); // no stale pending challenges
    // Three deletes: answers, games, challenges
    pendingResults.push(undefined);
    pendingResults.push(undefined);
    pendingResults.push(undefined);

    const result = await deleteExpiredMatches();

    expect(result).toEqual({ deleted: 2 });
    expect(mockDb.delete).toHaveBeenCalledTimes(3);
  });

  it('should delete stale pending challenges that were never accepted', async () => {
    pendingResults.push([]); // no expired matches
    pendingResults.push([{ id: 'ch-stale' }]); // one stale pending challenge
    pendingResults.push(undefined); // one delete: the stale challenge

    const result = await deleteExpiredMatches();

    expect(result).toEqual({ deleted: 1 });
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
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
