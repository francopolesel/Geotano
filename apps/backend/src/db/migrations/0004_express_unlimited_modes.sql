-- Express + Unlimited game modes: add total_questions column
-- NULL means unlimited/lives-based mode (existing modes + unlimited variants)
-- 30 means express mode (30-question limit)

ALTER TABLE "game_modes" ADD COLUMN IF NOT EXISTS "total_questions" integer;
