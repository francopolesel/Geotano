import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { matchGames } from './matchGames.js';

export const matchAnswers = pgTable(
  'match_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matchGames.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    questionIndex: integer('question_index').notNull(),
    optionIndex: integer('option_index').notNull(),
    wasCorrect: boolean('was_correct').notNull(),
    scoreEarned: integer('score_earned').notNull(),
    streakAtAnswer: integer('streak_at_answer').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    matchUserIdx: index('match_answers_match_user_idx').on(
      table.matchId,
      table.userId,
    ),
    matchIdx: index('match_answers_match_idx').on(table.matchId),
  }),
);
