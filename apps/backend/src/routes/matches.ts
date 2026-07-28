import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, matchChallenges, matchGames, friends } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, or } from 'drizzle-orm';
import * as matchService from '../services/matchService.js';
import { createNotification } from '../services/notifications.js';
import { getIO, getUserSocketIds } from '../socket/index.js';

export async function matchRoutes(app: FastifyInstance) {
  // POST /api/matches/challenge — challenge a friend with a game mode
  app.post(
    '/api/matches/challenge',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { receiverId, gameModeSlug } = request.body as {
        receiverId: string;
        gameModeSlug: string;
      };

      if (!receiverId || !gameModeSlug) {
        return reply.status(400).send({
          errorCode: 'MISSING_FIELD',
          message: 'receiverId and gameModeSlug are required',
        });
      }

      // Verify friendship
      const [friendship] = await db
        .select()
        .from(friends)
        .where(
          and(
            or(
              and(eq(friends.userId, userId), eq(friends.friendId, receiverId)),
              and(eq(friends.userId, receiverId), eq(friends.friendId, userId)),
            ),
            eq(friends.status, 'accepted'),
          ),
        )
        .limit(1);

      if (!friendship) {
        return reply.status(403).send({
          errorCode: 'NOT_FRIENDS',
          message: 'You can only challenge friends',
        });
      }

      // Check no pending challenge exists
      const [existing] = await db
        .select()
        .from(matchChallenges)
        .where(
          and(
            or(
              and(
                eq(matchChallenges.challengerId, userId),
                eq(matchChallenges.receiverId, receiverId),
              ),
              and(
                eq(matchChallenges.challengerId, receiverId),
                eq(matchChallenges.receiverId, userId),
              ),
            ),
            eq(matchChallenges.status, 'pending'),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.status(409).send({
          errorCode: 'PENDING_CHALLENGE',
          message: 'A pending challenge already exists with this user',
        });
      }

      const challengeId = await matchService.createChallenge(userId, receiverId, gameModeSlug);

      // Notify receiver via Socket.IO if online
      const [challengerUser] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const io = getIO();
      const receiverSids = getUserSocketIds(receiverId);
      for (const sid of receiverSids) {
        io.to(sid).emit('challenge:invite', {
          challengeId,
          challenger: challengerUser ?? { id: userId, username: 'unknown' },
        });
      }

      // DB notification as offline fallback
      createNotification({
        userId: receiverId,
        type: 'challenge_invite',
        fromUserId: userId,
        metadata: {
          challengerUsername: challengerUser?.username,
          gameModeSlug,
        },
      }).catch(() => {});

      return { challengeId };
    },
  );

  // POST /api/matches/accept
  app.post(
    '/api/matches/accept',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { challengeId } = request.body as { challengeId: string };

      if (!challengeId) {
        return reply.status(400).send({
          errorCode: 'MISSING_FIELD',
          message: 'challengeId is required',
        });
      }

      const result = await matchService.acceptChallenge(challengeId, userId);
      if (!result) {
        return reply.status(404).send({
          errorCode: 'CHALLENGE_NOT_FOUND',
          message: 'Challenge not found or no longer pending',
        });
      }

      // Notify challenger that challenge was accepted
      const io = getIO();
      const challengerSids = getUserSocketIds(result.challenge.challengerId);
      for (const sid of challengerSids) {
        io.to(sid).emit('challenge:accepted', {
          matchId: result.matchId,
          challengeId,
        });
      }

      return { matchId: result.matchId };
    },
  );

  // POST /api/matches/decline
  app.post(
    '/api/matches/decline',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { challengeId } = request.body as { challengeId: string };

      if (!challengeId) {
        return reply.status(400).send({
          errorCode: 'MISSING_FIELD',
          message: 'challengeId is required',
        });
      }

      const ok = await matchService.declineChallenge(challengeId, userId);
      if (!ok) {
        return reply.status(404).send({
          errorCode: 'CHALLENGE_NOT_FOUND',
          message: 'Challenge not found',
        });
      }

      return { message: 'Challenge declined' };
    },
  );

  // POST /api/matches/:id/play — start or resume playing
  app.post(
    '/api/matches/:id/play',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { id } = request.params as { id: string };

      const result = await matchService.startMatchPlay(id, userId);
      if (!result) {
        return reply.status(404).send({
          errorCode: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
      }

      return result;
    },
  );

  // POST /api/matches/:id/answer — submit an answer
  app.post(
    '/api/matches/:id/answer',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { id } = request.params as { id: string };
      const { optionIndex } = request.body as { optionIndex: number };

      if (typeof optionIndex !== 'number') {
        return reply.status(400).send({
          errorCode: 'MISSING_FIELD',
          message: 'optionIndex is required',
        });
      }

      const result = await matchService.submitAnswer(id, userId, optionIndex);
      if (!result) {
        return reply.status(400).send({
          errorCode: 'SUBMIT_FAILED',
          message: 'Could not submit answer',
        });
      }

      return result;
    },
  );

  // GET /api/matches/:id — get current match state
  app.get(
    '/api/matches/:id',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { id } = request.params as { id: string };

      const match = await matchService.getMatchState(id);
      if (!match) {
        return reply.status(404).send({
          errorCode: 'MATCH_NOT_FOUND',
          message: 'Match not found',
        });
      }

      // Verify user is part of this match
      if (match.player1Id !== userId && match.player2Id !== userId) {
        return reply.status(403).send({
          errorCode: 'FORBIDDEN',
          message: 'You are not a participant in this match',
        });
      }

      return match;
    },
  );

  // GET /api/matches/history — list user's match history with opponent profiles
  app.get(
    '/api/matches/history',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;

      const history = await matchService.getPlayerMatchHistory(userId);

      // Enrich with opponent profiles
      const enriched = await Promise.all(
        history.map(async (m) => {
          const oppId = m.player1Id === userId ? m.player2Id : m.player1Id;
          const [oppUser] = await db
            .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.id, oppId))
            .limit(1);

          return {
            ...m,
            opponent: oppUser ?? { id: oppId, username: 'unknown', displayName: null, avatarUrl: null },
          };
        }),
      );

      return { matches: enriched };
    },
  );
}
