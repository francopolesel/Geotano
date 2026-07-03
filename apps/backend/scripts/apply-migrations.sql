-- ============================================================
-- Safe migration script for Geotano production database
-- Run this in the Neon SQL console (or psql)
-- All statements use IF EXISTS / IF NOT EXISTS — safe to re-run
-- ============================================================

-- 1. Add bio column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;

-- 2. Drop the bad unique index (prevents having >1 accepted friend)
DROP INDEX IF EXISTS "friends_user_friend_status_idx";

-- 3. Create achievements table
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text NOT NULL,
	"description_en" text NOT NULL,
	"description_es" text NOT NULL,
	"icon" text NOT NULL,
	"category" text NOT NULL,
	"tier" integer,
	"condition" jsonb,
	"sort_order" integer NOT NULL,
	CONSTRAINT "achievements_slug_unique" UNIQUE("slug")
);

-- 4. Create user_achievements table
CREATE TABLE IF NOT EXISTS "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action,
	"achievement_id" uuid NOT NULL REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action,
	"earned_at" timestamp DEFAULT now() NOT NULL
);

-- 5. Create indexes for achievements lookup
CREATE UNIQUE INDEX IF NOT EXISTS "achievements_slug_idx" ON "achievements" USING btree ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_user_achievement_unique" ON "user_achievements" USING btree ("user_id","achievement_id");
