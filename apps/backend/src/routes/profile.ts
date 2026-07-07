import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, friends, gameSessions, gameModes } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { getUserAchievements } from '../services/achievements.js';

export async function profileRoutes(app: FastifyInstance) {
  // GET /api/users/:id/profile — public profile
  app.get(
    '/api/users/:id/profile',
    { preHandler: authGuard },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const currentUserId = (request as any).user.userId;

      // Basic user info
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      // Total score
      const [scoreResult] = await db
        .select({
          totalScore: sql<number>`CAST(COALESCE(SUM(${gameSessions.score}), 0) AS INTEGER)`,
          totalGames: sql<number>`CAST(COUNT(*) AS INTEGER)`,
          bestScore: sql<number>`CAST(COALESCE(MAX(${gameSessions.score}), 0) AS INTEGER)`,
        })
        .from(gameSessions)
        .where(
          and(
            eq(gameSessions.userId, id),
            eq(gameSessions.isActive, false),
            sql`${gameSessions.completedAt} IS NOT NULL`,
          ),
        );

      // Friend count
      const [friendCountResult] = await db
        .select({
          count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        })
        .from(friends)
        .where(
          and(
            sql`(${friends.userId} = ${id} OR ${friends.friendId} = ${id})`,
            eq(friends.status, 'accepted'),
          ),
        );

      // Recent games (last 10)
      const recentGames = await db
        .select({
          id: gameSessions.id,
          score: gameSessions.score,
          correctCount: gameSessions.correctCount,
          totalQuestions: gameSessions.totalQuestions,
          gameModeSlug: gameModes.slug,
          gameModeNameEn: gameModes.nameEn,
          completedAt: gameSessions.completedAt,
        })
        .from(gameSessions)
        .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
        .where(
          and(
            eq(gameSessions.userId, id),
            eq(gameSessions.isActive, false),
            sql`${gameSessions.completedAt} IS NOT NULL`,
          ),
        )
        .orderBy(sql`${gameSessions.completedAt} DESC`)
        .limit(10);

      const achievements = await getUserAchievements(id);

      // ── Friendship status (relative to current user) ────────────────
      let friendshipStatus: 'self' | 'accepted' | 'outgoing' | 'incoming' | 'blocked' | 'none' = 'none';

      if (currentUserId === id) {
        friendshipStatus = 'self';
      } else {
        const [relation] = await db
          .select()
          .from(friends)
          .where(
            sql`((${friends.userId} = ${currentUserId} AND ${friends.friendId} = ${id})
              OR (${friends.userId} = ${id} AND ${friends.friendId} = ${currentUserId}))`,
          )
          .limit(1);

        if (relation) {
          if (relation.status === 'accepted') {
            friendshipStatus = 'accepted';
          } else if (relation.status === 'pending') {
            friendshipStatus =
              relation.userId === currentUserId ? 'outgoing' : 'incoming';
          } else if (relation.status === 'blocked') {
            friendshipStatus = 'blocked';
          }
        }
      }

      // Pass the friend request ID when there's an incoming request (so the
      // frontend can accept/decline directly without an extra API call).
      const friendRequestId =
        friendshipStatus === 'incoming'
          ? (await db
              .select({ id: friends.id })
              .from(friends)
              .where(
                and(
                  eq(friends.friendId, currentUserId),
                  eq(friends.userId, id),
                  eq(friends.status, 'pending'),
                ),
              )
              .limit(1))[0]?.id ?? null
          : null;

      return {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          createdAt: user.createdAt.toISOString(),
        },
        stats: {
          totalScore: scoreResult?.totalScore ?? 0,
          totalGames: scoreResult?.totalGames ?? 0,
          bestScore: scoreResult?.bestScore ?? 0,
          friends: friendCountResult?.count ?? 0,
        },
        recentGames: recentGames.map((g) => ({
          id: g.id,
          score: g.score,
          correctCount: g.correctCount,
          totalQuestions: g.totalQuestions,
          gameMode: g.gameModeSlug,
          gameModeNameEn: g.gameModeNameEn,
          completedAt: g.completedAt?.toISOString(),
        })),
        achievements,
        friendshipStatus,
        friendRequestId,
      };
    },
  );
}
