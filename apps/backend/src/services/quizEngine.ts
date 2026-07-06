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

/** Continent name translations (DB stores only English). */
const CONTINENT_TRANSLATIONS: Record<string, string> = {
  Africa: 'África',
  Antarctica: 'Antártida',
  Asia: 'Asia',
  Europe: 'Europa',
  'North America': 'Norteamérica',
  Oceania: 'Oceanía',
  'South America': 'Sudamérica',
};

/** How many questions to pre-generate at session start. */
const POOL_INITIAL_SIZE = 5;
/** When remaining pool drops below this, trigger background refill. */
const POOL_REFILL_THRESHOLD = 2;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  id: string;
  countryId: string;
  questionType: QuestionType;
  questionText: string;
  options: string[];
  correctIndex: number;
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

/** Client-facing question — correct answer text and internal IDs are stripped, but correctIndex is included for immediate UI feedback. */
export type ClientQuestion = Omit<GeneratedQuestion, 'correctAnswer' | 'optionsCountryIds'>;

export interface StartSessionResponse {
  sessionId: string;
  question: ClientQuestion;
}

// ─── In-memory State ────────────────────────────────────────────────────────
// Stores dispatched question data for server-authoritative answer validation.
// Reset on server restart — acceptable for MVP (per design decision).
const questionCache = new Map<string, CachedQuestion>();

/**
 * Pool of pre-generated questions keyed by sessionId.
 * Questions are generated in batches at session start and refilled in the
 * background as the user answers, so the next question is always ready
 * without a blocking DB query.
 */
const questionPool = new Map<string, GeneratedQuestion[]>();

// ─── Question Generation ───────────────────────────────────────────────────

export function getAnswerText(country: any, questionType: QuestionType, lang: string = 'en'): string {
  const useEn = lang !== 'es';
  switch (questionType) {
    case 'flag-to-country':
    case 'capital-to-country':
      return useEn ? country.nameEn : country.nameEs;
    case 'country-to-flag':
      return useEn ? country.nameEn : country.nameEs;
    case 'continent': {
      const raw = country.continent;
      return useEn ? raw : (CONTINENT_TRANSLATIONS[raw] ?? raw);
    }
    default:
      return useEn ? country.nameEn : country.nameEs;
  }
}

export function getQuestionText(country: any, questionType: QuestionType, lang: string = 'en'): string {
  const useEn = lang !== 'es';
  switch (questionType) {
    case 'flag-to-country':
      return useEn
        ? 'Which country does this flag belong to?'
        : '¿A qué país pertenece esta bandera?';
    case 'capital-to-country': {
      const capital = useEn ? (country.capitalEn ?? 'Unknown') : (country.capitalEs ?? 'Desconocida');
      return useEn
        ? `${capital} is the capital of which country?`
        : `${capital} es la capital de qué país?`;
    }
    case 'country-to-flag':
      // Same as flag-to-country: show one flag, options are country names.
      // The flagUrl is already set in the question response for rendering.
      return useEn
        ? 'Which country does this flag belong to?'
        : '¿A qué país pertenece esta bandera?';
    case 'continent': {
      const name = useEn ? country.nameEn : country.nameEs;
      return useEn
        ? `${name} is located in which continent?`
        : `${name} está ubicado en qué continente?`;
    }
    default:
      return useEn
        ? 'What is the name of this country?'
        : '¿Cuál es el nombre de este país?';
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
  lang: string = 'en',
): Promise<GeneratedQuestion> {
  const config = getModeConfig(modeSlug);

  const questionType: QuestionType =
    config.questionTypes[Math.floor(Math.random() * config.questionTypes.length)];

  // Helper: check if a country has the required data for this question type
  const isValidCountry = (c: any): boolean => {
    if (questionType === 'capital-to-country') {
      const capital = lang !== 'es' ? c.capitalEn : c.capitalEs;
      return !!capital;
    }
    return true;
  };

  // Pick the correct country (avoid repeats + validate for question type)
  let correctCountry: any;
  let pickAttempts = 0;
  while (!correctCountry && pickAttempts < 30) {
    pickAttempts++;
    let available: any[];
    if (excludeCountryIds.length > 0) {
      available = await pickRandomCountries(1, excludeCountryIds);
    } else {
      available = await pickRandomCountries(1);
    }
    if (available.length === 0) break;
    const candidate = available[0];
    if (isValidCountry(candidate)) {
      correctCountry = candidate;
    } else {
      excludeCountryIds.push(candidate.id); // skip for next attempt
    }
  }
  if (!correctCountry) {
    throw new Error('No countries available. Seed countries before starting a quiz.');
  }

  // Pick distractor countries (distinct from correct)
  const distractorPool = await pickRandomCountries(
    OPTIONS_COUNT - 1,
    [correctCountry.id, ...excludeCountryIds],
  );

  // Generate option strings and track country IDs
  const correctText = getAnswerText(correctCountry, questionType, lang);
  const seenTexts = new Set<string>([correctText]);
  const wrongTexts: string[] = [];
  const wrongCountryIds: string[] = [];

  for (const d of distractorPool) {
    if (!isValidCountry(d)) continue;
    const text = getAnswerText(d, questionType, lang);
    if (!seenTexts.has(text) && wrongTexts.length < OPTIONS_COUNT - 1) {
      seenTexts.add(text);
      wrongTexts.push(text);
      wrongCountryIds.push(d.id);
    }
  }

  // Keep fetching more distractors until we have enough unique wrong answers
  while (wrongTexts.length < OPTIONS_COUNT - 1) {
    const extra = await pickRandomCountries(OPTIONS_COUNT - 1 - wrongTexts.length, [
      correctCountry.id,
      ...wrongCountryIds,
    ]);
    for (const e of extra) {
      if (!isValidCountry(e)) continue;
      const text = getAnswerText(e, questionType, lang);
      if (!seenTexts.has(text) && wrongTexts.length < OPTIONS_COUNT - 1) {
        seenTexts.add(text);
        wrongTexts.push(text);
        wrongCountryIds.push(e.id);
      }
    }
    if (extra.length === 0) break; // fallback — shouldn't happen with 200+ countries
  }

  // Shuffle options + country IDs in parallel via index shuffling
  const allTexts = [correctText, ...wrongTexts];
  const allCountryIds = [correctCountry.id, ...wrongCountryIds];
  const indices = shuffleArray(allTexts.map((_, i) => i));
  const options = indices.map((i) => allTexts[i]);
  const optionsCountryIds = indices.map((i) => allCountryIds[i]);

  const correctIndex = indices.indexOf(0); // index 0 was the correct answer before shuffle

  return {
    id: crypto.randomUUID(),
    countryId: correctCountry.id,
    questionType,
    questionText: getQuestionText(correctCountry, questionType, lang),
    options,
    correctIndex,
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

/**
 * Generate a batch of questions sequentially, each excluding countries
 * from all previous questions in the batch (plus the global exclude set).
 */
async function generateQuestionBatch(
  modeSlug: GameModeSlug,
  startNumber: number,
  excludeCountryIds: string[],
  count: number,
  lang: string = 'en',
): Promise<GeneratedQuestion[]> {
  const batch: GeneratedQuestion[] = [];
  const cumulativeExclude = [...excludeCountryIds];

  for (let i = 0; i < count; i++) {
    const q = await generateQuestion(modeSlug, startNumber + i, cumulativeExclude, lang);
    batch.push(q);
    cumulativeExclude.push(q.countryId);
  }

  return batch;
}

/**
 * Refill the question pool in the background.
 * Queries the DB for the latest answered countries to avoid reusing them.
 */
async function refillPool(sessionId: string, modeSlug: GameModeSlug, lang: string = 'en'): Promise<void> {
  try {
    // Fetch latest used countries from DB to avoid stale exclude lists
    const prevAnswers = await db
      .select()
      .from(gameAnswers)
      .where(eq(gameAnswers.sessionId, sessionId));

    const usedCountryIds = prevAnswers
      .filter((a) => a.countryId)
      .map((a) => a.countryId);

    // Calculate where to start numbering based on what's already in the pool
    const pool = questionPool.get(sessionId) ?? [];
    const existingStartNumber = pool.length > 0
      ? pool[pool.length - 1].questionNumber + 1
      : 1;

    // CRITICAL: also exclude countries from PENDING pool questions,
    // not just already-answered ones. Otherwise the refill batch
    // can generate the same country again while it's still in the queue.
    const poolCountryIds = pool
      .map((q) => q.countryId)
      .filter(Boolean);
    const allExcludeIds = [...new Set([...usedCountryIds, ...poolCountryIds])];

    const refill = await generateQuestionBatch(
      modeSlug,
      existingStartNumber,
      allExcludeIds,
      POOL_INITIAL_SIZE,
      lang,
    );

    questionPool.set(sessionId, [...pool, ...refill]);
  } catch (err) {
    console.error('[refillPool] Failed to refill question pool:', err);
  }
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
 * Pre-generates a pool of questions so subsequent answers are instant.
 */
export async function startSession(
  userId: string,
  modeSlug: GameModeSlug,
  lang: string = 'en',
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

  // ── Generate initial question pool ────────────────────────────────────
  // Generate POOL_INITIAL_SIZE questions upfront. Q1 goes to the client,
  // the rest are cached for instant retrieval on subsequent answers.
  const batch = await generateQuestionBatch(modeSlug, 1, [], POOL_INITIAL_SIZE, lang);

  if (batch.length === 0) {
    throw new Error('No countries available. Seed countries before starting a quiz.');
  }

  const firstQuestion = batch[0];
  const poolQuestions = batch.slice(1);

  // Cache Q1 for current answer validation
  questionCache.set(session.id, {
    correctCountryId: firstQuestion.countryId,
    correctAnswer: firstQuestion.correctAnswer,
    questionType: firstQuestion.questionType,
    dispatchTime: Date.now(),
    timeLimitMs: firstQuestion.timeLimitMs,
    optionsCountryIds: firstQuestion.optionsCountryIds,
    currentStreak: 0,
  });

  // Store Q2+ for instant retrieval
  questionPool.set(session.id, poolQuestions);

  // Return Q1 to client (without correct answer / internal IDs)
  const { correctAnswer: _, optionsCountryIds: __, ...clientQuestion } = firstQuestion;

  return { sessionId: session.id, question: clientQuestion };
}

/**
 * Submit an answer for the current question and get the result + next question.
 * The next question is returned from the pre-generated pool — no blocking DB query.
 */
export async function submitAnswer(
  sessionId: string,
  userId: string,
  answer: string,
  timeMs: number,
  lang: string = 'en',
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
  const GRACE_MS = 2000;
  const timeExceeded = timeMs > cached.timeLimitMs + GRACE_MS;

  // ── Evaluate answer (server-authoritative — compared against cache) ────
  const answerMatch =
    answer.trim().toLowerCase() === cached.correctAnswer.trim().toLowerCase();
  const wasCorrect = !timeExceeded && answerMatch;

  // ── Streak tracking ────────────────────────────────────────────────────
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

  // ── Record answer ──────────────────────────────────────────────────────
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
    questionPool.delete(sessionId);

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

  // ── Pop next question from pre-generated pool ──────────────────────────
  const pool = questionPool.get(sessionId);
  let nextQuestion: GeneratedQuestion | null = null;

  if (pool && pool.length > 0) {
    nextQuestion = pool.shift()!;

    // Update questionNumbers to reflect actual progress
    const actualQuestionNumber = updatedSession.totalQuestions + 1;
    if (nextQuestion.questionNumber !== actualQuestionNumber) {
      nextQuestion = { ...nextQuestion, questionNumber: actualQuestionNumber };
    }
  }

  if (!nextQuestion) {
    // Fallback: generate synchronously (slow path — DB query)
    const prevAnswers = await db
      .select()
      .from(gameAnswers)
      .where(eq(gameAnswers.sessionId, sessionId));

    const usedCountryIds = prevAnswers
      .filter((a) => a.countryId)
      .map((a) => a.countryId);

    nextQuestion = await generateQuestion(
      modeRecord.slug as GameModeSlug,
      updatedSession.totalQuestions + 1,
      usedCountryIds,
      lang,
    );
  }

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

  // ── Background pool refill ────────────────────────────────────────────
  // If pool is running low, top it up asynchronously
  const currentPool = questionPool.get(sessionId);
  if (!currentPool || currentPool.length < POOL_REFILL_THRESHOLD) {
    // Fire-and-forget background refill
    refillPool(sessionId, modeRecord.slug as GameModeSlug, lang).catch((err) =>
      console.error('[quizEngine] Background pool refill failed:', err),
    );
  }

  // Strip sensitive fields before returning to client
  const {
    correctAnswer: _corr,
    optionsCountryIds: _opts,
    ...clientNext
  } = nextQuestion;

  result.nextQuestion = clientNext;
  return result;
}
