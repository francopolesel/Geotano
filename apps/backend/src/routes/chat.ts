import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { chatMessages, users, friends } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm';

export async function chatRoutes(app: FastifyInstance) {
  // GET /api/chat/:friendId — get message history (last 50, with cursor)
  app.get(
    '/api/chat/:friendId',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { friendId } = request.params as { friendId: string };
      const { before, limit: limitStr } = request.query as {
        before?: string;
        limit?: string;
      };

      // Verify they are friends
      const [friendship] = await db
        .select()
        .from(friends)
        .where(
          and(
            or(
              and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
              and(eq(friends.userId, friendId), eq(friends.friendId, userId)),
            ),
            eq(friends.status, 'accepted'),
          ),
        )
        .limit(1);

      if (!friendship) {
        return reply.status(403).send({ message: 'Not friends with this user' });
      }

      const limit = Math.min(parseInt(limitStr || '50', 10) || 50, 100);

      const conditions = and(
        or(
          and(eq(chatMessages.senderId, userId), eq(chatMessages.receiverId, friendId)),
          and(eq(chatMessages.senderId, friendId), eq(chatMessages.receiverId, userId)),
        ),
        before ? sql`${chatMessages.createdAt} < ${new Date(before)}` : undefined,
      );

      const messages = await db
        .select({
          id: chatMessages.id,
          senderId: chatMessages.senderId,
          receiverId: chatMessages.receiverId,
          content: chatMessages.content,
          read: chatMessages.read,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(conditions)
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);

      return {
        messages: messages.reverse().map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      };
    },
  );
}
