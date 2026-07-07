import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

const mockIo = vi.fn(() => mockSocket);

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

// ─── Socket Lib ─────────────────────────────────────────────────────────────

describe('socket', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module-level socket state between tests
    const { disconnectSocket } = await import('../lib/socket');
    disconnectSocket();
  });

  it('getSocket returns null when not connected', async () => {
    const { getSocket } = await import('../lib/socket');
    expect(getSocket()).toBeNull();
  });

  it('connectSocket creates socket with correct URL and auth', async () => {
    const { connectSocket } = await import('../lib/socket');

    const socket = connectSocket('test-token');

    expect(mockIo).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/localhost:3001$/),
      expect.objectContaining({ auth: { token: 'test-token' } }),
    );
    expect(socket).toBeDefined();
  });

  it('connectSocket returns existing socket when already connected', async () => {
    const { connectSocket } = await import('../lib/socket');

    const first = connectSocket('token-1');
    const second = connectSocket('token-2');

    expect(mockIo).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('sendChatMessage emits chat:send if connected', async () => {
    const { connectSocket, sendChatMessage } = await import('../lib/socket');

    connectSocket('test-token');

    sendChatMessage('user-1', 'Hello!');

    expect(mockSocket.emit).toHaveBeenCalledWith('chat:send', {
      receiverId: 'user-1',
      content: 'Hello!',
    });
  });

  it('sendChatMessage does nothing if not connected', async () => {
    const { sendChatMessage } = await import('../lib/socket');

    sendChatMessage('user-1', 'Hello!');

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('disconnectSocket disconnects and nullifies', async () => {
    const { connectSocket, disconnectSocket, getSocket } = await import('../lib/socket');

    connectSocket('test-token');
    expect(getSocket()).not.toBeNull();

    disconnectSocket();

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(getSocket()).toBeNull();
  });

  // ─── Console logging ────────────────────────────────────────────────────────

  describe('console logging', () => {
    const originalLog = console.log;
    const originalError = console.error;

    afterEach(() => {
      console.log = originalLog;
      console.error = originalError;
    });

    it('calls console.log on connect event', async () => {
      const logSpy = vi.fn();
      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      console.log = logSpy as unknown as typeof console.log;

      const callback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect',
      )?.[1];
      callback();

      expect(logSpy).toHaveBeenCalledWith('[socket] connected');
    });

    it('calls console.log on disconnect event', async () => {
      const logSpy = vi.fn();
      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      console.log = logSpy as unknown as typeof console.log;

      const callback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect',
      )?.[1];
      callback('transport close');

      expect(logSpy).toHaveBeenCalledWith(
        '[socket] disconnected:',
        'transport close',
      );
    });

    it('calls console.error on connect_error event', async () => {
      const errorSpy = vi.fn();
      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      console.error = errorSpy as unknown as typeof console.error;

      const callback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error',
      )?.[1];
      callback({ message: 'Connection refused' });

      expect(errorSpy).toHaveBeenCalledWith(
        '[socket] connection error:',
        'Connection refused',
      );
    });
  });

  describe('handler registration and invocation', () => {
    beforeEach(async () => {
      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');
    });

    it('setUserOfflineHandler callback fires on user:offline event', async () => {
      const { setUserOfflineHandler } = await import('../lib/socket');

      const handler = vi.fn();
      setUserOfflineHandler(handler);

      const userOfflineCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'user:offline',
      )?.[1];

      expect(userOfflineCallback).toBeDefined();

      const payload = { userId: 'user-123' };
      userOfflineCallback(payload);

      // The handler registered via setUserOfflineHandler should be called
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('setNotificationHandler callback fires on notification:new event', async () => {
      const { setNotificationHandler } = await import('../lib/socket');

      const handler = vi.fn();
      setNotificationHandler(handler);

      const notifCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'notification:new',
      )?.[1];

      expect(notifCallback).toBeDefined();

      const payload = { notification: { id: 'n-1', type: 'friend_request', message: 'New request', createdAt: '' } };
      notifCallback(payload);

      expect(handler).toHaveBeenCalledWith(payload.notification);
    });

    it('does not throw when handler is not set for user:offline', async () => {
      const userOfflineCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'user:offline',
      )?.[1];

      expect(() => {
        userOfflineCallback({ userId: 'user-123' });
      }).not.toThrow();
    });

    it('does not throw when handler is not set for notification:new', async () => {
      const notifCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'notification:new',
      )?.[1];

      expect(() => {
        notifCallback({ notification: { id: 'n-1', type: 'friend_request', message: '', createdAt: '' } });
      }).not.toThrow();
    });

    it('setChatMessageHandler stores and calls handler on chat:message', async () => {
      const { setChatMessageHandler } = await import('../lib/socket');

      const handler = vi.fn();
      setChatMessageHandler(handler);

      const chatCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'chat:message',
      )?.[1];
      expect(chatCallback).toBeDefined();

      const payload = { id: 'm-1', senderId: 'u-1', content: 'Hello' };
      chatCallback(payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('setUserOnlineHandler stores and calls handler on user:online', async () => {
      const { setUserOnlineHandler } = await import('../lib/socket');

      const handler = vi.fn();
      setUserOnlineHandler(handler);

      const onlineCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'user:online',
      )?.[1];
      expect(onlineCallback).toBeDefined();

      const payload = { userId: 'user-456' };
      onlineCallback(payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  // ─── VITE_API_URL / SOCKET_URL ──────────────────────────────────────────────

  describe('SOCKET_URL with VITE_API_URL set', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('should strip /api suffix when VITE_API_URL ends with /api', async () => {
      vi.stubEnv('VITE_API_URL', 'http://example.com/api');
      vi.resetModules();

      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      expect(mockIo).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({ auth: { token: 'test-token' } }),
      );
    });

    it('should strip /api/ suffix with trailing slash', async () => {
      vi.stubEnv('VITE_API_URL', 'http://example.com/api/');
      vi.resetModules();

      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      expect(mockIo).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({ auth: { token: 'test-token' } }),
      );
    });

    it('should use VITE_API_URL as-is when it has no /api suffix', async () => {
      vi.stubEnv('VITE_API_URL', 'http://custom-server:4000');
      vi.resetModules();

      const { connectSocket } = await import('../lib/socket');
      connectSocket('test-token');

      expect(mockIo).toHaveBeenCalledWith(
        'http://custom-server:4000',
        expect.objectContaining({ auth: { token: 'test-token' } }),
      );
    });
  });
});
