import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Server-authoritative truco matches. One durable row per match:
 * the full engine state lives in `engine_state` JSONB (wrapped as
 * `{ schemaVersion: 1, state }`) and `version` is a monotonic counter
 * used for optimistic concurrency (`WHERE version = $expected` CAS).
 * Scores/status are NOT duplicated here — they live inside the engine
 * state; only cheap-cleanup columns are relational.
 */
export const trucoMatches = pgTable(
  'truco_matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    hostPlayerId: uuid('host_player_id')
      .notNull()
      .references(() => users.id),
    guestPlayerId: uuid('guest_player_id').references(() => users.id),
    status: text('status').default('waiting').notNull(), // waiting|ready|playing|finished
    targetPoints: integer('target_points').default(30).notNull(),
    engineState: jsonb('engine_state'), // null until start deals hand 1
    version: integer('version').default(0).notNull(),
    winnerUserId: uuid('winner_user_id').references(() => users.id),
    finishedAt: timestamp('finished_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    // Room codes collide only among ACTIVE matches — finished/expired rows
    // release their code for reuse (mirrors migration 0009).
    codeActiveIdx: uniqueIndex('truco_matches_code_active_idx')
      .on(table.code)
      .where(sql`"status" IN ('waiting', 'ready', 'playing')`),
    hostIdx: index('truco_matches_host_idx').on(table.hostPlayerId),
    statusUpdatedIdx: index('truco_matches_status_updated_idx').on(
      table.status,
      table.updatedAt,
    ),
  }),
);
