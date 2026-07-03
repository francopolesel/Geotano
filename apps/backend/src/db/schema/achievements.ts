import { pgTable, uuid, text, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameEs: text('name_es').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionEs: text('description_es').notNull(),
    icon: text('icon').notNull(),
    category: text('category').notNull(), // gameplay, social, mastery
    tier: integer('tier'), // 1= bronze, 2= silver, 3= gold; null = single-tier
    condition: jsonb('condition'),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('achievements_slug_idx').on(table.slug),
  }),
);
