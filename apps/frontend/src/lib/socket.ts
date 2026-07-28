import { io, Socket } from 'socket.io-client';
import { useFriendsStore } from '../store/friendsStore';
import { useNotificationStore } from '../store/notificationStore';
import { useMultiplayerStore } from '../store/multiplayerStore';
import type { ChallengeInvitePayload, MatchStartPayload, ChatMessage, Notification } from '@geotano/shared';

let socket: Socket | null = null;

type ChatMessageHandler = (message: ChatMessage) => void;
type UserStatusHandler = (payload: { userId: string }) => void;
type NotificationHandler = (notification: Notification) => void;

let onChatMessage: ChatMessageHandler | null = null;
let onUserOnline: UserStatusHandler | null = null;
let onUserOffline: UserStatusHandler | null = null;
let onNotification: NotificationHandler | null = null;

// If VITE_API_URL has an /api suffix (common in production), strip it for socket.io
// Socket.io needs the root server URL, not the API prefix.
const RAW_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const SOCKET_URL = RAW_API_URL ? RAW_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:3001';

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[socket] connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] connection error:', err.message);
  });

  socket.on('chat:message', (data: ChatMessage) => {
    if (onChatMessage) {
      onChatMessage(data);
    }
  });

  socket.on('user:online', (data: { userId: string }) => {
    useFriendsStore.getState().setOnline(data.userId);
    if (onUserOnline) {
      onUserOnline(data);
    }
  });

  socket.on('user:offline', (data: { userId: string }) => {
    useFriendsStore.getState().setOffline(data.userId);
    if (onUserOffline) {
      onUserOffline(data);
    }
  });

  socket.on('notification:new', (data: { notification: Notification }) => {
    useNotificationStore.getState().addNotification(data.notification);
    if (onNotification) {
      onNotification(data.notification);
    }
  });

  socket.on('challenge:invite', (data: ChallengeInvitePayload) => {
    useMultiplayerStore.getState().showChallengeNotification(data);
  });

  socket.on('challenge:accepted', (data: { challengeId: string; matchId: string }) => {
    window.location.href = `/multiplayer/${data.matchId}`;
  });

  // Global match:start listener — handles navigation for the accepter
  // and pre-populates store state before MultiplayerPage mounts
  socket.on('match:start', (payload: MatchStartPayload) => {
    useMultiplayerStore.getState().startMatch(payload);
    // Only navigate if not already on the match page
    if (!window.location.pathname.startsWith(`/multiplayer/${payload.matchId}`)) {
      window.location.href = `/multiplayer/${payload.matchId}`;
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function sendChatMessage(receiverId: string, content: string) {
  if (socket?.connected) {
    socket.emit('chat:send', { receiverId, content });
  }
}

export function setChatMessageHandler(handler: ChatMessageHandler) {
  onChatMessage = handler;
}

export function setUserOnlineHandler(handler: UserStatusHandler) {
  onUserOnline = handler;
}

export function setUserOfflineHandler(handler: UserStatusHandler) {
  onUserOffline = handler;
}

export function setNotificationHandler(handler: NotificationHandler) {
  onNotification = handler;
}

// ── Multiplayer helpers ─────────────────────────────────────────────────────

export function sendChallenge(receiverId: string) {
  if (socket?.connected) {
    socket.emit('challenge:send', { receiverId });
  }
}

export function cancelChallenge() {
  if (socket?.connected) {
    socket.emit('challenge:cancel', {});
  }
}

export function acceptChallenge(challengeId: string) {
  if (socket?.connected) {
    socket.emit('challenge:accept', { challengeId });
  }
}

export function declineChallenge(challengeId: string) {
  if (socket?.connected) {
    socket.emit('challenge:decline', { challengeId });
  }
}

export function submitMatchAnswer(matchId: string, optionIndex: number) {
  if (socket?.connected) {
    socket.emit('match:answer', { matchId, optionIndex });
  }
}
