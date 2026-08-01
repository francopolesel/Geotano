// ---------------------------------------------------------------------------
// Geotano — Async Multiplayer Match Service
// DB-backed challenge lifecycle, match state, per-player scoring.
// Replaces the previous in-memory real-time model.
// ---------------------------------------------------------------------------

import crypto from 'crypto';
import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { matchChallenges, matchGames, matchAnswers, users } from '../db/schema/index.js';
import { generateMatchQuestionPool } from './quizEngine.js';
import type { GeneratedQuestion } from './quizEngine.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const BASE_SCORE = 100;
const WRONG_PENALTY = -50;
const STREAK_THRESHOLD = 3;
const STREAK_MULTIPLIER = 1.5;
const POOL_SIZE = 120;

// ─── Scoring ────────────────────────────────────────────────────────────────

export function calculateRaceScore(wasCorrect: boolean, streakBefore: number): number {
  if (!wasCorrect) return WRONG_PENALTY;
  let score = BASE_SCORE;
  if (streakBefore >= STREAK_THRESHOLD) {
    score = Math.floor(score * STREAK_MULTIPLIER);
  }
  return score;
}

function determineWinner(
  p1Score: number,
  p2Score: number,
): string | null {
  if (p1Score > p2Score) return 'player1';
  if (p2Score > p1Score) return 'player2';
  return null;
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Challenge Lifecycle ────────────────────────────────────────────────────

export async function createChallenge(
  challengerId: string,
  receiverId: string,
  gameModeSlug: string,
  durationMinutes: number = 3,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(matchChallenges).values({
    id,
    challengerId,
    receiverId,
    gameModeSlug,
    durationMinutes,
    status: 'pending',
  });
  return id;
}

export async function acceptChallenge(
  challengeId: string,
  userId: string,
): Promise<{ challenge: typeof matchChallenges.$inferSelect; matchId: string } | null> {
  const [challenge] = await db
    .select()
    .from(matchChallenges)
    .where(eq(matchChallenges.id, challengeId))
    .limit(1);

  if (!challenge || challenge.receiverId !== userId || challenge.status !== 'pending') {
    return null;
  }

  // Generate questions
      const pool = await generateMatchQuestionPool(
        challenge.gameModeSlug as any,
        POOL_SIZE,
      );

  const indices = Array.from({ length: pool.length }, (_, i) => i);
  const sharedOrder = shuffleArray([...indices]);

  const matchId = crypto.randomUUID();
  const durationMinutes = challenge.durationMinutes ?? 3;

  await db.insert(matchGames).values({
    id: matchId,
    challengeId: challenge.id,
    player1Id: challenge.challengerId,
    player2Id: challenge.receiverId,
    gameModeSlug: challenge.gameModeSlug,
    durationMinutes,
    status: 'pending',
    questionPool: pool,
    playerAOrder: sharedOrder,
    playerBOrder: sharedOrder,
  });

  // Update challenge status
  await db
    .update(matchChallenges)
    .set({ status: 'accepted' })
    .where(eq(matchChallenges.id, challengeId));

  return { challenge, matchId };
}

export async function declineChallenge(
  challengeId: string,
  userId: string,
): Promise<boolean> {
  const [challenge] = await db
    .select()
    .from(matchChallenges)
    .where(eq(matchChallenges.id, challengeId))
    .limit(1);

  if (!challenge || challenge.receiverId !== userId || challenge.status !== 'pending') {
    return false;
  }

  await db
    .update(matchChallenges)
    .set({ status: 'declined' })
    .where(eq(matchChallenges.id, challengeId));

  return true;
}

// ─── Match State ────────────────────────────────────────────────────────────

/** Internal: returns full match row including questionPool (for gameplay) */
async function getFullMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(matchGames)
    .where(eq(matchGames.id, matchId))
    .limit(1);
  return match ?? null;
}

export async function getMatchState(matchId: string): Promise<MatchStateResponse | null> {
  const match = await getFullMatch(matchId);
  if (!match) return null;

  // Fetch player profiles for opponent display
  const [player1] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, match.player1Id))
    .limit(1);

  const [player2] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, match.player2Id))
    .limit(1);

  return {
    id: match.id,
    challengeId: match.challengeId,
    player1Id: match.player1Id,
    player2Id: match.player2Id,
    gameModeSlug: match.gameModeSlug,
    durationMinutes: match.durationMinutes ?? 3,
    player1Score: match.player1Score,
    player2Score: match.player2Score,
    player1Finished: match.player1Finished,
    player2Finished: match.player2Finished,
    player1StartedAt: match.player1StartedAt,
    player2StartedAt: match.player2StartedAt,
    winnerId: match.winnerId,
    status: match.status,
    createdAt: match.createdAt,
    player1: player1 ?? null,
    player2: player2 ?? null,
  };
}

export interface MatchStateResponse {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  gameModeSlug: string;
  durationMinutes: number;
  player1Score: number;
  player2Score: number;
  player1Finished: boolean;
  player2Finished: boolean;
  player1StartedAt: Date | null;
  player2StartedAt: Date | null;
  winnerId: string | null;
  status: string;
  createdAt: Date;
  player1: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
  player2: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

export async function getPlayerMatchHistory(userId: string) {
  return db
    .select()
    .from(matchGames)
    .where(
      or(
        eq(matchGames.player1Id, userId),
        eq(matchGames.player2Id, userId),
      ),
    )
    .orderBy(sql`${matchGames.createdAt} DESC`);
}

// ─── Match Gameplay ─────────────────────────────────────────────────────────

export async function startMatchPlay(
  matchId: string,
  userId: string,
): Promise<{
  question: GeneratedQuestion;
  remainingMs: number;
} | null> {
  const match = await getFullMatch(matchId);
  if (!match) return null;

  const isPlayer1 = match.player1Id === userId;
  const order = isPlayer1 ? match.playerAOrder : match.playerBOrder;
  const orderArr = order as number[];

  // Get how many answers the player has submitted
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(matchAnswers)
    .where(
      and(eq(matchAnswers.matchId, matchId), eq(matchAnswers.userId, userId)),
    );

  const answeredCount = Number(countResult?.count ?? 0);
  const currentIdx = orderArr[answeredCount];
  if (currentIdx === undefined) return null; // Already finished

  const pool = match.questionPool as GeneratedQuestion[];

  // Set startedAt if first play
  const startedAtCol = isPlayer1 ? matchGames.player1StartedAt : matchGames.player2StartedAt;
  if (!match[isPlayer1 ? 'player1StartedAt' : 'player2StartedAt']) {
    await db
      .update(matchGames)
      .set(isPlayer1 ? { player1StartedAt: sql`NOW()` } : { player2StartedAt: sql`NOW()` })
      .where(eq(matchGames.id, matchId));
  }

  // Also ensure status is in_progress
  if (match.status === 'pending') {
    await db
      .update(matchGames)
      .set({ status: 'in_progress' })
      .where(eq(matchGames.id, matchId));
  }

  const durationMs = (match.durationMinutes ?? 3) * 60 * 1000;

  const question = pool[currentIdx];
  if (!question) return null;

  const startedAt = isPlayer1
    ? (match.player1StartedAt ?? new Date())
    : (match.player2StartedAt ?? new Date());
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const remainingMs = Math.max(0, durationMs - elapsed);

  return { question, remainingMs };
}

// ─── Time Expiry / Early Finish ─────────────────────────────────────────────

/**
 * Marks one player as finished without recording an answer (e.g. time ran out).
 * When both players are finished, completes the match and computes the winner
 * from the current scores.
 */
async function markPlayerFinished(
  matchId: string,
  isPlayer1: boolean,
  match: {
    player1Id: string;
    player2Id: string;
    player1Score: number;
    player2Score: number;
    player1Finished: boolean;
    player2Finished: boolean;
  },
): Promise<{ matchEnded: boolean; winnerId: string | null }> {
  const finishedCol = isPlayer1 ? 'player1Finished' : 'player2Finished';
  const otherFinished = isPlayer1 ? match.player2Finished : match.player1Finished;

  await db
    .update(matchGames)
    .set({ [finishedCol]: true })
    .where(eq(matchGames.id, matchId));

  if (!otherFinished) {
    return { matchEnded: false, winnerId: null };
  }

  const winner = determineWinner(match.player1Score, match.player2Score);
  const winnerUserId = winner === 'player1' ? match.player1Id
    : winner === 'player2' ? match.player2Id
    : null;

  await db
    .update(matchGames)
    .set({ status: 'completed', winnerId: winnerUserId })
    .where(eq(matchGames.id, matchId));

  return { matchEnded: true, winnerId: winnerUserId };
}

/**
 * Marks the player as finished when their time ran out.
 * Idempotent: calling again after the player already finished is a no-op.
 */
export async function finishMatch(
  matchId: string,
  userId: string,
): Promise<{ finished: boolean; matchEnded: boolean; winnerId: string | null } | null> {
  const match = await getFullMatch(matchId);
  if (!match || match.status === 'completed') return null;

  const isPlayer1 = match.player1Id === userId;
  if (!isPlayer1 && match.player2Id !== userId) return null;

  const alreadyFinished = isPlayer1 ? match.player1Finished : match.player2Finished;
  if (alreadyFinished) {
    return {
      finished: true,
      matchEnded: match.player1Finished && match.player2Finished,
      winnerId: match.winnerId,
    };
  }

  const result = await markPlayerFinished(matchId, isPlayer1, match);
  return { finished: true, ...result };
}

export async function submitAnswer(
  matchId: string,
  userId: string,
  optionIndex: number,
): Promise<{
  correct: boolean;
  scoreEarned: number;
  streak: number;
  nextQuestion: GeneratedQuestion | null;
  finished: boolean;
  matchEnded: boolean;
} | null> {
  const match = await getFullMatch(matchId);
  if (!match || match.status === 'completed') return null;

  const isPlayer1 = match.player1Id === userId;
  const order = (isPlayer1 ? match.playerAOrder : match.playerBOrder) as number[];

  // ── Time expiry guard: no answers accepted after the match duration ──
  const startedAt = isPlayer1 ? match.player1StartedAt : match.player2StartedAt;
  if (startedAt) {
    const durationMs = (match.durationMinutes ?? 3) * 60 * 1000;
    if (Date.now() - new Date(startedAt).getTime() > durationMs) {
      const result = await markPlayerFinished(matchId, isPlayer1, match);
      return {
        correct: false,
        scoreEarned: 0,
        streak: 0,
        nextQuestion: null,
        finished: true,
        matchEnded: result.matchEnded,
      };
    }
  }

  const pool = match.questionPool as GeneratedQuestion[];

  // Lightweight: only fetch the streak column (less data than full rows)
  const prevAnswers = await db
    .select({ streakAtAnswer: matchAnswers.streakAtAnswer })
    .from(matchAnswers)
    .where(
      and(eq(matchAnswers.matchId, matchId), eq(matchAnswers.userId, userId)),
    )
    .orderBy(matchAnswers.createdAt);

  const answeredCount = prevAnswers.length;
  const poolIndex = order[answeredCount];
  if (poolIndex === undefined) return null; // Already finished

  const question = pool[poolIndex];
  if (!question) return null;

  const wasCorrect = optionIndex === question.correctIndex;
  const lastStreak = answeredCount > 0 ? prevAnswers[answeredCount - 1].streakAtAnswer : 0;
  const streakBefore = wasCorrect ? lastStreak : 0;
  const scoreEarned = calculateRaceScore(wasCorrect, streakBefore);
  const newStreak = wasCorrect ? lastStreak + 1 : 0;

  // Insert answer
  await db.insert(matchAnswers).values({
    matchId,
    userId,
    questionIndex: poolIndex,
    optionIndex,
    wasCorrect,
    scoreEarned,
    streakAtAnswer: newStreak,
  });

  const finished = answeredCount + 1 >= order.length;
  const currentScore = isPlayer1 ? match.player1Score : match.player2Score;
  const newScore = currentScore + scoreEarned;

  // Update match score + finished flag (single UPDATE)
  await db
    .update(matchGames)
    .set({
      [isPlayer1 ? 'player1Score' : 'player2Score']: newScore,
      [isPlayer1 ? 'player1Finished' : 'player2Finished']: finished,
    })
    .where(eq(matchGames.id, matchId));

  // Determine if both finished — uses data already fetched (no extra query)
  const otherFinished = isPlayer1 ? match.player2Finished : match.player1Finished;
  const bothFinished = finished && otherFinished;
  let matchEnded = false;

  if (bothFinished) {
    const otherScore = isPlayer1 ? match.player2Score : match.player1Score;
    const winner = determineWinner(newScore, otherScore);
    const winnerUserId = winner === 'player1' ? match.player1Id
      : winner === 'player2' ? match.player2Id
      : null;
    await db
      .update(matchGames)
      .set({ status: 'completed', winnerId: winnerUserId })
      .where(eq(matchGames.id, matchId));
    matchEnded = true;
  }

  // Get next question
  const nextPoolIndex = finished ? undefined : order[answeredCount + 1];
  const nextQuestion = (finished || matchEnded) ? null : (nextPoolIndex !== undefined ? pool[nextPoolIndex] : null);

  return {
    correct: wasCorrect,
    scoreEarned,
    streak: newStreak,
    nextQuestion: nextQuestion ?? null,
    finished,
    matchEnded,
  };
}
