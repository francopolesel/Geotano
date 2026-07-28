// ---------------------------------------------------------------------------
// Geotano — 1v1 Multiplayer Match Service
// In-memory match state management, challenge lifecycle, race scoring,
// question pool generation, shared timer, and disconnect handling.
// ---------------------------------------------------------------------------

import { generateQuestionBatch, type GeneratedQuestion } from './quizEngine.js';
import crypto from 'crypto';

// ─── Constants ─────────────────────────────────────────────────────────────

const CHALLENGE_TIMEOUT_MS = 30_000;
const MATCH_DURATION_MS = 180_000;
const TIMER_INTERVAL_MS = 250;
const GRACE_PERIOD_MS = 60_000;
const BASE_SCORE = 100;
const STREAK_THRESHOLD = 3;
const STREAK_MULTIPLIER = 1.5;
const POOL_SIZE = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface PlayerMatchState {
  userId: string;
  score: number;
  correctCount: number;
  totalAnswered: number;
  streak: number;
  maxStreak: number;
  pos: number;
  finished: boolean;
}

export interface MatchState {
  id: string;
  playerA: PlayerMatchState;
  playerB: PlayerMatchState;
  questionPool: GeneratedQuestion[];
  playerAOrder: number[];
  playerBOrder: number[];
  timerStartedAt: number;
  timerDurationMs: number;
  status: 'pending' | 'active' | 'finished';
  disconnectedAt: Map<string, number>;
  graceTimer?: NodeJS.Timeout;
  winnerId: string | null;
}

interface Challenge {
  id: string;
  challengerId: string;
  receiverId: string;
  createdAt: number;
  timeout?: NodeJS.Timeout;
}

// ─── In-memory Maps ────────────────────────────────────────────────────────

/** @internal — exported for testing */
export const challenges = new Map<string, Challenge>();
/** @internal — exported for testing */
export const matches = new Map<string, MatchState>();
/** @internal — exported for testing */
export const userMatchMap = new Map<string, string>();

// ─── Callbacks (set by socket handler to avoid circular deps) ──────────────

let _onChallengeTimeout: ((challengeId: string, challengerId: string) => void) | null = null;
let _onForfeit: ((matchId: string, userId: string) => void) | null = null;
let _onMatchTimerEnd: ((matchId: string) => void) | null = null;
let _onMatchTimerTick: ((matchId: string, remainingMs: number) => void) | null = null;

export function setChallengeTimeoutCallback(cb: (challengeId: string, challengerId: string) => void): void {
  _onChallengeTimeout = cb;
}

export function setForfeitCallback(cb: (matchId: string, userId: string) => void): void {
  _onForfeit = cb;
}

export function setMatchTimerEndCallback(cb: (matchId: string) => void): void {
  _onMatchTimerEnd = cb;
}

export function setMatchTimerTickCallback(cb: (matchId: string, remainingMs: number) => void): void {
  _onMatchTimerTick = cb;
}

// ─── calculateRaceScore ────────────────────────────────────────────────────

/**
 * Calculate race score for a single answer.
 * - Correct: base 100 pts
 * - Streak 3+: 1.5× multiplier
 * - Wrong: 0 pts (no penalty)
 * - No time bonus, no mode multiplier
 */
export function calculateRaceScore(wasCorrect: boolean, streakBefore: number): number {
  if (!wasCorrect) return 0;
  let score = BASE_SCORE;
  if (streakBefore >= STREAK_THRESHOLD) {
    score = Math.floor(score * STREAK_MULTIPLIER);
  }
  return score;
}

// ─── Challenge Lifecycle ───────────────────────────────────────────────────

/**
 * Create a challenge with 30s timeout.
 * Returns the challenge ID.
 */
export function createChallenge(challengerId: string, receiverId: string): string {
  const id = crypto.randomUUID();
  const challenge: Challenge = {
    id,
    challengerId,
    receiverId,
    createdAt: Date.now(),
  };

  challenge.timeout = setTimeout(() => {
    challenges.delete(id);
    _onChallengeTimeout?.(id, challenge.challengerId);
  }, CHALLENGE_TIMEOUT_MS);

  challenges.set(id, challenge);
  return id;
}

/**
 * Accept a challenge — removes it from the map and clears its timeout.
 * Returns the challenge data or null if not found.
 */
export function acceptChallenge(challengeId: string): Challenge | null {
  const challenge = challenges.get(challengeId);
  if (!challenge) return null;
  clearTimeout(challenge.timeout);
  challenges.delete(challengeId);
  return challenge;
}

/**
 * Decline a challenge — removes it from the map and clears its timeout.
 * Returns true if the challenge existed.
 */
export function declineChallenge(challengeId: string): boolean {
  const challenge = challenges.get(challengeId);
  if (!challenge) return false;
  clearTimeout(challenge.timeout);
  challenges.delete(challengeId);
  return true;
}

/**
 * Cancel a challenge (same as decline but initiated by challenger).
 * Returns true if the challenge existed.
 */
export function cancelChallenge(challengeId: string): boolean {
  return declineChallenge(challengeId);
}

/**
 * Get challenge by ID (for validation before accepting).
 */
export function getChallenge(challengeId: string): Challenge | undefined {
  return challenges.get(challengeId);
}

// ─── generateMatch ─────────────────────────────────────────────────────────

/**
 * Generate a match with 50 pre-generated questions and per-player shuffle orders.
 * Creates and stores the MatchState, registers both players in userMatchMap.
 */
export async function generateMatch(
  playerAUid: string,
  playerBUid: string,
  lang: string = 'en',
  poolOverride?: GeneratedQuestion[],
): Promise<MatchState> {
  const pool = poolOverride ?? await generateQuestionBatch('free', 1, [], POOL_SIZE, lang);
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  const matchId = crypto.randomUUID();

  const makePlayer = (uid: string): PlayerMatchState => ({
    userId: uid,
    score: 0,
    correctCount: 0,
    totalAnswered: 0,
    streak: 0,
    maxStreak: 0,
    pos: 0,
    finished: false,
  });

  const state: MatchState = {
    id: matchId,
    playerA: makePlayer(playerAUid),
    playerB: makePlayer(playerBUid),
    questionPool: pool,
    playerAOrder: shuffleArray([...indices]),
    playerBOrder: shuffleArray([...indices]),
    timerStartedAt: Date.now(),
    timerDurationMs: MATCH_DURATION_MS,
    status: 'active',
    disconnectedAt: new Map(),
    winnerId: null,
  };

  matches.set(matchId, state);
  userMatchMap.set(playerAUid, matchId);
  userMatchMap.set(playerBUid, matchId);

  return state;
}

// ─── submitAnswer ──────────────────────────────────────────────────────────

export interface AnswerResult {
  correct: boolean;
  scoreEarned: number;
  streak: number;
  nextQuestion: GeneratedQuestion | null;
  finished: boolean;
  matchEnded: boolean;
}

/**
 * Process a player's answer submission.
 * Validates against the question pool using the player's shuffled order,
 * updates state, and detects match-end conditions.
 */
export function submitAnswer(
  matchId: string,
  userId: string,
  optionIndex: number,
): AnswerResult | null {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active') return null;

  const isA = match.playerA.userId === userId;
  const player = isA ? match.playerA : match.playerB;
  const order = isA ? match.playerAOrder : match.playerBOrder;

  if (player.finished || player.pos >= order.length) return null;

  const poolIndex = order[player.pos];
  const question = match.questionPool[poolIndex];
  if (!question) return null;

  const wasCorrect = optionIndex === question.correctIndex;
  const scoreEarned = calculateRaceScore(wasCorrect, player.streak);

  // Update player state
  player.score += scoreEarned;
  player.streak = wasCorrect ? player.streak + 1 : 0;
  player.maxStreak = Math.max(player.maxStreak, player.streak);
  player.totalAnswered += 1;
  if (wasCorrect) player.correctCount += 1;
  player.pos += 1;
  player.finished = player.pos >= order.length;

  // Check if match should end
  const bothFinished = match.playerA.finished && match.playerB.finished;
  if (bothFinished) {
    match.status = 'finished';
    match.winnerId = determineWinner(match);
  }

  const nextIdx = order[player.pos];
  const nextQuestion = (player.finished || bothFinished)
    ? null
    : (nextIdx !== undefined ? match.questionPool[nextIdx] : null);

  return {
    correct: wasCorrect,
    scoreEarned,
    streak: player.streak,
    nextQuestion: nextQuestion ?? null,
    finished: player.finished,
    matchEnded: bothFinished,
  };
}

function determineWinner(match: MatchState): string | null {
  if (match.playerA.score > match.playerB.score) return match.playerA.userId;
  if (match.playerB.score > match.playerA.score) return match.playerB.userId;
  return null; // tie
}

// ─── Timer ──────────────────────────────────────────────────────────────────

/** @internal */
export const matchTimers = new Map<string, NodeJS.Timeout>();

/**
 * Start the shared 3-minute match timer.
 * Fires every 250ms, derives elapsed from Date.now() to avoid drift.
 * When time expires, ends the match and fires the callback.
 */
export function startMatchTimer(matchId: string): void {
  if (matchTimers.has(matchId)) return;

  let tickCount = 0;
  const timer = setInterval(() => {
    const match = matches.get(matchId);
    if (!match || match.status === 'finished') {
      clearInterval(timer);
      matchTimers.delete(matchId);
      return;
    }

    const elapsed = Date.now() - match.timerStartedAt;
    tickCount++;
    // Emit tick every ~1s (every 4th iteration at 250ms interval)
    if (tickCount % 4 === 0) {
      const remainingMs = Math.max(0, match.timerDurationMs - elapsed);
      _onMatchTimerTick?.(matchId, remainingMs);
    }

    if (elapsed >= match.timerDurationMs) {
      clearInterval(timer);
      matchTimers.delete(matchId);
      endMatchByTimer(matchId);
    }
  }, TIMER_INTERVAL_MS);

  matchTimers.set(matchId, timer);
}

function endMatchByTimer(matchId: string): void {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active') return;

  match.status = 'finished';
  match.winnerId = determineWinner(match);
  clearGraceTimer(match);
  _onMatchTimerEnd?.(matchId);
}

function clearGraceTimer(match: MatchState): void {
  if (match.graceTimer) {
    clearTimeout(match.graceTimer);
    match.graceTimer = undefined;
  }
}

// ─── Disconnect / Rejoin ────────────────────────────────────────────────────

/**
 * Record a player's disconnect.
 * - If both players are disconnected → abandon immediately
 * - Otherwise starts a 60s grace timer
 * - On grace expiry → forfeit the disconnected player
 * Returns the matchId or null if user wasn't in an active match.
 */
export function handleDisconnect(userId: string): string | null {
  const matchId = userMatchMap.get(userId);
  if (!matchId) return null;

  const match = matches.get(matchId);
  if (!match || match.status !== 'active') return null;

  match.disconnectedAt.set(userId, Date.now());

  const otherId = match.playerA.userId === userId
    ? match.playerB.userId
    : match.playerA.userId;

  // Both disconnected → abandon immediately
  if (match.disconnectedAt.has(otherId)) {
    endMatchAbandoned(matchId);
    return matchId;
  }

  // Start grace timer (single timer per match)
  if (!match.graceTimer) {
    match.graceTimer = setTimeout(() => {
      const m = matches.get(matchId);
      if (!m || m.status !== 'active') return;

      const now = Date.now();
      for (const [uid, ts] of m.disconnectedAt) {
        if (now - ts >= GRACE_PERIOD_MS) {
          m.status = 'finished';
          m.winnerId = m.playerA.userId === uid
            ? m.playerB.userId
            : m.playerA.userId;
          clearGraceTimer(m);
          _onForfeit?.(matchId, uid);
          break;
        }
      }
    }, GRACE_PERIOD_MS);
  }

  return matchId;
}

function endMatchAbandoned(matchId: string): void {
  const match = matches.get(matchId);
  if (!match || match.status !== 'active') return;

  match.status = 'finished';
  match.winnerId = null; // abandoned = no winner
  clearGraceTimer(match);
  _onForfeit?.(matchId, '');
}

/**
 * Attempt to rejoin a match after disconnect.
 * Validates that the user is within the 60s grace window.
 * Returns current question, remaining time, and opponent stats, or null.
 */
export function rejoinMatch(matchId: string, userId: string): {
  question: GeneratedQuestion;
  remainingMs: number;
  opponentScore: number;
  opponentCorrectCount: number;
} | null {
  const match = matches.get(matchId);
  if (!match || match.status === 'finished') return null;

  const disconnectTs = match.disconnectedAt.get(userId);
  if (!disconnectTs) return null;
  if (Date.now() - disconnectTs > GRACE_PERIOD_MS) return null;

  // Clear disconnect record
  match.disconnectedAt.delete(userId);

  const isA = match.playerA.userId === userId;
  const player = isA ? match.playerA : match.playerB;
  const order = isA ? match.playerAOrder : match.playerBOrder;
  const opponent = isA ? match.playerB : match.playerA;

  const question = match.questionPool[order[player.pos]];
  if (!question) return null;

  const remainingMs = Math.max(0, match.timerDurationMs - (Date.now() - match.timerStartedAt));

  return {
    question,
    remainingMs,
    opponentScore: opponent.score,
    opponentCorrectCount: opponent.correctCount,
  };
}

// ─── Utility ────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Testing Helpers ────────────────────────────────────────────────────────

/** @internal — reset in-memory state for testing */
export function __resetForTesting(): void {
  // Clear grace timers on every match
  for (const [, m] of matches) clearGraceTimer(m);
  challenges.clear();
  matches.clear();
  userMatchMap.clear();
  for (const [, t] of matchTimers) clearInterval(t);
  matchTimers.clear();
  _onChallengeTimeout = null;
  _onForfeit = null;
  _onMatchTimerEnd = null;
  _onMatchTimerTick = null;
}
