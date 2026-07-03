import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useFriendsStore } from '../../store/friendsStore';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, sendChatMessage, setChatMessageHandler } from '../../lib/socket';
import { api } from '../../lib/api';
import type { ChatMessage } from '@geotano/shared';

export function ChatPage() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { friends, onlineUsers, fetchFriends } = useFriendsStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeFriend = friends.find((f) => f.friendId === userId);
  const otherUserId = userId || '';
  const isOnline = onlineUsers.has(otherUserId);

  // Track initial load so we skip smooth scroll on first render
  const isFirstRender = useRef(true);

  // Load friends list if not loaded
  useEffect(() => {
    if (friends.length === 0) {
      fetchFriends();
    }
  }, [friends.length, fetchFriends]);

  // Connect socket and set message handler
  useEffect(() => {
    if (!token) return;
    connectSocket(token);

    setChatMessageHandler((message: ChatMessage) => {
      // Only add if it's relevant to this conversation
      if (
        (message.senderId === otherUserId || message.receiverId === otherUserId) &&
        (message.senderId === currentUserId || message.receiverId === currentUserId)
      ) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return () => {
      setChatMessageHandler(() => {});
    };
  }, [token, otherUserId, currentUserId]);

  // Load message history
  useEffect(() => {
    if (!userId) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await api.get<{ messages: ChatMessage[] }>(
          `/chat/${userId}`,
        );
        setMessages(data.messages);
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        setLoadingMessages(false);
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [userId]);

  // Scroll to bottom on new messages.
  // Auto on first render (instant), smooth after that.
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({
      behavior: isFirstRender.current ? 'auto' : 'smooth',
    });
    isFirstRender.current = false;
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !userId) return;

    sendChatMessage(userId, trimmed);
    setInputValue('');
  }, [inputValue, userId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('common.loading')}</p>
      </div>
    );
  }

  if (!userId || !activeFriend) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">Select a friend to chat with</p>
        <button
          onClick={() => navigate('/friends')}
          className="rounded-md min-h-[44px] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          Back to Friends
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col min-h-0">
      {/* Chat header — compact, shrink-0 */}
      <div className="shrink-0 flex items-center gap-3 pb-3">
        <button
          onClick={() => navigate('/friends')}
          className="rounded-md p-2 min-h-[44px] min-w-[44px] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] -ml-2"
          aria-label="Back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="relative shrink-0">
          <UserAvatar
            avatarUrl={activeFriend.avatarUrl}
            username={activeFriend.username}
            displayName={activeFriend.displayName}
            className="h-10 w-10 text-sm"
          />
          {isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--color-background)] bg-green-500" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
            {activeFriend.displayName ?? activeFriend.username}
          </p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="shrink-0 border-b border-[var(--color-border)]" />

      {/* Messages area — flex-1 overflow-y-auto, fills all remaining space */}
      <div
        className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0"
        style={{ overscrollBehavior: 'contain' }}
      >
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-[var(--color-muted-foreground)]">{t('common.loading')}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t('chat.noMessages')}
            </p>
          </div>
        ) : (
          <div className="px-1">
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
                      isMine
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                        : 'bg-[var(--color-muted)] text-[var(--color-foreground)]'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p
                      className={`mt-1 text-right text-[10px] ${
                        isMine
                          ? 'text-[var(--color-primary-foreground)]/70'
                          : 'text-[var(--color-muted-foreground)]'
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area — shrink-0, sticky at the bottom */}
      <div className="shrink-0 flex items-end gap-2 border-t border-[var(--color-border)] pb-safe-bottom pt-3">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.input')}
          className="flex-1 min-h-[44px] rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-base text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)]"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="rounded-xl min-h-[44px] min-w-[44px] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
