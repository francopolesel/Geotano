import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { gameSessions } from './gameSessions';
import { countries } from './countries';

export const gameAnswers = pgTable(
  'game_answers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => gameSessions.id),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id),
    questionType: text('question_type').notNull(),
    wasCorrect: boolean('was_correct').notNull(),
    timeTakenMs: integer('time_taken_ms').notNull(),
    optionsShown: uuid('options_shown').array().notNull(),
    streakAtQuestion: integer('streak_at_question').default(0).notNull(),
    answeredAt: timestamp('answered_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: {
      columns: [table.sessionId],
    },
  }),
);
