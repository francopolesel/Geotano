import { io, Socket } from 'socket.io-client';
import { useFriendsStore } from '../store/friendsStore';
import { useNotificationStore } from '../store/notificationStore';
import { useMultiplayerStore } from '../store/multiplayerStore';
import { useTrucoInviteStore } from '../store/trucoInviteStore';
import type { ChallengeInvitePayload, ChatMessage, Notification } from '@geotano/shared';

let socket: Socket | null = null;
let navigateFn: ((path: string) => void) | null = null;

export function setNavigateFn(fn: (path: string) => void) {
  navigateFn = fn;
}

type ChatMessageHandler = (message: ChatMessage) => void;
type UserStatusHandler = (payload: { userId: string }) => void;
type NotificationHandler = (notification: Notification) => void;

export type MatchFinishedHandler = (payload: { matchId: string; status: string }) => void;

// ─── Truco pushes (CU6, design D9) ──────────────────────────────────────────

export interface TrucoStateChangePayload {
  matchId: string;
  version: number;
  reason: 'start' | 'action' | 'finish';
}

export interface TrucoInvitePayload {
  matchId: string;
  code: string;
  fromUser: string;
}

export interface TrucoPlayerRef {
  userId: string;
  nickname: string;
}

export interface TrucoPlayerJoinedPayload {
  matchId: string;
  players: TrucoPlayerRef[];
}

export interface TrucoFinishedPayload {
  matchId: string;
  winnerUserId: string | null;
}

/** ONE handler object for every truco push (mirror of setMatchFinishedHandler). */
export interface TrucoHandlers {
  onStateChanged?: (payload: TrucoStateChangePayload) => void;
  onInvite?: (payload: TrucoInvitePayload) => void;
  onPlayerJoined?: (payload: TrucoPlayerJoinedPayload) => void;
  onFinished?: (payload: TrucoFinishedPayload) => void;
}

/**
 * Redaction guard mirrored client-side (D9): server pushes carry
 * IDs/version/reason ONLY — hands travel exclusively through the per-viewer
 * REST DTO. Any push smuggling hand-shaped data is dropped before feature
 * code can ever see it.
 */
const HAND_DATA_KEYS: readonly string[] = ['hands', 'myHand', 'opponentHand', 'deckRemaining'];

function carriesHandData(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const record = payload as Record<string, unknown>;
  return HAND_DATA_KEYS.some((key) => key in record);
}

let onChatMessage: ChatMessageHandler | null = null;
let onUserOnline: UserStatusHandler | null = null;
let onUserOffline: UserStatusHandler | null = null;
let onNotification: NotificationHandler | null = null;
let onMatchFinished: MatchFinishedHandler | null = null;
let trucoHandlers: TrucoHandlers | null = null;

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

  socket.on('challenge:accepted', (data: { matchId: string }) => {
    useMultiplayerStore.getState().dismissChallengeNotification();
    if (navigateFn) {
      navigateFn(`/multiplayer/${data.matchId}`);
    }
  });

  // Registered inside connectSocket so it survives reconnects; the page-scoped
  // handler is set via setMatchFinishedHandler (never direct socket.on per page).
  socket.on('match:finished', (data: { matchId: string; status: string }) => {
    if (onMatchFinished) {
      onMatchFinished(data);
    }
  });

  // CU6 additive truco:* listeners — same register-on-connect setter pattern:
  // pages swap ONE handler object via setTrucoHandlers, so remounts and
  // reconnects keep exactly one delegation point per live socket.
  socket.on('truco:state-changed', (data: TrucoStateChangePayload) => {
    if (carriesHandData(data)) return;
    trucoHandlers?.onStateChanged?.(data);
  });

  socket.on('truco:invite', (data: TrucoInvitePayload) => {
    if (carriesHandData(data)) return;
    // Remediation #11 — invites land in the global store so they are visible
    // from ANY screen; page-scoped onInvite handlers stay as an extra hook.
    useTrucoInviteStore.getState().showInvite(data);
    trucoHandlers?.onInvite?.(data);
  });

  socket.on('truco:player-joined', (data: TrucoPlayerJoinedPayload) => {
    if (carriesHandData(data)) return;
    trucoHandlers?.onPlayerJoined?.(data);
  });

  socket.on('truco:finished', (data: TrucoFinishedPayload) => {
    if (carriesHandData(data)) return;
    trucoHandlers?.onFinished?.(data);
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

export function setMatchFinishedHandler(handler: MatchFinishedHandler | null) {
  onMatchFinished = handler;
}

export function setTrucoHandlers(handlers: TrucoHandlers | null) {
  trucoHandlers = handlers;
}


