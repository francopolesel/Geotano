import { pgTable, uuid, text, doublePrecision, integer } from 'drizzle-orm/pg-core';

export const gameModes = pgTable('game_modes', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameEs: text('name_es').notNull(),
  descriptionEn: text('description_en'),
  descriptionEs: text('description_es'),
  timerSeconds: integer('timer_seconds').default(15).notNull(),
  lives: integer('lives').default(3).notNull(),
  multiplier: doublePrecision('multiplier').default(1.0).notNull(),
});
