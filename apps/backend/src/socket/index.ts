import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { verifyToken } from '../auth/index.js';
import { db } from '../db/index.js';
import { chatMessages, friends, users } from '../db/schema/index.js';
import { eq, and, or } from 'drizzle-orm';
import { createNotification } from '../services/notifications.js';
import * as matchService from '../services/matchService.js';

/**
 * In-memory map: userId → Set of socket IDs.
 * Resets on deploy — acceptable for MVP (see design.md).
 */
const userSockets = new Map<string, Set<string>>();
let ioInstance: SocketIOServer | null = null;

export function getIO(): SocketIOServer {
  if (!ioInstance) throw new Error('Socket.io not initialized yet');
  return ioInstance;
}

function addUserSocket(userId: string, socketId: string) {
  const existing = userSockets.get(userId) ?? new Set();
  existing.add(socketId);
  userSockets.set(userId, existing);
}

function removeUserSocket(userId: string, socketId: string) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

export function getUserSocketIds(userId: string): string[] {
  return Array.from(userSockets.get(userId) ?? []);
}

export function initSocket(app: FastifyInstance) {
  ioInstance = new SocketIOServer(app.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  // JWT auth middleware
  ioInstance!.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyToken(token);
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  ioInstance!.on('connection', async (socket) => {
    const userId = (socket as any).userId as string;
    console.log(`[socket] user connected: ${userId} (socket: ${socket.id})`);

    addUserSocket(userId, socket.id);

    // Broadcast online to friends
    const friendIds = await getFriendIds(userId);
    for (const friendId of friendIds) {
      const friendSockets = getUserSocketIds(friendId);
      for (const sid of friendSockets) {
        ioInstance!.to(sid).emit('user:online', { userId });
      }
    }

    // Handle chat:send
    socket.on('chat:send', async (payload: { receiverId: string; content: string }) => {
      const { receiverId, content } = payload;

      if (!receiverId || !content?.trim()) return;

      // Verify they are friends
      const areFriends = await checkFriendship(userId, receiverId);
      if (!areFriends) {
        socket.emit('chat:error', { message: 'Not friends with this user' });
        return;
      }

      // Persist message
      const [message] = await db
        .insert(chatMessages)
        .values({
          senderId: userId,
          receiverId,
          content: content.trim(),
        })
        .returning();

      const messageData = {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        content: message.content,
        read: message.read,
        createdAt: message.createdAt.toISOString(),
      };

      // Send to receiver's sockets
      const receiverSockets = getUserSocketIds(receiverId);
      for (const sid of receiverSockets) {
        ioInstance!.to(sid).emit('chat:message', messageData);
      }

      // Send back to sender for confirmation
      socket.emit('chat:message', messageData);

      // Notify the receiver about the new message (fire-and-forget)
      createNotification({
        userId: receiverId,
        type: 'new_message',
        fromUserId: userId,
        metadata: { content: content.trim().slice(0, 100) },
      }).catch(() => {});
    });

    // ── Challenge events ────────────────────────────────────────────

    socket.on('challenge:send', async (payload: { receiverId: string }) => {
      const { receiverId } = payload;

      // Check sender doesn't already have a pending challenge (prevent spam)
      for (const [, ch] of matchService.challenges) {
        if (ch.challengerId === userId) {
          socket.emit('challenge:error', { message: 'You already have a pending challenge' });
          return;
        }
      }

      const [challengerUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      if (!challengerUser) {
        socket.emit('challenge:error', { message: 'User not found' });
        return;
      }

      const challengeId = matchService.createChallenge(userId, receiverId);

      // Emit challenge:invite to all receiver sockets with full challenger profile
      const receiverSocketIds = getUserSocketIds(receiverId);
      for (const sid of receiverSocketIds) {
        ioInstance!.to(sid).emit('challenge:invite', {
          challengeId,
          challenger: userToProfile(challengerUser),
        });
      }
    });

    socket.on('challenge:cancel', (payload: { challengeId: string }) => {
      matchService.cancelChallenge(payload.challengeId);
      // No emit needed — sender cancelled proactively
    });

    socket.on('challenge:accept', async (payload: { challengeId: string }) => {
      const challenge = matchService.acceptChallenge(payload.challengeId);
      if (!challenge) {
        socket.emit('challenge:error', { message: 'Challenge not found or expired' });
        return;
      }

      const matchState = await matchService.generateMatch(challenge.challengerId, challenge.receiverId);
      const room = matchState.id;

      // Join current socket to the room
      socket.join(room);

      // Join all of the challenger's sockets to the room
      const challengerSids = getUserSocketIds(challenge.challengerId);
      for (const sid of challengerSids) {
        const sock = ioInstance!.sockets.sockets.get(sid);
        if (sock) sock.join(room);
      }

      // Join all of the accepter's OTHER sockets to the room
      const accepterSids = getUserSocketIds(challenge.receiverId);
      for (const sid of accepterSids) {
        if (sid !== socket.id) {
          const sock = ioInstance!.sockets.sockets.get(sid);
          if (sock) sock.join(room);
        }
      }

      // Emit challenge:accepted to challenger
      const firstChallengerSid = challengerSids[0];
      if (firstChallengerSid) {
        ioInstance!.to(firstChallengerSid).emit('challenge:accepted', {
          challengeId: payload.challengeId,
          matchId: matchState.id,
        });
      }

      // Look up both user profiles for match:start payloads
      const [matchChallengerUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, challenge.challengerId));
      const [matchReceiverUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, challenge.receiverId));
      if (!matchChallengerUser || !matchReceiverUser) {
        socket.emit('challenge:error', { message: 'User data not found' });
        return;
      }

      const challengerProfile = userToProfile(matchChallengerUser);
      const receiverProfile = userToProfile(matchReceiverUser);

      // Emit match:start to both players SEPARATELY — each gets own opponent + own first question
      const challengerSids2 = getUserSocketIds(challenge.challengerId);
      const challengerFirstQ = matchState.questionPool[matchState.playerAOrder[0]];
      for (const sid of challengerSids2) {
        ioInstance!.to(sid).emit('match:start', {
          matchId: matchState.id,
          opponent: receiverProfile,
          timeLimitMs: matchState.timerDurationMs,
          question: stripQuestionSensitiveFields(challengerFirstQ),
        });
      }

      const accepterSids2 = getUserSocketIds(challenge.receiverId);
      const accepterFirstQ = matchState.questionPool[matchState.playerBOrder[0]];
      for (const sid of accepterSids2) {
        ioInstance!.to(sid).emit('match:start', {
          matchId: matchState.id,
          opponent: challengerProfile,
          timeLimitMs: matchState.timerDurationMs,
          question: stripQuestionSensitiveFields(accepterFirstQ),
        });
      }

      // Start the match timer
      matchService.startMatchTimer(matchState.id);
    });

    socket.on('challenge:decline', (payload: { challengeId: string }) => {
      const challenge = matchService.getChallenge(payload.challengeId);
      if (!challenge) {
        socket.emit('challenge:error', { message: 'Challenge not found' });
        return;
      }

      matchService.declineChallenge(payload.challengeId);

      // Emit challenge:declined to challenger
      const challengerSids = getUserSocketIds(challenge.challengerId);
      for (const sid of challengerSids) {
        ioInstance!.to(sid).emit('challenge:declined', { challengeId: payload.challengeId });
      }
    });

    // ── Match events ────────────────────────────────────────────────

    socket.on('match:answer', (payload: { matchId: string; optionIndex: number }) => {
      const result = matchService.submitAnswer(payload.matchId, userId, payload.optionIndex);
      if (!result) return;

      // Emit next question to THIS socket only
      if (result.nextQuestion && !result.matchEnded) {
        socket.emit('match:question', {
          matchId: payload.matchId,
          question: stripQuestionSensitiveFields(result.nextQuestion),
        });
      }

      // Emit match:opponent_answered to opponent's sockets
      const match = matchService.matches.get(payload.matchId);
      if (match) {
        const opponentId = match.playerA.userId === userId
          ? match.playerB.userId
          : match.playerA.userId;
        const opponentSids = getUserSocketIds(opponentId);
        for (const sid of opponentSids) {
          ioInstance!.to(sid).emit('match:opponent_answered', { matchId: payload.matchId });
        }
      }

      // If match ended, emit match:end to the room
      if (result.matchEnded) {
        const ms = matchService.matches.get(payload.matchId);
        if (ms) {
          ioInstance!.to(payload.matchId).emit('match:end', {
            matchId: payload.matchId,
            winnerId: ms.winnerId,
            reason: 'both_finished',
            players: [
              buildPlayerStats(ms.playerA),
              buildPlayerStats(ms.playerB),
            ],
          });
        }
      }
    });

    socket.on('match:rejoin', (payload: { matchId: string }) => {
      const rejoinData = matchService.rejoinMatch(payload.matchId, userId);
      if (!rejoinData) {
        socket.emit('match:error', { message: 'Cannot rejoin match' });
        return;
      }

      socket.join(payload.matchId);

      socket.emit('match:rejoined', {
        matchId: payload.matchId,
        remainingMs: rejoinData.remainingMs,
        question: stripQuestionSensitiveFields(rejoinData.question),
        opponentScore: rejoinData.opponentScore,
        opponentCorrectCount: rejoinData.opponentCorrectCount,
      });
    });

    // Handle disconnect — extended with match cleanup
    socket.on('disconnect', () => {
      console.log(`[socket] user disconnected: ${userId} (socket: ${socket.id})`);
      removeUserSocket(userId, socket.id);

      // Match cleanup — inform matchService of disconnect
      matchService.handleDisconnect(userId);

      // If user has no more sockets, broadcast offline
      if (!userSockets.has(userId)) {
        getFriendIds(userId).then((friendIds) => {
          for (const friendId of friendIds) {
            const friendSockets = getUserSocketIds(friendId);
            for (const sid of friendSockets) {
              ioInstance!.to(sid).emit('user:offline', { userId });
            }
          }
        });
      }
    });
  });

  // ─── Multiplayer callbacks ─────────────────────────────────────────
  // These fire from matchService timer/grace logic and need ioInstance.

  matchService.setChallengeTimeoutCallback((challengeId, challengerId) => {
    const challengerSids = getUserSocketIds(challengerId);
    for (const sid of challengerSids) {
      ioInstance!.to(sid).emit('challenge:timeout', { challengeId });
    }
  });

  matchService.setForfeitCallback((matchId, _userId) => {
    const match = matchService.matches.get(matchId);
    if (!match) return;

    ioInstance!.to(matchId).emit('match:end', {
      matchId,
      winnerId: match.winnerId,
      reason: 'opponent_disconnected',
      players: [
        buildPlayerStats(match.playerA),
        buildPlayerStats(match.playerB),
      ],
    });
  });

  matchService.setMatchTimerEndCallback((matchId) => {
    const match = matchService.matches.get(matchId);
    if (!match) return;

    ioInstance!.to(matchId).emit('match:end', {
      matchId,
      winnerId: match.winnerId,
      reason: 'timer_expired',
      players: [
        buildPlayerStats(match.playerA),
        buildPlayerStats(match.playerB),
      ],
    });
  });

  matchService.setMatchTimerTickCallback((matchId, remainingMs) => {
    ioInstance!.to(matchId).emit('match:timer_tick', { matchId, remainingMs });
  });

  return ioInstance!;
}

// ─── Helpers for multiplayer payloads ────────────────────────────────────

/** Convert a DB user row to a UserProfile payload. */
function userToProfile(u: typeof users.$inferSelect): any {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    bio: u.bio ?? undefined,
    language: u.language,
    joinCode: u.joinCode,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
    lastLogin: u.lastLogin instanceof Date ? u.lastLogin.toISOString() : (u.lastLogin ?? undefined),
  };
}

/** Strip sensitive fields from GeneratedQuestion for client-facing emits. */
function stripQuestionSensitiveFields(q: any): any {
  return {
    id: q.id,
    countryId: q.countryId,
    questionType: q.questionType,
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    flagUrl: q.flagUrl,
    timeLimitMs: q.timeLimitMs,
    questionNumber: q.questionNumber,
  };
}

/** Build a player stats payload from match state for match:end events. */
function buildPlayerStats(p: matchService.PlayerMatchState): any {
  return {
    userId: p.userId,
    score: p.score,
    correctCount: p.correctCount,
    totalAnswered: p.totalAnswered,
    maxStreak: p.maxStreak,
  };
}

export { ioInstance };

/** @internal — reset in-memory state for testing only */
export function __resetForTesting() {
  userSockets.clear();
  ioInstance = null;
}

async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friends)
    .where(
      and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, 'accepted'),
      ),
    );

  return rows.map((r) => (r.userId === userId ? r.friendId : r.userId));
}

async function checkFriendship(userId: string, otherId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(friends)
    .where(
      and(
        or(
          and(eq(friends.userId, userId), eq(friends.friendId, otherId)),
          and(eq(friends.userId, otherId), eq(friends.friendId, userId)),
        ),
        eq(friends.status, 'accepted'),
      ),
    )
    .limit(1);
  return !!row;
}
