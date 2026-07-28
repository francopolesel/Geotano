import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { matchChallenges } from './matchChallenges.js';

export const matchGames = pgTable(
  'match_games',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => matchChallenges.id),
    player1Id: uuid('player1_id')
      .notNull()
      .references(() => users.id),
    player2Id: uuid('player2_id')
      .notNull()
      .references(() => users.id),
    gameModeSlug: text('game_mode_slug').notNull(),
    player1Score: integer('player1_score').default(0).notNull(),
    player2Score: integer('player2_score').default(0).notNull(),
    player1Finished: boolean('player1_finished').default(false).notNull(),
    player2Finished: boolean('player2_finished').default(false).notNull(),
    player1StartedAt: timestamp('player1_started_at'),
    player2StartedAt: timestamp('player2_started_at'),
    winnerId: uuid('winner_id').references(() => users.id),
    questionPool: jsonb('question_pool').notNull(),
    playerAOrder: jsonb('player_a_order').notNull(),
    playerBOrder: jsonb('player_b_order').notNull(),
    status: text('status').default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    player1HistoryIdx: index('match_games_player1_status_idx').on(
      table.player1Id,
      table.status,
    ),
    player2HistoryIdx: index('match_games_player2_status_idx').on(
      table.player2Id,
      table.status,
    ),
  }),
);
