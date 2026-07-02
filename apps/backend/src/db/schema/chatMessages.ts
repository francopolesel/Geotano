import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    read: boolean('read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    senderReceiverIdx: {
      columns: [table.senderId, table.receiverId, table.createdAt],
    },
  }),
);
