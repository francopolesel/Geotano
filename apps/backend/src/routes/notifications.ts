import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { notifications } from '../db/schema/index.js';
import { users } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /api/notifications — list recent notifications
  app.get(
    '/api/notifications',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;

      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);

      // Enrich with sender info
      const fromUserIds = [...new Set(rows.map((n) => n.fromUserId))];
      const senderProfiles = fromUserIds.length > 0
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, fromUserIds))
        : [];

      const profileMap = new Map(senderProfiles.map((p) => [p.id, p]));

      const notificationList = rows.map((n) => {
        const profile = profileMap.get(n.fromUserId);
        return {
          id: n.id,
          userId: n.userId,
          type: n.type,
          fromUserId: n.fromUserId,
          fromUsername: profile?.username,
          fromDisplayName: profile?.displayName,
          fromAvatarUrl: profile?.avatarUrl,
          metadata: n.metadata,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        };
      });

      const unreadCount = notificationList.filter((n) => !n.read).length;

      return {
        notifications: notificationList,
        unreadCount,
      };
    },
  );

  // POST /api/notifications/read/:id — delete notification (read = acknowledged = gone)
  app.post(
    '/api/notifications/read/:id',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { id } = request.params as { id: string };

      const [deleted] = await db
        .delete(notifications)
        .where(
          and(eq(notifications.id, id), eq(notifications.userId, userId)),
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({ message: 'Notification not found' });
      }

      return { success: true };
    },
  );

  // POST /api/notifications/read-all — delete all notifications for this user
  app.post(
    '/api/notifications/read-all',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;

      await db
        .delete(notifications)
        .where(eq(notifications.userId, userId));

      return { success: true };
    },
  );

  // DELETE /api/notifications/:id — dismiss a notification (remove from list)
  app.delete(
    '/api/notifications/:id',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { id } = request.params as { id: string };

      const [deleted] = await db
        .delete(notifications)
        .where(
          and(eq(notifications.id, id), eq(notifications.userId, userId)),
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({ message: 'Notification not found' });
      }

      return { success: true };
    },
  );
}
