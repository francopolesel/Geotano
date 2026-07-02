// ---------------------------------------------------------------------------
// Geotano — Shared types used across frontend and backend
// ---------------------------------------------------------------------------

/** Unique identifier (UUID v4). */
export type EntityId = string;

/** ISO 639-1 language code. */
export type Locale = 'en' | 'es';

// ---------------------------------------------------------------------------
// User & Auth
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: EntityId;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  language: Locale;
  joinCode: string;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export interface Country {
  id: EntityId;
  alpha2: string;
  alpha3: string;
  nameEn: string;
  nameEs: string;
  capitalEn?: string;
  capitalEs?: string;
  region: string;
  subregion?: string;
  continent: string;
  flagSvgUrl: string;
  flagPngUrl: string;
  population?: number;
  areaKm2?: number;
  timezones?: string[];
  borders?: string[];
}

// ---------------------------------------------------------------------------
// Game Modes
// ---------------------------------------------------------------------------

export type GameModeSlug =
  | 'flag-guess'
  | 'capital-guess'
  | 'country-by-flag'
  | 'continent'
  | 'free';

export interface GameMode {
  id: EntityId;
  slug: GameModeSlug;
  nameEn: string;
  nameEs: string;
  descriptionEn?: string;
  descriptionEs?: string;
  timerSeconds: number;
  lives: number;
  multiplier: number;
}

// ---------------------------------------------------------------------------
// Quiz Questions
// ---------------------------------------------------------------------------

export type QuestionType =
  | 'flag-to-country'
  | 'capital-to-country'
  | 'country-to-flag'
  | 'continent'
  | 'free';

export interface QuizQuestion {
  id: EntityId;
  countryId: EntityId;
  questionType: QuestionType;
  /** The question text (localized on the backend). */
  questionText: string;
  /** Four answer options. */
  options: string[];
  /** Index of the correct option in the options array (0–3). */
  correctIndex: number;
  /** URL to flag image — only relevant for flag-related modes. */
  flagUrl?: string;
  /** Time limit in milliseconds. */
  timeLimitMs: number;
  /** Question index within the current session (1-based). */
  questionNumber: number;
}

export interface QuizAnswerRequest {
  sessionId: EntityId;
  questionId: EntityId;
  /** The selected option value. */
  answer: string;
  /** Time taken in milliseconds. */
  timeMs: number;
}

export interface QuizAnswerResponse {
  correct: boolean;
  correctAnswer: string;
  score: number;
  totalScore: number;
  livesRemaining: number;
  streak: number;
  /** Present when the session has ended. */
  result?: QuizSessionResult;
  /** Next question — absent when session is over. */
  nextQuestion?: QuizQuestion;
}

export interface QuizSessionResult {
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  streakMax: number;
  gameModeSlug: GameModeSlug;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Game Session (server-side state)
// ---------------------------------------------------------------------------

export interface GameSession {
  id: EntityId;
  userId: EntityId;
  gameModeId: EntityId;
  score: number;
  correctCount: number;
  totalQuestions: number;
  streakMax: number;
  livesRemaining: number;
  isActive: boolean;
  startedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface Friend {
  id: EntityId;
  userId: EntityId;
  friendId: EntityId;
  status: FriendStatus;
  createdAt: string;
  /** Populated after accept — the actual user info of the friend. */
  friend?: UserProfile;
}

export interface FriendRequest {
  id: EntityId;
  senderId: EntityId;
  receiverId: EntityId;
  status: FriendStatus;
  createdAt: string;
  sender?: UserProfile;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: EntityId;
  senderId: EntityId;
  receiverId: EntityId;
  content: string;
  read: boolean;
  createdAt: string;
  sender?: UserProfile;
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export interface RankingEntry {
  userId: EntityId;
  username: string;
  avatarUrl?: string;
  score: number;
  rank: number;
  gameModeSlug?: GameModeSlug;
}

export interface RankingsResponse {
  entries: RankingEntry[];
  userRank?: RankingEntry;
  totalPlayers: number;
  scope: 'global' | 'friends';
  period: 'forever' | 'daily';
  gameModeSlug?: GameModeSlug;
}

// ---------------------------------------------------------------------------
// Socket Events
// ---------------------------------------------------------------------------

export interface SocketAuthPayload {
  token: string;
}

export interface ChatSendPayload {
  receiverId: EntityId;
  content: string;
}

export interface ChatMessagePayload {
  message: ChatMessage;
}

export interface UserOnlinePayload {
  userId: EntityId;
}

export interface UserOfflinePayload {
  userId: EntityId;
}

// ---------------------------------------------------------------------------
// API error shape
// ---------------------------------------------------------------------------

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
