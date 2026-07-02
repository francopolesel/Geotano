import { db } from '../db/index.js';
import { notifications } from '../db/schema/index.js';
import { users } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { getIO, getUserSocketIds } from '../socket/index.js';
import type { NotificationType } from '@geotano/shared';

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  fromUserId: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, type, fromUserId, metadata = {} } = params;

  // Persist to DB
  const [notification] = await db
    .insert(notifications)
    .values({ userId, type, fromUserId, metadata })
    .returning();

  // Enrich with sender info for the socket event
  const [fromUser] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, fromUserId))
    .limit(1);

  const notificationData = {
    id: notification.id,
    userId: notification.userId,
    type: notification.type as NotificationType,
    fromUserId: notification.fromUserId,
    fromUsername: fromUser?.username,
    fromDisplayName: fromUser?.displayName,
    fromAvatarUrl: fromUser?.avatarUrl,
    metadata: notification.metadata as Record<string, unknown>,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };

  // Emit socket event to all user's connected sockets
  try {
    const io = getIO();
    const socketIds = getUserSocketIds(userId);
    for (const sid of socketIds) {
      io.to(sid).emit('notification:new', { notification: notificationData });
    }
  } catch {
    // Socket not initialized yet — notification is still persisted in DB
    // The frontend will fetch on reconnect
  }

  return notificationData;
}
