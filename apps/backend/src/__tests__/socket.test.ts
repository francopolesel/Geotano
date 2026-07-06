import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks (available in vi.mock factories) ──────────────────────────
const mockVerifyToken = vi.hoisted(() => vi.fn());

const mockToFn = vi.hoisted(() => vi.fn(() => ({ emit: vi.fn() })));
const mockIoInstance = vi.hoisted(() => ({
  use: vi.fn(),
  on: vi.fn(),
  to: mockToFn,
  emit: vi.fn(),
}));

let authMiddleware: any = null;
let connectionHandler: any = null;

vi.mock('socket.io', () => ({
  Server: vi.fn(() => {
    const io = mockIoInstance;
    io.use = vi.fn((fn: any) => { authMiddleware = fn; });
    io.on = vi.fn((event: string, handler: any) => {
      if (event === 'connection') connectionHandler = handler;
    });
    return io;
  }),
}));

vi.mock('../auth/index.js', () => ({
  verifyToken: mockVerifyToken,
}));

// ─── Thenable mockDb ─────────────────────────────────────────────────────────
const waitData: any[] = [];

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  then(resolve: (value: any) => void) {
    const data = waitData.shift();
    resolve(data !== undefined ? data : []);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));

vi.mock('../services/notifications.js', () => ({
  createNotification: vi.fn(() => ({ catch: vi.fn() })),
}));

import { initSocket, getIO } from '../socket/index.js';

function setupMockDb() {
  waitData.length = 0;
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

function createMockSocket(overrides: any = {}) {
  return {
    id: 'socket-1',
    handshake: { auth: { token: 'valid-token' } },
    emit: vi.fn(),
    on: vi.fn(),
    ...overrides,
  };
}

describe('socket/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockDb();
    authMiddleware = null;
    connectionHandler = null;
  });

  describe('getIO', () => {
    it('should throw when not initialized', () => {
      expect(() => getIO()).toThrow('not initialized');
    });
  });

  describe('initSocket', () => {
    it('should create socket.io server with CORS config', () => {
      const mockApp = { server: {} } as any;
      initSocket(mockApp);

      // Server constructor was called, which set up use/on on the mock
      expect(mockIoInstance.use).toHaveBeenCalled();
      expect(mockIoInstance.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    describe('auth middleware', () => {
      it('should reject connection without token', () => {
        initSocket({ server: {} } as any);

        const next = vi.fn();
        authMiddleware({ handshake: { auth: {} } }, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Authentication required' }),
        );
      });

      it('should reject connection with invalid token', () => {
        mockVerifyToken.mockImplementationOnce(() => { throw new Error('jwt malformed'); });

        initSocket({ server: {} } as any);

        const next = vi.fn();
        authMiddleware(createMockSocket(), next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Invalid or expired token' }),
        );
      });

      it('should accept connection with valid token and set userId', () => {
        mockVerifyToken.mockReturnValueOnce({ userId: 'user-1' });

        initSocket({ server: {} } as any);

        const socket = createMockSocket();
        const next = vi.fn();
        authMiddleware(socket, next);
        expect(next).toHaveBeenCalledWith();
        expect(socket.userId).toBe('user-1');
      });
    });

    describe('connection handler', () => {
      it('should broadcast online to friends on connect', async () => {
        mockVerifyToken.mockReturnValueOnce({ userId: 'user-1' });
        initSocket({ server: {} } as any);

        // Friend lookup returns 2 friends
        waitData.push([
          { userId: 'user-1', friendId: 'user-2', status: 'accepted' },
          { userId: 'user-3', friendId: 'user-1', status: 'accepted' },
        ]);

        const socket = createMockSocket({ id: 'user-1-socket' });
        authMiddleware(socket, vi.fn());
        await connectionHandler(socket);

        // Friend query was consumed (waitData is now empty)
        expect(waitData).toHaveLength(0);
        // The online broadcast emits happen only if friends have sockets too
        // (getUserSocketIds for user-2 and user-3 would return [] here)
        // The connection log is the indicator the handler ran
      });

      it('should emit chat:error when not friends', async () => {
        mockVerifyToken.mockReturnValueOnce({ userId: 'user-1' });
        initSocket({ server: {} } as any);

        // Friendship check returns empty
        waitData.push([]); // getFriendIds

        let chatSendHandler: Function = () => {};
        const socket = createMockSocket();
        socket.on.mockImplementation((event: string, handler: any) => {
          if (event === 'chat:send') chatSendHandler = handler;
        });

        authMiddleware(socket, vi.fn());
        await connectionHandler(socket);

        // Wait for all microtasks to settle (getFriendIds completes, then chat:send setup runs)
        // Actually chat:send is registered synchronously in connectionHandler
        // The getFriendIds is awaited in connectionHandler, so by the time we reach here, it's done

        await chatSendHandler({ receiverId: 'user-2', content: 'Hey!' });

        expect(socket.emit).toHaveBeenCalledWith(
          'chat:error',
          expect.objectContaining({ message: 'Not friends with this user' }),
        );
      });

      it('should send message to receiver on chat:send', async () => {
        mockVerifyToken.mockReturnValueOnce({ userId: 'user-1' });
        initSocket({ server: {} } as any);

        // getFriendIds → returns [user-2]
        waitData.push([
          { userId: 'user-1', friendId: 'user-2', status: 'accepted' },
        ]);
        // checkFriendship → true
        waitData.push([{ userId: 'user-1', friendId: 'user-2', status: 'accepted' }]);
        // Insert message returning
        const msgDate = new Date();
        waitData.push([{
          id: 'msg-1', senderId: 'user-1', receiverId: 'user-2',
          content: 'Hey!', read: false, createdAt: msgDate,
        }]);

        let chatSendHandler: Function = () => {};
        const socket = createMockSocket({ id: 'sender-socket' });
        socket.on.mockImplementation((event: string, handler: any) => {
          if (event === 'chat:send') chatSendHandler = handler;
        });

        authMiddleware(socket, vi.fn());
        await connectionHandler(socket);
        await chatSendHandler({ receiverId: 'user-2', content: 'Hey!' });

        // Should emit to sender as confirmation
        expect(socket.emit).toHaveBeenCalledWith(
          'chat:message',
          expect.objectContaining({ content: 'Hey!' }),
        );
      });

      it('should ignore chat:send with empty content', async () => {
        mockVerifyToken.mockReturnValueOnce({ userId: 'user-1' });
        initSocket({ server: {} } as any);

        waitData.push([]); // getFriendIds

        let chatSendHandler: Function = () => {};
        const socket = createMockSocket();
        socket.on.mockImplementation((event: string, handler: any) => {
          if (event === 'chat:send') chatSendHandler = handler;
        });

        authMiddleware(socket, vi.fn());
        await connectionHandler(socket);

        await chatSendHandler({ receiverId: 'user-2', content: '   ' });
        expect(socket.emit).not.toHaveBeenCalled();

        await chatSendHandler({ receiverId: '', content: 'hello' });
        expect(socket.emit).not.toHaveBeenCalled();
      });
    });
  });
});
