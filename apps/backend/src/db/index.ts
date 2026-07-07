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
  `;
  await queryClient.unsafe(sql);
  console.log('[migrations] Applied pending migrations');
}
