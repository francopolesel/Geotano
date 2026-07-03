import { pgTable, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { achievements } from './achievements.js';

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id),
    earnedAt: timestamp('earned_at').defaultNow().notNull(),
  },
  (table) => ({
    userAchievementUnq: uniqueIndex('user_achievements_user_achievement_unique').on(
      table.userId,
      table.achievementId,
    ),
  }),
);
