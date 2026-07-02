import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import { verifyToken } from '../auth/index.js';
import { db } from '../db/index.js';
import { chatMessages, friends } from '../db/schema/index.js';
import { eq, and, or } from 'drizzle-orm';

/**
 * In-memory map: userId → Set of socket IDs.
 * Resets on deploy — acceptable for MVP (see design.md).
 */
const userSockets = new Map<string, Set<string>>();

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

function getUserSocketIds(userId: string): string[] {
  return Array.from(userSockets.get(userId) ?? []);
}

export function initSocket(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  // JWT auth middleware
  io.use((socket, next) => {
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

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId as string;
    console.log(`[socket] user connected: ${userId} (socket: ${socket.id})`);

    addUserSocket(userId, socket.id);

    // Broadcast online to friends
    const friendIds = await getFriendIds(userId);
    for (const friendId of friendIds) {
      const friendSockets = getUserSocketIds(friendId);
      for (const sid of friendSockets) {
        io.to(sid).emit('user:online', { userId });
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
        io.to(sid).emit('chat:message', messageData);
      }

      // Send back to sender for confirmation
      socket.emit('chat:message', messageData);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[socket] user disconnected: ${userId} (socket: ${socket.id})`);
      removeUserSocket(userId, socket.id);

      // If user has no more sockets, broadcast offline
      if (!userSockets.has(userId)) {
        getFriendIds(userId).then((friendIds) => {
          for (const friendId of friendIds) {
            const friendSockets = getUserSocketIds(friendId);
            for (const sid of friendSockets) {
              io.to(sid).emit('user:offline', { userId });
            }
          }
        });
      }
    });
  });

  return io;
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
