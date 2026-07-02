import { io, Socket } from 'socket.io-client';
import { useFriendsStore } from '../store/friendsStore';
import type { ChatMessage } from '@geotano/shared';

let socket: Socket | null = null;

type ChatMessageHandler = (message: ChatMessage) => void;
type UserStatusHandler = (payload: { userId: string }) => void;

let onChatMessage: ChatMessageHandler | null = null;
let onUserOnline: UserStatusHandler | null = null;
let onUserOffline: UserStatusHandler | null = null;

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
