import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, friends } from '../db/schema/index.js';
import { authGuard } from '../auth/index.js';
import { eq, and, or, ne, sql, inArray } from 'drizzle-orm';
import { createNotification } from '../services/notifications.js';

export async function friendsRoutes(app: FastifyInstance) {
  // GET /api/users/search?q= — search users by username (case-insensitive, limit 10)
  app.get(
    '/api/users/search',
    { preHandler: authGuard },
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      const { userId } = (request as any).user;

      if (!q || q.trim().length < 2) {
        return reply.status(400).send({ errorCode: 'SHORT_QUERY', message: 'Query must be at least 2 characters' });
      }

      const searchPattern = `${q.trim()}%`;

      const results = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(
          and(
            ne(users.id, userId),
            sql`LOWER(${users.username}) LIKE LOWER(${searchPattern})`,
            sql`NOT EXISTS (
              SELECT 1 FROM ${friends}
              WHERE (
                (${friends.userId} = ${userId} AND ${friends.friendId} = ${users.id})
                OR
                (${friends.friendId} = ${userId} AND ${friends.userId} = ${users.id})
              )
            )`,
          ),
        )
        .limit(10);

      return { users: results };
    },
  );

  // POST /api/friends/request — send friend request
  app.post(
    '/api/friends/request',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { username } = request.body as { username: string };

      if (!username) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'username is required' });
      }

      // Find target user
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({ errorCode: 'USER_NOT_FOUND', message: 'User not found' });
      }

      if (targetUser.id === userId) {
        return reply.status(400).send({ errorCode: 'SELF_REQUEST', message: 'Cannot send friend request to yourself' });
      }

      // Check existing friendship/request in either direction
      const existing = await db
        .select()
        .from(friends)
        .where(
          or(
            and(eq(friends.userId, userId), eq(friends.friendId, targetUser.id)),
            and(eq(friends.userId, targetUser.id), eq(friends.friendId, userId)),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const status = existing[0].status;
        if (status === 'accepted') {
          return reply.status(409).send({ errorCode: 'ALREADY_FRIENDS', message: 'Already friends' });
        }
        if (status === 'pending') {
          return reply.status(409).send({ errorCode: 'REQUEST_ALREADY_SENT', message: 'Friend request already sent' });
        }
        return reply.status(409).send({ errorCode: 'FRIENDSHIP_ERROR', message: `Friendship status: ${status}` });
      }

      // Create friend request (sender = userId, receiver = targetUser.id)
      const [request_] = await db
        .insert(friends)
        .values({
          userId,
          friendId: targetUser.id,
          status: 'pending',
        })
        .returning();

      // Notify the target user
      createNotification({
        userId: targetUser.id,
        type: 'friend_request',
        fromUserId: userId,
      }).catch(() => {});

      return {
        id: request_.id,
        status: request_.status,
        createdAt: request_.createdAt.toISOString(),
      };
    },
  );

  // POST /api/friends/cancel — cancel an outgoing friend request
  app.post(
    '/api/friends/cancel',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { requestId } = request.body as { requestId: string };

      if (!requestId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'requestId is required' });
      }

      // Find the friend request — must be owned by current user and pending
      const [friendRequest] = await db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.id, requestId),
            eq(friends.userId, userId),
            eq(friends.status, 'pending'),
          ),
        )
        .limit(1);

      if (!friendRequest) {
        return reply.status(404).send({ errorCode: 'REQUEST_NOT_FOUND', message: 'Friend request not found' });
      }

      await db.delete(friends).where(eq(friends.id, requestId));

      return { success: true };
    },
  );

  // POST /api/friends/accept — accept friend request
  app.post(
    '/api/friends/accept',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { requestId } = request.body as { requestId: string };

      if (!requestId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'requestId is required' });
      }

      // Find the friend request — must be addressed to current user
      const [friendRequest] = await db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.id, requestId),
            eq(friends.friendId, userId),
            eq(friends.status, 'pending'),
          ),
        )
        .limit(1);

      if (!friendRequest) {
        return reply.status(404).send({ errorCode: 'REQUEST_NOT_FOUND', message: 'Friend request not found' });
      }

      const [updated] = await db
        .update(friends)
        .set({ status: 'accepted' })
        .where(eq(friends.id, requestId))
        .returning();

      // Notify the original sender that their request was accepted
      createNotification({
        userId: friendRequest.userId,
        type: 'friend_request_accepted',
        fromUserId: userId,
      }).catch(() => {});

      return {
        id: updated.id,
        status: updated.status,
        friendId: friendRequest.userId,
      };
    },
  );

  // POST /api/friends/decline — decline friend request
  app.post(
    '/api/friends/decline',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { requestId } = request.body as { requestId: string };

      if (!requestId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'requestId is required' });
      }

      // Find the friend request — must be addressed to current user
      const [friendRequest] = await db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.id, requestId),
            eq(friends.friendId, userId),
            eq(friends.status, 'pending'),
          ),
        )
        .limit(1);

      if (!friendRequest) {
        return reply.status(404).send({ errorCode: 'REQUEST_NOT_FOUND', message: 'Friend request not found' });
      }

      await db.delete(friends).where(eq(friends.id, requestId));

      return { success: true };
    },
  );

  // GET /api/friends — list friends + pending requests
  app.get(
    '/api/friends',
    { preHandler: authGuard },
    async (_request, reply) => {
      const { userId } = (_request as any).user;

      // Accepted friends (userId is sender OR receiver)
      const accepted = await db
        .select({
          id: friends.id,
          userId: friends.userId,
          friendId: friends.friendId,
          status: friends.status,
          createdAt: friends.createdAt,
        })
        .from(friends)
        .where(
          and(
            or(
              eq(friends.userId, userId),
              eq(friends.friendId, userId),
            ),
            eq(friends.status, 'accepted'),
          ),
        );

      // Enrich with user profile for the *other* user
      const friendIds = accepted.map((f) =>
        f.userId === userId ? f.friendId : f.userId,
      );

      const friendProfiles = friendIds.length > 0
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, friendIds))
        : [];

      const profileMap = new Map(friendProfiles.map((p) => [p.id, p]));

      const friendsList = accepted.map((f) => {
        const otherId = f.userId === userId ? f.friendId : f.userId;
        const profile = profileMap.get(otherId);
        return {
          id: f.id,
          friendId: otherId,
          username: profile?.username,
          displayName: profile?.displayName,
          avatarUrl: profile?.avatarUrl,
          status: f.status,
          createdAt: f.createdAt.toISOString(),
        };
      });

      // Incoming pending requests (someone sent to me)
      const incoming = await db
        .select({
          id: friends.id,
          userId: friends.userId,
          friendId: friends.friendId,
          status: friends.status,
          createdAt: friends.createdAt,
        })
        .from(friends)
        .where(
          and(
            eq(friends.friendId, userId),
            eq(friends.status, 'pending'),
          ),
        );

      const incomingSenderIds = incoming.map((r) => r.userId);
      const incomingProfiles = incomingSenderIds.length > 0
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, incomingSenderIds))
        : [];

      const incomingProfileMap = new Map(incomingProfiles.map((p) => [p.id, p]));

      const pendingIncoming = incoming.map((r) => {
        const profile = incomingProfileMap.get(r.userId);
        return {
          id: r.id,
          senderId: r.userId,
          username: profile?.username,
          displayName: profile?.displayName,
          avatarUrl: profile?.avatarUrl,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        };
      });

      // Outgoing pending requests (I sent)
      const outgoing = await db
        .select({
          id: friends.id,
          userId: friends.userId,
          friendId: friends.friendId,
          status: friends.status,
          createdAt: friends.createdAt,
        })
        .from(friends)
        .where(
          and(
            eq(friends.userId, userId),
            eq(friends.status, 'pending'),
          ),
        );

      const outgoingReceiverIds = outgoing.map((r) => r.friendId);
      const outgoingProfiles = outgoingReceiverIds.length > 0
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, outgoingReceiverIds))
        : [];

      const outgoingProfileMap = new Map(outgoingProfiles.map((p) => [p.id, p]));

      const pendingOutgoing = outgoing.map((r) => {
        const profile = outgoingProfileMap.get(r.friendId);
        return {
          id: r.id,
          receiverId: r.friendId,
          username: profile?.username,
          displayName: profile?.displayName,
          avatarUrl: profile?.avatarUrl,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        };
      });

      return {
        friends: friendsList,
        pendingIncoming,
        pendingOutgoing,
      };
    },
  );

  // GET /api/invite-link — returns user's unique invite code
  app.get(
    '/api/invite-link',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;

      const [user] = await db
        .select({ joinCode: users.joinCode, username: users.username })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.status(404).send({ errorCode: 'USER_NOT_FOUND', message: 'User not found' });
      }

      return {
        code: user.joinCode,
        inviteLink: `${request.protocol}://${request.hostname}/invite/${user.joinCode}`,
      };
    },
  );

  // POST /api/friends/invite — accept by invite code
  app.post(
    '/api/friends/invite',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { code } = request.body as { code: string };

      if (!code) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'code is required' });
      }

      // Find user by join code
      const [targetUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.joinCode, code))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({ errorCode: 'INVITE_INVALID', message: 'Invalid invite code' });
      }

      if (targetUser.id === userId) {
        return reply.status(400).send({ errorCode: 'SELF_REQUEST', message: 'Cannot invite yourself' });
      }

      // Check existing friendship/request
      const existing = await db
        .select()
        .from(friends)
        .where(
          or(
            and(eq(friends.userId, userId), eq(friends.friendId, targetUser.id)),
            and(eq(friends.userId, targetUser.id), eq(friends.friendId, userId)),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].status === 'accepted') {
          return reply.status(409).send({ errorCode: 'ALREADY_FRIENDS', message: 'Already friends' });
        }
        if (existing[0].status === 'pending') {
          // If there's a pending request from target to us, auto-accept
          if (existing[0].userId === targetUser.id) {
            const [updated] = await db
              .update(friends)
              .set({ status: 'accepted' })
              .where(eq(friends.id, existing[0].id))
              .returning();

            // Notify the inviter that their request was accepted
            createNotification({
              userId: targetUser.id,
              type: 'friend_request_accepted',
              fromUserId: userId,
            }).catch(() => {});

            return {
              id: updated.id,
              status: 'accepted',
              friend: {
                id: targetUser.id,
                username: targetUser.username,
              },
              message: 'Friend request accepted via invite',
            };
          }
          return reply.status(409).send({ errorCode: 'REQUEST_ALREADY_SENT', message: 'Friend request already sent' });
        }
      }

      // Create accepted friendship directly (invite bypasses pending)
      const [request_] = await db
        .insert(friends)
        .values({
          userId: targetUser.id, // inviter is userId
          friendId: userId,      // current user is friendId
          status: 'accepted',
        })
        .returning();

      return {
        id: request_.id,
        status: 'accepted',
        friend: {
          id: targetUser.id,
          username: targetUser.username,
        },
      };
    },
  );

  // ── Block / Unblock / Remove ─────────────────────────────────────────────

  // POST /api/friends/block — block a friend
  app.post(
    '/api/friends/block',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { friendId } = request.body as { friendId: string };

      if (!friendId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'friendId is required' });
      }

      // Find the friendship in either direction
      const [existing] = await db
        .select()
        .from(friends)
        .where(
          or(
            and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
            and(eq(friends.userId, friendId), eq(friends.friendId, userId)),
          ),
        )
        .limit(1);

      if (!existing) {
        // No relationship exists — create a blocked entry
        const [blocked] = await db
          .insert(friends)
          .values({ userId, friendId, status: 'blocked' })
          .returning();
        return { id: blocked.id, status: 'blocked' };
      }

      if (existing.status === 'blocked' && existing.userId === userId) {
        return reply.status(409).send({ errorCode: 'ALREADY_BLOCKED', message: 'User is already blocked' });
      }

      const [updated] = await db
        .update(friends)
        .set({ status: 'blocked' })
        .where(eq(friends.id, existing.id))
        .returning();

      return { id: updated.id, status: 'blocked' };
    },
  );

  // POST /api/friends/unblock — unblock a user
  app.post(
    '/api/friends/unblock',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { friendId } = request.body as { friendId: string };

      if (!friendId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'friendId is required' });
      }

      const [existing] = await db
        .select()
        .from(friends)
        .where(
          and(
            eq(friends.userId, userId),
            eq(friends.friendId, friendId),
            eq(friends.status, 'blocked'),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ errorCode: 'BLOCKED_NOT_FOUND', message: 'Blocked relationship not found' });
      }

      // Remove the blocked relationship (clean slate)
      await db.delete(friends).where(eq(friends.id, existing.id));

      return { success: true };
    },
  );

  // POST /api/friends/remove — remove/unfriend
  app.post(
    '/api/friends/remove',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { friendId } = request.body as { friendId: string };

      if (!friendId) {
        return reply.status(400).send({ errorCode: 'MISSING_FIELD', message: 'friendId is required' });
      }

      const [existing] = await db
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

      if (!existing) {
        return reply.status(404).send({ errorCode: 'FRIENDSHIP_NOT_FOUND', message: 'Friendship not found' });
      }

      await db.delete(friends).where(eq(friends.id, existing.id));

      return { success: true };
    },
  );

  // GET /api/friends/blocked — list blocked users
  app.get(
    '/api/friends/blocked',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;

      const blocked = await db
        .select({
          id: friends.id,
          friendId: friends.friendId,
          createdAt: friends.createdAt,
        })
        .from(friends)
        .where(
          and(
            eq(friends.userId, userId),
            eq(friends.status, 'blocked'),
          ),
        );

      // Enrich with user profiles
      const blockedIds = blocked.map((b) => b.friendId);
      const profiles = blockedIds.length > 0
        ? await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, blockedIds))
        : [];

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return blocked.map((b) => {
        const profile = profileMap.get(b.friendId);
        return {
          id: b.id,
          userId: b.friendId,
          username: profile?.username,
          displayName: profile?.displayName,
          avatarUrl: profile?.avatarUrl,
          blockedAt: b.createdAt.toISOString(),
        };
      });
    },
  );
}
