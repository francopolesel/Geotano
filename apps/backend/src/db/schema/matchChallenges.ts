import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const matchChallenges = pgTable(
  'match_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    challengerId: uuid('challenger_id')
      .notNull()
      .references(() => users.id),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id),
    gameModeSlug: text('game_mode_slug').notNull(),
    durationMinutes: integer('duration_minutes').default(3).notNull(),
    status: text('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    challengerHistoryIdx: index('match_challenges_challenger_created_idx').on(
      table.challengerId,
      table.createdAt,
    ),
  }),
);
