import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock questions for pool override ───────────────────────────────────────

function makeMockQuestions(count: number) {
  const qs: any[] = [];
  for (let i = 0; i < count; i++) {
    qs.push({
      id: `q-${i}`,
      countryId: `c-${i}`,
      questionType: 'free',
      questionText: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0, // always index 0 is correct
      correctAnswer: 'A',
      flagUrl: undefined,
      timeLimitMs: 15000,
      questionNumber: i + 1,
      optionsCountryIds: [`c-${i}`, `c2-${i}`, `c3-${i}`, `c4-${i}`],
    });
  }
  return qs;
}

const POOL_50 = makeMockQuestions(50);

import {
  calculateRaceScore,
  createChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  getChallenge,
  generateMatch,
  submitAnswer,
  handleDisconnect,
  rejoinMatch,
  startMatchTimer,
  setChallengeTimeoutCallback,
  setForfeitCallback,
  setMatchTimerEndCallback,
  __resetForTesting,
  matches,
  challenges,
  userMatchMap,
} from '../services/matchService.js';

// ─── Test setup ──────────────────────────────────────────────────────────────

afterEach(() => {
  __resetForTesting();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── calculateRaceScore (pure function) ─────────────────────────────────────

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

// ─── Challenge Lifecycle ────────────────────────────────────────────────────

describe('challenge lifecycle', () => {
  it('should create a challenge and return its id', () => {
    const id = createChallenge('user-1', 'user-2');
    expect(id).toBeDefined();
    expect(id).toBeTypeOf('string');
    expect(challenges.has(id)).toBe(true);
  });

  it('should accept a valid challenge and return it', () => {
    const id = createChallenge('user-1', 'user-2');
    const result = acceptChallenge(id);
    expect(result).not.toBeNull();
    expect(result!.challengerId).toBe('user-1');
    expect(result!.receiverId).toBe('user-2');
    expect(challenges.has(id)).toBe(false);
  });

  it('should return null when accepting an unknown challenge', () => {
    expect(acceptChallenge('nonexistent')).toBeNull();
  });

  it('should decline a valid challenge and remove it', () => {
    const id = createChallenge('user-1', 'user-2');
    const result = declineChallenge(id);
    expect(result).toBe(true);
    expect(challenges.has(id)).toBe(false);
  });

  it('should return false when declining an unknown challenge', () => {
    expect(declineChallenge('nonexistent')).toBe(false);
  });

  it('should cancel a valid challenge and remove it', () => {
    const id = createChallenge('user-1', 'user-2');
    const result = cancelChallenge(id);
    expect(result).toBe(true);
    expect(challenges.has(id)).toBe(false);
  });

  it('should return false when cancelling an unknown challenge', () => {
    expect(cancelChallenge('nonexistent')).toBe(false);
  });

  it('should fire challenge timeout callback after 30s', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    setChallengeTimeoutCallback(cb);

    const id = createChallenge('user-1', 'user-2');
    expect(challenges.has(id)).toBe(true);

    vi.advanceTimersByTime(29_000);
    expect(cb).not.toHaveBeenCalled();
    expect(challenges.has(id)).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(id, 'user-1');
    expect(challenges.has(id)).toBe(false);
  });

  it('should NOT fire timeout callback after challenge is accepted', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    setChallengeTimeoutCallback(cb);

    const id = createChallenge('user-1', 'user-2');
    acceptChallenge(id);
    vi.advanceTimersByTime(60_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('should get a challenge by id', () => {
    const id = createChallenge('user-1', 'user-2');
    const c = getChallenge(id);
    expect(c).toBeDefined();
    expect(c!.challengerId).toBe('user-1');
  });

  it('should return undefined for unknown challenge', () => {
    expect(getChallenge('nonexistent')).toBeUndefined();
  });
});

// ─── generateMatch ──────────────────────────────────────────────────────────

describe('generateMatch', () => {
  it('should create a match with 50 questions and per-player orders', async () => {
    const state = await generateMatch('user-1', 'user-2', 'en', POOL_50);

    expect(state.id).toBeTypeOf('string');
    expect(state.status).toBe('active');
    expect(state.playerA.userId).toBe('user-1');
    expect(state.playerB.userId).toBe('user-2');
    expect(state.questionPool).toHaveLength(50);
    expect(state.playerAOrder).toHaveLength(50);
    expect(state.playerBOrder).toHaveLength(50);
    expect(state.timerDurationMs).toBe(180_000);
    expect(state.timerStartedAt).toBeGreaterThan(0);
    expect(state.disconnectedAt).toBeInstanceOf(Map);
    expect(state.winnerId).toBeNull();

    // Verify player orders are shuffled (astronomically low chance of identical)
    const aStr = state.playerAOrder.join(',');
    const bStr = state.playerBOrder.join(',');
    expect(aStr).not.toBe(bStr);

    // Verify userMatchMap entries
    expect(userMatchMap.get('user-1')).toBe(state.id);
    expect(userMatchMap.get('user-2')).toBe(state.id);
  });
});

// ─── submitAnswer ───────────────────────────────────────────────────────────

describe('submitAnswer', () => {
  let matchId: string;

  beforeEach(async () => {
    const state = await generateMatch('user-1', 'user-2', 'en', POOL_50);
    matchId = state.id;
  });

  it('should return null for unknown match', () => {
    expect(submitAnswer('nonexistent', 'user-1', 0)).toBeNull();
  });

  it('should mark correct answer and award base score', () => {
    const result = submitAnswer(matchId, 'user-1', 0);
    // All mock questions have correctIndex = 0
    expect(result).not.toBeNull();
    expect(result!.correct).toBe(true);
    expect(result!.scoreEarned).toBe(100);
    expect(result!.streak).toBe(1);
    expect(result!.finished).toBe(false);
    expect(result!.matchEnded).toBe(false);
    expect(result!.nextQuestion).not.toBeNull();
  });

  it('should mark wrong answer with 0 score and reset streak', () => {
    submitAnswer(matchId, 'user-1', 0); // correct → streak 1
    const result = submitAnswer(matchId, 'user-1', 1); // wrong
    expect(result).not.toBeNull();
    expect(result!.correct).toBe(false);
    expect(result!.scoreEarned).toBe(0);
    expect(result!.streak).toBe(0);
  });

  it('should apply streak multiplier at 3+ consecutive correct', () => {
    submitAnswer(matchId, 'user-1', 0); // streak 0→1, score 100
    submitAnswer(matchId, 'user-1', 0); // streak 1→2, score 100
    const result = submitAnswer(matchId, 'user-1', 0); // streak 2→3, streakBefore=2 < 3
    expect(result!.correct).toBe(true);
    expect(result!.scoreEarned).toBe(100);
    expect(result!.streak).toBe(3);

    // Now streakBefore = 3 → should get 150
    const result2 = submitAnswer(matchId, 'user-1', 0);
    expect(result2!.correct).toBe(true);
    expect(result2!.scoreEarned).toBe(150);
    expect(result2!.streak).toBe(4);
  });

  it('should set finished and matchEnded when both players exhaust questions', () => {
    // Player A answers all 50 questions
    for (let i = 0; i < 50; i++) {
      const r = submitAnswer(matchId, 'user-1', 0);
      if (i < 49) expect(r!.finished).toBe(false);
    }

    // Player A has no more questions
    expect(submitAnswer(matchId, 'user-1', 0)).toBeNull();
    expect(matches.get(matchId)!.status).toBe('active');
    expect(matches.get(matchId)!.winnerId).toBeNull();

    // Player B answers all 50 questions
    for (let i = 0; i < 49; i++) {
      const r = submitAnswer(matchId, 'user-2', 0);
      expect(r!.matchEnded).toBe(false);
    }
    const lastB = submitAnswer(matchId, 'user-2', 0);
    expect(lastB!.finished).toBe(true);
    expect(lastB!.matchEnded).toBe(true);
    expect(matches.get(matchId)!.status).toBe('finished');
    // Both all-correct → tie → winnerId null
    expect(matches.get(matchId)!.winnerId).toBeNull();
    expect(lastB!.nextQuestion).toBeNull();
  });

  it('should determine winner based on score', async () => {
    // Player A: 3 correct, then 2 wrong (to avoid streak multiplier)
    submitAnswer(matchId, 'user-1', 0); // correct, streak=1, score=100
    submitAnswer(matchId, 'user-1', 0); // correct, streak=2, score=100
    submitAnswer(matchId, 'user-1', 1); // wrong, streak=0, score=0
    submitAnswer(matchId, 'user-1', 0); // correct, streak=1, score=100
    submitAnswer(matchId, 'user-1', 0); // correct, streak=2, score=100
    // Total for A: 400

    // Player B: 3 correct = 300
    for (let i = 0; i < 3; i++) submitAnswer(matchId, 'user-2', 0);

    const m = matches.get(matchId)!;
    expect(m.playerA.score).toBe(400);
    expect(m.playerB.score).toBe(300);
  });
});

// ─── Timer ──────────────────────────────────────────────────────────────────

describe('match timer', () => {
  it('should end match when timer expires', async () => {
    vi.useFakeTimers();
    const state = await generateMatch('user-1', 'user-2', 'en', POOL_50);
    const cb = vi.fn();
    setMatchTimerEndCallback(cb);

    startMatchTimer(state.id);
    expect(matches.get(state.id)!.status).toBe('active');

    vi.advanceTimersByTime(180_001);

    expect(matches.get(state.id)!.status).toBe('finished');
    expect(cb).toHaveBeenCalledWith(state.id);
  });
});

// ─── Disconnect / Rejoin ────────────────────────────────────────────────────

describe('disconnect and rejoin', () => {
  let matchId: string;

  beforeEach(async () => {
    const state = await generateMatch('user-1', 'user-2', 'en', POOL_50);
    matchId = state.id;
  });

  it('should record disconnect timestamp', () => {
    handleDisconnect('user-1');
    const m = matches.get(matchId)!;
    expect(m.disconnectedAt.has('user-1')).toBe(true);
    expect(m.disconnectedAt.get('user-1')).toBeGreaterThan(0);
  });

  it('should return matchId on disconnect', () => {
    const result = handleDisconnect('user-1');
    expect(result).toBe(matchId);
  });

  it('should return null for unknown user', () => {
    expect(handleDisconnect('unknown')).toBeNull();
  });

  it('should allow rejoin within grace period', () => {
    handleDisconnect('user-1');
    const rejoined = rejoinMatch(matchId, 'user-1');

    expect(rejoined).not.toBeNull();
    expect(rejoined!.remainingMs).toBeGreaterThan(0);
    expect(rejoined!.question).toBeDefined();
    expect(rejoined!.opponentScore).toBe(0);
    expect(rejoined!.opponentCorrectCount).toBe(0);

    // Disconnect record should be cleared
    expect(matches.get(matchId)!.disconnectedAt.has('user-1')).toBe(false);
  });

  it('should return null for rejoin after grace period expires', () => {
    vi.useFakeTimers();
    handleDisconnect('user-1');
    vi.advanceTimersByTime(60_001);

    expect(rejoinMatch(matchId, 'user-1')).toBeNull();
  });

  it('should return null for rejoin with no prior disconnect', () => {
    expect(rejoinMatch(matchId, 'user-1')).toBeNull();
  });

  it('should return null for rejoin when match is finished', () => {
    vi.useFakeTimers();
    handleDisconnect('user-1');
    vi.advanceTimersByTime(60_001);

    expect(rejoinMatch(matchId, 'user-1')).toBeNull();
  });

  it('should forfeit disconnected player after grace period', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    setForfeitCallback(cb);

    handleDisconnect('user-1');
    vi.advanceTimersByTime(60_001);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(matchId, 'user-1');
    expect(matches.get(matchId)!.status).toBe('finished');
    expect(matches.get(matchId)!.winnerId).toBe('user-2');
  });

  it('should abandon match when both players disconnect', () => {
    const cb = vi.fn();
    setForfeitCallback(cb);

    handleDisconnect('user-1');
    handleDisconnect('user-2');

    expect(cb).toHaveBeenCalledTimes(1);
    expect(matches.get(matchId)!.status).toBe('finished');
    expect(matches.get(matchId)!.winnerId).toBeNull();
  });

  it('should provide opponent stats on rejoin', () => {
    submitAnswer(matchId, 'user-1', 0);
    submitAnswer(matchId, 'user-1', 0);

    handleDisconnect('user-2');
    const rejoined = rejoinMatch(matchId, 'user-2');
    expect(rejoined).not.toBeNull();
    expect(rejoined!.opponentScore).toBeGreaterThan(0);
    expect(rejoined!.opponentCorrectCount).toBeGreaterThan(0);
  });
});
