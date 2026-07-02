import {
  pgTable,
  uuid,
  integer,
  text,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { gameModes } from './gameModes';

export const dailyRankings = pgTable(
  'daily_rankings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    gameModeId: uuid('game_mode_id').references(() => gameModes.id),
    score: integer('score').notNull(),
    rank: integer('rank').notNull(),
    date: date('date').notNull().defaultNow(),
  },
  (table) => ({
    userModeDateUnique: uniqueIndex('daily_rankings_user_mode_date_unique').on(
      table.userId,
      table.gameModeId,
      table.date,
    ),
    dateModeRankIdx: uniqueIndex('daily_rankings_date_mode_rank_idx').on(
      table.date,
      table.gameModeId,
      table.rank,
    ),
  }),
);
