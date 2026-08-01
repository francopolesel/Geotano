import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/index.js';
import * as schema from './schema/index.js';

const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
export type Db = typeof db;

/** Run pending migrations at startup. Each migration is idempotent (IF NOT EXISTS). */
export async function runMigrations(): Promise<void> {
  const sql = `
    -- 0004: Express + Unlimited game modes
    ALTER TABLE "game_modes" ADD COLUMN IF NOT EXISTS "total_questions" integer;

    -- 0005: Match tables (challenges + games + answers)
    CREATE TABLE IF NOT EXISTS "match_challenges" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "challenger_id" uuid NOT NULL REFERENCES "public"."users"("id"),
      "receiver_id" uuid NOT NULL REFERENCES "public"."users"("id"),
      "game_mode_slug" text NOT NULL,
      "duration_minutes" integer DEFAULT 3 NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "match_games" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "challenge_id" uuid NOT NULL REFERENCES "public"."match_challenges"("id"),
      "player1_id" uuid NOT NULL REFERENCES "public"."users"("id"),
      "player2_id" uuid NOT NULL REFERENCES "public"."users"("id"),
      "game_mode_slug" text NOT NULL,
      "duration_minutes" integer DEFAULT 3 NOT NULL,
      "player1_score" integer DEFAULT 0 NOT NULL,
      "player2_score" integer DEFAULT 0 NOT NULL,
      "player1_finished" boolean DEFAULT false NOT NULL,
      "player2_finished" boolean DEFAULT false NOT NULL,
      "player1_started_at" timestamp,
      "player2_started_at" timestamp,
      "winner_id" uuid REFERENCES "public"."users"("id"),
      "question_pool" jsonb NOT NULL,
      "player_a_order" jsonb NOT NULL,
      "player_b_order" jsonb NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    -- Drop match_answers if it has wrong columns from an earlier migration
    DROP TABLE IF EXISTS "match_answers" CASCADE;

    CREATE TABLE IF NOT EXISTS "match_answers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "match_id" uuid NOT NULL REFERENCES "public"."match_games"("id"),
      "user_id" uuid NOT NULL REFERENCES "public"."users"("id"),
      "question_index" integer NOT NULL,
      "option_index" integer NOT NULL,
      "was_correct" boolean NOT NULL,
      "score_earned" integer NOT NULL,
      "streak_at_answer" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "match_answers_match_user_idx" ON "match_answers" ("match_id", "user_id");
    CREATE INDEX IF NOT EXISTS "match_answers_match_idx" ON "match_answers" ("match_id");
    CREATE INDEX IF NOT EXISTS "match_games_player1_status_idx" ON "match_games" ("player1_id", "status");
    CREATE INDEX IF NOT EXISTS "match_games_player2_status_idx" ON "match_games" ("player2_id", "status");
    CREATE INDEX IF NOT EXISTS "match_challenges_challenger_created_idx" ON "match_challenges" ("challenger_id", "created_at");

    -- 0006: Add duration_minutes column to match tables
    ALTER TABLE "match_challenges" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 3 NOT NULL;
    ALTER TABLE "match_games" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 3 NOT NULL;

    -- 0007: At most one pending challenge per user pair. Prevents duplicate
    -- invites from concurrent sends, and lets the challenge route safely
    -- replace a stale pending invite without creating duplicates.
    CREATE UNIQUE INDEX IF NOT EXISTS "match_challenges_one_pending_pair_idx"
      ON "match_challenges" ("challenger_id", "receiver_id")
      WHERE "status" = 'pending';
  `;
  await queryClient.unsafe(sql);
  console.log('[migrations] Applied pending migrations');
}
