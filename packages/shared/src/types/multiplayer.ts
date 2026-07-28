// ---------------------------------------------------------------------------
// Geotano — Async Multiplayer Types
// ---------------------------------------------------------------------------

export type MatchChallengeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type MatchGameStatus = 'pending' | 'in_progress' | 'completed';

export interface MatchChallenge {
  id: string;
  challengerId: string;
  receiverId: string;
  gameModeSlug: string;
  status: MatchChallengeStatus;
  createdAt: string;
}

export interface MatchGame {
  id: string;
  challengeId: string;
  player1Id: string;
  player2Id: string;
  gameModeSlug: string;
  player1Score: number;
  player2Score: number;
  player1Finished: boolean;
  player2Finished: boolean;
  player1StartedAt: string | null;
  player2StartedAt: string | null;
  winnerId: string | null;
  status: MatchGameStatus;
  createdAt: string;
}

export interface MatchAnswer {
  id: string;
  matchId: string;
  userId: string;
  questionIndex: number;
  optionIndex: number;
  wasCorrect: boolean;
  scoreEarned: number;
  streakAtAnswer: number;
  createdAt: string;
}
