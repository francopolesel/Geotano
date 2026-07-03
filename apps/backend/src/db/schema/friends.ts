import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const friends = pgTable(
  'friends',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    friendId: uuid('friend_id')
      .notNull()
      .references(() => users.id),
    status: text('status').default('pending').notNull(), // pending | accepted | blocked
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userFriendUnique: uniqueIndex('friends_user_friend_unique').on(
      table.userId,
      table.friendId,
    ),
  }),
);
