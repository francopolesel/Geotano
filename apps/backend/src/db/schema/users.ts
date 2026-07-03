import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    language: text('language').default('en').notNull(),
    joinCode: text('join_code').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastLogin: timestamp('last_login'),
  },
  (table) => ({
    joinCodeIdx: uniqueIndex('users_join_code_idx').on(table.joinCode),
  }),
);
