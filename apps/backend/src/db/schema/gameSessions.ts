import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { gameModes } from './gameModes.js';

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    gameModeId: uuid('game_mode_id')
      .notNull()
      .references(() => gameModes.id),
    score: integer('score').default(0).notNull(),
    correctCount: integer('correct_count').default(0).notNull(),
    totalQuestions: integer('total_questions').default(0).notNull(),
    streakMax: integer('streak_max').default(0).notNull(),
    livesRemaining: integer('lives_remaining').default(3).notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    userCompletedIdx: uniqueIndex('game_sessions_user_completed_idx').on(
      table.userId,
      table.completedAt,
    ),
    modeScoreIdx: index('game_sessions_mode_score_idx').on(
      table.gameModeId,
      table.score,
    ),
  }),
);
