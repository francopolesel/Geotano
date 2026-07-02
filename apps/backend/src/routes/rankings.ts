import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { gameSessions, users, gameModes, friends } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, gte, inArray, sql, type SQL } from 'drizzle-orm';
import type { RankingEntry, RankingsResponse, GameModeSlug } from '@geotano/shared';

const VALID_MODE_SLUGS: GameModeSlug[] = [
  'flag-guess',
  'capital-guess',
  'country-by-flag',
  'continent',
  'free',
];

function isGameModeSlug(value: string): value is GameModeSlug {
  return VALID_MODE_SLUGS.includes(value as GameModeSlug);
}

export async function rankingsRoutes(app: FastifyInstance) {
  app.get(
    '/api/rankings',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const query = request.query as {
        scope?: string;
        mode?: string;
        period?: string;
      };

      const scope = query.scope ?? 'global';
      const period = query.period ?? 'forever';
      const modeSlug = query.mode && isGameModeSlug(query.mode) ? query.mode : undefined;

      // Validate params
      if (!['global', 'friends'].includes(scope)) {
        return reply.status(400).send({ message: 'scope must be "global" or "friends"' });
      }
      if (!['forever', 'daily'].includes(period)) {
        return reply.status(400).send({ message: 'period must be "forever" or "daily"' });
      }
      if (query.mode && !isGameModeSlug(query.mode)) {
        return reply.status(400).send({ message: 'Invalid mode slug' });
      }

      // --- Build base conditions ---
      const conditions: SQL[] = [
        eq(gameSessions.isActive, false),
        sql`${gameSessions.completedAt} IS NOT NULL`,
      ];

      if (modeSlug) {
        conditions.push(eq(gameModes.slug, modeSlug));
      }

      if (period === 'daily') {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        conditions.push(gte(gameSessions.completedAt, today));
      }

      // Collect friend IDs for friends scope
      let friendIds: string[] | null = null;
      if (scope === 'friends') {
        const sent = await db
          .select({ friendId: friends.friendId })
          .from(friends)
          .where(
            and(
              eq(friends.userId, userId),
              eq(friends.status, 'accepted'),
            ),
          );

        const received = await db
          .select({ friendId: friends.userId })
          .from(friends)
          .where(
            and(
              eq(friends.friendId, userId),
              eq(friends.status, 'accepted'),
            ),
          );

        friendIds = [
          ...sent.map((r) => r.friendId),
          ...received.map((r) => r.friendId),
          userId, // Include the user themselves
        ];

        conditions.push(inArray(gameSessions.userId, friendIds));
      }

      // --- Get top 100 ranked entries ---
      const topEntries = await db
        .select({
          userId: gameSessions.userId,
          username: users.username,
          avatarUrl: users.avatarUrl,
          score: sql<number>`CAST(SUM(${gameSessions.score}) AS INTEGER)`.as('score'),
        })
        .from(gameSessions)
        .innerJoin(users, eq(users.id, gameSessions.userId))
        .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
        .where(and(...conditions))
        .groupBy(gameSessions.userId, users.username, users.avatarUrl)
        .orderBy(sql`score DESC`)
        .limit(100);

      // Calculate ranks with tie handling (DENSE_RANK equivalent)
      let rank = 0;
      let prevScore: number | null = null;
      let position = 0;
      const entries: RankingEntry[] = topEntries.map((e) => {
        position++;
        if (e.score !== prevScore) {
          rank = position;
        }
        prevScore = e.score;
        return {
          userId: e.userId,
          username: e.username,
          avatarUrl: e.avatarUrl ?? undefined,
          score: e.score,
          rank,
          gameModeSlug: modeSlug ?? undefined,
        };
      });

      // --- Compute total player count (without limit) ---
      const totalPlayersRows = await db
        .select({
          totalPlayers: sql<number>`COUNT(DISTINCT ${gameSessions.userId})::integer`,
        })
        .from(gameSessions)
        .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
        .where(and(...conditions));
      const totalPlayers = totalPlayersRows[0]?.totalPlayers ?? 0;

      // --- Find user's rank ---
      const userInTop = entries.find((e) => e.userId === userId);
      let userRank: RankingEntry | undefined;

      if (userInTop) {
        userRank = userInTop;
      } else {
        // Build conditions WITH friends scope filter to compute user's position within scope
        const userConditions: SQL[] = [
          eq(gameSessions.isActive, false),
          sql`${gameSessions.completedAt} IS NOT NULL`,
          eq(gameSessions.userId, userId),
        ];
        if (modeSlug) userConditions.push(eq(gameModes.slug, modeSlug));
        if (period === 'daily') {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          userConditions.push(gte(gameSessions.completedAt, today));
        }
        if (scope === 'friends' && friendIds) {
          userConditions.push(inArray(gameSessions.userId, friendIds));
        }

        const [userScoreResult] = await db
          .select({
            score: sql<number>`CAST(SUM(${gameSessions.score}) AS INTEGER)`,
          })
          .from(gameSessions)
          .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
          .where(and(...userConditions))
          .groupBy(gameSessions.userId);

        if (userScoreResult && userScoreResult.score > 0) {
          // Count users with strictly higher total score within scope
          const higherSubquery = db
            .select({
              uid: gameSessions.userId,
            })
            .from(gameSessions)
            .innerJoin(gameModes, eq(gameModes.id, gameSessions.gameModeId))
            .where(
              and(
                eq(gameSessions.isActive, false),
                sql`${gameSessions.completedAt} IS NOT NULL`,
                ...(modeSlug ? [eq(gameModes.slug, modeSlug)] : []),
                ...(period === 'daily'
                  ? (() => {
                      const t = new Date();
                      t.setUTCHours(0, 0, 0, 0);
                      return [gte(gameSessions.completedAt, t)];
                    })()
                  : []),
                ...(scope === 'friends' && friendIds
                  ? [inArray(gameSessions.userId, friendIds)]
                  : []),
              ),
            )
            .groupBy(gameSessions.userId)
            .having(
              sql`CAST(SUM(${gameSessions.score}) AS INTEGER) > ${userScoreResult.score}`,
            )
            .as('higher');

          const [{ count: higherCount }] = await db
            .select({
              count: sql<number>`COUNT(*)::integer`,
            })
            .from(higherSubquery);

          const callRank = higherCount + 1;

          userRank = {
            userId,
            username: (request as any).user.username,
            score: userScoreResult.score,
            rank: callRank,
          };
        }
      }

      const response: RankingsResponse = {
        entries,
        userRank,
        totalPlayers,
        scope: scope as 'global' | 'friends',
        period: period as 'forever' | 'daily',
        gameModeSlug: modeSlug,
      };

      return response;
    },
  );
}
