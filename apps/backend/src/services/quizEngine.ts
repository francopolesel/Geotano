import crypto from 'crypto';
import { db } from '../db/index.js';
import {
  countries,
  gameSessions,
  gameAnswers,
  gameModes,
} from '../db/schema/index.js';
import { getModeConfig } from './gameModes.js';
import type { GameModeSlug, QuestionType } from '@geotano/shared';
import { eq, and, sql, notInArray } from 'drizzle-orm';

// ─── Constants ─────────────────────────────────────────────────────────────

const BASE_SCORE = 100;
const STREAK_THRESHOLD = 3;
const STREAK_MULTIPLIER = 1.5;
const OPTIONS_COUNT = 4;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  id: string;
  countryId: string;
  questionType: QuestionType;
  questionText: string;
  options: string[];
  correctAnswer: string;
  optionsCountryIds: string[];
  flagUrl?: string;
  timeLimitMs: number;
  questionNumber: number;
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  score: number;
  totalScore: number;
  livesRemaining: number;
  streak: number;
  result?: SessionResult;
  nextQuestion?: ClientQuestion;
}

export interface SessionResult {
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  streakMax: number;
  gameModeSlug: GameModeSlug;
  completedAt: string;
}

/** Question data cached server-side for authoritative scoring. */
interface CachedQuestion {
  correctCountryId: string;
  correctAnswer: string;
  questionType: QuestionType;
  dispatchTime: number;
  timeLimitMs: number;
  optionsCountryIds: string[];
  currentStreak: number;
}

/** Client-facing question — correct answer and internal IDs are stripped. */
export type ClientQuestion = Omit<GeneratedQuestion, 'correctAnswer' | 'optionsCountryIds'>;

export interface StartSessionResponse {
  sessionId: string;
  question: ClientQuestion;
}

// ─── In-memory Question Cache ───────────────────────────────────────────────
// Stores dispatched question data for server-authoritative answer validation.
// Reset on server restart — acceptable for MVP (per design decision).
const questionCache = new Map<string, CachedQuestion>();

// ─── Question Generation ───────────────────────────────────────────────────

function getAnswerText(country: any, questionType: QuestionType): string {
  switch (questionType) {
    case 'flag-to-country':
    case 'capital-to-country':
      return country.nameEn;
    case 'country-to-flag':
      return country.nameEn;
    case 'continent':
      return country.continent;
    default:
      return country.nameEn;
  }
}

function getQuestionText(country: any, questionType: QuestionType): string {
  switch (questionType) {
    case 'flag-to-country':
      return 'Which country does this flag belong to?';
    case 'capital-to-country':
      return `${country.capitalEn ?? 'Unknown'} is the capital of which country?`;
    case 'country-to-flag':
      return `Which flag belongs to ${country.nameEn}?`;
    case 'continent':
      return `${country.nameEn} is located in which continent?`;
    default:
      return 'What is the name of this country?';
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function pickRandomCountries(
  limit: number,
  excludeIds: string[] = [],
): Promise<any[]> {
  if (excludeIds.length > 0) {
    return db
      .select()
      .from(countries)
      .where(notInArray(countries.id, excludeIds))
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  }
  return db
    .select()
    .from(countries)
    .orderBy(sql`RANDOM()`)
    .limit(limit);
}

async function generateQuestion(
  modeSlug: GameModeSlug,
  questionNumber: number,
  excludeCountryIds: string[] = [],
): Promise<GeneratedQuestion> {
  const config = getModeConfig(modeSlug);

  const questionType: QuestionType =
    config.questionTypes[Math.floor(Math.random() * config.questionTypes.length)];

  // Pick the correct country (avoid repeats)
  let correctCountry: any;
  if (excludeCountryIds.length > 0) {
    const available = await pickRandomCountries(1, excludeCountryIds);
    if (available.length > 0) {
      correctCountry = available[0];
    }
  }
  if (!correctCountry) {
    const fallback = await pickRandomCountries(1);
    if (fallback.length === 0) {
      throw new Error('No countries available. Seed countries before starting a quiz.');
    }
    correctCountry = fallback[0];
  }

  // Pick distractor countries (distinct from correct)
  const distractorPool = await pickRandomCountries(
    OPTIONS_COUNT - 1,
    [correctCountry.id, ...excludeCountryIds],
  );

  // Generate option strings and track country IDs
  const correctText = getAnswerText(correctCountry, questionType);
  const wrongTexts = distractorPool.map((d: any) =>
    getAnswerText(d, questionType),
  );
  const wrongCountryIds = distractorPool.map((d: any) => d.id);

  // If we don't have enough distractors, get more without exclusion
  while (wrongTexts.length < OPTIONS_COUNT - 1) {
    const extra = await pickRandomCountries(1, [
      correctCountry.id,
      ...wrongCountryIds,
    ]);
    if (extra.length > 0) {
      wrongTexts.push(getAnswerText(extra[0], questionType));
      wrongCountryIds.push(extra[0].id);
    } else {
      break; // fallback — shouldn't happen with 200+ countries
    }
  }

  // Shuffle options + country IDs in parallel via index shuffling
  const allTexts = [correctText, ...wrongTexts];
  const allCountryIds = [correctCountry.id, ...wrongCountryIds];
  const indices = shuffleArray(allTexts.map((_, i) => i));
  const options = indices.map((i) => allTexts[i]);
  const optionsCountryIds = indices.map((i) => allCountryIds[i]);

  return {
    id: crypto.randomUUID(),
    countryId: correctCountry.id,
    questionType,
    questionText: getQuestionText(correctCountry, questionType),
    options,
    correctAnswer: correctText,
    flagUrl:
      questionType === 'flag-to-country' || questionType === 'country-to-flag'
        ? correctCountry.flagSvgUrl
        : undefined,
    timeLimitMs: config.timerSeconds * 1000,
    questionNumber,
    optionsCountryIds,
  };
}

// ─── Scoring ───────────────────────────────────────────────────────────────

export function calculateScore(
  wasCorrect: boolean,
  timeMs: number,
  timeLimitMs: number,
  streakBefore: number,
  multiplier: number,
): number {
  if (!wasCorrect) return 0;

  let score = BASE_SCORE;

  // Time bonus: up to 50% extra for fast answers
  const timeRatio = Math.max(0, 1 - timeMs / timeLimitMs);
  score += Math.floor(BASE_SCORE * 0.5 * timeRatio);

  // Streak bonus: 1.5x multiplier after 3 consecutive correct
  if (streakBefore >= STREAK_THRESHOLD) {
    score = Math.floor(score * STREAK_MULTIPLIER);
  }

  // Mode multiplier
  score = Math.floor(score * multiplier);

  return Math.max(0, score);
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Start a new quiz session and return the first question.
 */
export async function startSession(
  userId: string,
  modeSlug: GameModeSlug,
): Promise<StartSessionResponse> {
  const config = getModeConfig(modeSlug);

  // Ensure game mode record exists in DB
  let modeRecord = await db
    .select()
    .from(gameModes)
    .where(eq(gameModes.slug, modeSlug))
    .limit(1);

  let gameModeId: string;
  if (modeRecord.length > 0) {
    gameModeId = modeRecord[0].id;
  } else {
    const [inserted] = await db
      .insert(gameModes)
      .values({
        slug: modeSlug,
        nameEn: config.description,
        nameEs: config.description,
        timerSeconds: config.timerSeconds,
        lives: config.lives,
        multiplier: config.multiplier,
      })
      .returning();
    gameModeId = inserted.id;
  }

  // Create session
  await db.insert(gameSessions).values({
    userId,
    gameModeId,
    livesRemaining: config.lives,
  });

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.userId, userId), eq(gameSessions.isActive, true)))
    .orderBy(sql`${gameSessions.startedAt} DESC`)
    .limit(1);

  if (!session) {
    throw new Error('Failed to create session');
  }

  // Generate first question and cache it server-side
  const question = await generateQuestion(modeSlug, 1);

  questionCache.set(session.id, {
    correctCountryId: question.countryId,
    correctAnswer: question.correctAnswer,
    questionType: question.questionType,
    dispatchTime: Date.now(),
    timeLimitMs: question.timeLimitMs,
    optionsCountryIds: question.optionsCountryIds,
    currentStreak: 0,
  });

  // Return sessionId + question WITHOUT the correct answer / internal IDs
  const { correctAnswer: _, optionsCountryIds: __, ...clientQuestion } = question;

  return { sessionId: session.id, question: clientQuestion };
}

/**
 * Submit an answer for the current question and get the result + next question.
 */
export async function submitAnswer(
  sessionId: string,
  userId: string,
  answer: string,
  timeMs: number,
): Promise<AnswerResult> {
  // ── Look up server-side cache for authoritatve validation ─────────────
  const cached = questionCache.get(sessionId);
  if (!cached) {
    throw new Error('Session not found or expired. Please start a new game.');
  }

  const [session] = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, sessionId),
        eq(gameSessions.userId, userId),
        eq(gameSessions.isActive, true),
      ),
    )
    .limit(1);

  if (!session) {
    questionCache.delete(sessionId);
    throw new Error('Session not found or already completed');
  }

  const [modeRecord] = await db
    .select()
    .from(gameModes)
    .where(eq(gameModes.id, session.gameModeId))
    .limit(1);

  if (!modeRecord) {
    throw new Error('Game mode not found');
  }

  const config = getModeConfig(modeRecord.slug as GameModeSlug);

  // ── Timer enforcement ──────────────────────────────────────────────────
  // If the client reports time exceeding the limit + 2s grace, treat as wrong
  const GRACE_MS = 2000;
  const timeExceeded = timeMs > cached.timeLimitMs + GRACE_MS;

  // ── Evaluate answer (server-authoritative — compared against cache) ────
  const wasCorrect =
    !timeExceeded &&
    answer.trim().toLowerCase() === cached.correctAnswer.trim().toLowerCase();

  // ── Streak tracking (C4 fix: use current streak, not all-time max) ─────
  const streakBefore = cached.currentStreak;
  const newStreak = wasCorrect ? streakBefore + 1 : 0;

  // Update streak in cache for next question
  cached.currentStreak = newStreak;

  // ── Calculate score ─────────────────────────────────────────────────────
  const scoreEarned = calculateScore(
    wasCorrect,
    timeMs,
    config.timerSeconds * 1000,
    streakBefore,
    config.multiplier,
  );

  // ── Update lives ────────────────────────────────────────────────────────
  const newLives = wasCorrect
    ? session.livesRemaining
    : session.livesRemaining - 1;
  const gameOver = newLives <= 0;

  const [updatedSession] = await db
    .update(gameSessions)
    .set({
      score: session.score + scoreEarned,
      correctCount: session.correctCount + (wasCorrect ? 1 : 0),
      totalQuestions: session.totalQuestions + 1,
      streakMax: Math.max(session.streakMax, newStreak),
      livesRemaining: Math.max(0, newLives),
      isActive: !gameOver,
      completedAt: gameOver ? new Date() : undefined,
    })
    .where(eq(gameSessions.id, sessionId))
    .returning();

  // ── Record answer (C3 fix: use actual UUIDs from cache) ────────────────
  await db.insert(gameAnswers).values({
    sessionId,
    countryId: cached.correctCountryId,
    questionType: cached.questionType,
    wasCorrect,
    timeTakenMs: Math.round(timeMs),
    optionsShown: cached.optionsCountryIds,
    streakAtQuestion: newStreak,
  });

  const result: AnswerResult = {
    correct: wasCorrect,
    correctAnswer: cached.correctAnswer,
    score: scoreEarned,
    totalScore: updatedSession.score,
    livesRemaining: Math.max(0, newLives),
    streak: newStreak,
  };

  if (gameOver) {
    questionCache.delete(sessionId);

    result.result = {
      totalScore: updatedSession.score,
      correctCount: updatedSession.correctCount,
      totalQuestions: updatedSession.totalQuestions,
      streakMax: updatedSession.streakMax,
      gameModeSlug: modeRecord.slug as GameModeSlug,
      completedAt: updatedSession.completedAt!.toISOString(),
    };
    return result;
  }

  // ── Generate next question ─────────────────────────────────────────────
  const prevAnswers = await db
    .select()
    .from(gameAnswers)
    .where(eq(gameAnswers.sessionId, sessionId));

  const usedCountryIds = prevAnswers
    .filter((a) => a.countryId)
    .map((a) => a.countryId);

  const nextQuestion = await generateQuestion(
    modeRecord.slug as GameModeSlug,
    updatedSession.totalQuestions + 1,
    usedCountryIds,
  );

  // ── Cache the next question for authoritatve validation ────────────────
  questionCache.set(sessionId, {
    correctCountryId: nextQuestion.countryId,
    correctAnswer: nextQuestion.correctAnswer,
    questionType: nextQuestion.questionType,
    dispatchTime: Date.now(),
    timeLimitMs: nextQuestion.timeLimitMs,
    optionsCountryIds: nextQuestion.optionsCountryIds,
    currentStreak: newStreak,
  });

  // Strip sensitive fields before returning to client
  const {
    correctAnswer: _corr,
    optionsCountryIds: _opts,
    ...clientNext
  } = nextQuestion;

  result.nextQuestion = clientNext;
  return result;
}
