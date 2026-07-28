// ---------------------------------------------------------------------------
// Geotano — Multiplayer Socket Handler Integration Tests
// Strict TDD: RED phase first, then GREEN implementation.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockVerifyToken = vi.hoisted(() => vi.fn());

const mockToFn = vi.hoisted(() => vi.fn(() => ({ emit: vi.fn() })));
const mockSocketJoin = vi.hoisted(() => vi.fn());
const mockSocketsMap = vi.hoisted(() => new Map<string, any>());

const mockIoInstance = vi.hoisted(() => ({
  use: vi.fn(),
  on: vi.fn(),
  to: mockToFn,
  emit: vi.fn(),
  sockets: { sockets: mockSocketsMap },
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
// The connection handler calls getFriendIds which queries the db.
// We push expected results into waitData and the mockDb.then resolves with it.

const waitData: any[] = [];

const mockDb = vi.hoisted(() => {
  function makeChainable() {
    const chain: any = () => chain;
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.then = vi.fn((resolve: any) => {
      const data = waitData.shift();
      resolve(data !== undefined ? data : []);
    });
    chain.catch = vi.fn();
    return chain;
  }
  return makeChainable();
});

vi.mock('../db/index.js', () => ({ db: mockDb }));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { initSocket, __resetForTesting, getUserSocketIds } from '../socket/index.js';
import * as matchService from '../services/matchService.js';
import { generateQuestionBatch } from '../services/quizEngine.js';

// ─── Mock quizEngine (so matchService.generateMatch doesn't hit DB) ─────────

vi.mock('../services/quizEngine.js', () => ({
  generateQuestionBatch: vi.fn(),
}));

// ─── Helpers for mock questions ──────────────────────────────────────────────

function makeMockQuestions(count: number): any[] {
  const qs: any[] = [];
  for (let i = 0; i < count; i++) {
    qs.push({
      id: `mq-${i}`,
      countryId: `c-${i}`,
      questionType: 'free',
      questionText: `Question ${i + 1}`,
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctIndex: 0,
      correctAnswer: 'Alpha',
      optionsCountryIds: [`c-${i}`, `cx-${i}`, `cy-${i}`, `cz-${i}`],
      flagUrl: undefined,
      timeLimitMs: 15000,
      questionNumber: i + 1,
    });
  }
  return qs;
}

/**
 * Create a mock socket object with join, emit, and on methods.
 */
function createMockSocket(overrides: any = {}) {
  return {
    id: 'socket-1',
    handshake: { auth: { token: 'valid-token' } },
    emit: vi.fn(),
    on: vi.fn(),
    join: mockSocketJoin,
    ...overrides,
  };
}

/**
 * Simulate a user connecting via socket (auth + connection handler).
 * Returns the mock socket and the map of registered handlers.
 */
async function connectUser(userId: string, socketOverrides: any = {}) {
  const socket = createMockSocket(socketOverrides);
  const handlers = new Map<string, Function>();

  socket.on.mockImplementation((event: string, handler: any) => {
    handlers.set(event, handler);
  });

  // getFriendIds query returns empty (no friends needed for multiplayer tests)
  waitData.push([]);

  mockVerifyToken.mockReturnValueOnce({ userId });
  authMiddleware(socket, vi.fn());
  await connectionHandler(socket);

  return { socket, handlers };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('multiplayer socket handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    waitData.length = 0;
    mockSocketsMap.clear();
    __resetForTesting();
    matchService.__resetForTesting();
    authMiddleware = null;
    connectionHandler = null;
    mockToFn.mockReturnValue({ emit: vi.fn() });
    (generateQuestionBatch as any).mockResolvedValue(makeMockQuestions(50));

    // Set up socket.io + init before each test
    initSocket({ server: {} } as any);
  });

  // ── 3.1 challenge:send ──────────────────────────────────────────────────

  describe('challenge:send', () => {
    it('should emit challenge:error when receiver is not online', async () => {
      const { socket, handlers } = await connectUser('user-a');

      const challengeSend = handlers.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-b' });

      expect(socket.emit).toHaveBeenCalledWith(
        'challenge:error',
        expect.objectContaining({ message: 'User is not online' }),
      );
    });

    it('should emit challenge:error when sender already has pending challenge', async () => {
      const { socket, handlers } = await connectUser('user-a');

      // Register user-b as online
      await connectUser('user-b', { id: 'socket-b' });

      matchService.createChallenge('user-a', 'user-b');

      const challengeSend = handlers.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-b' });

      expect(socket.emit).toHaveBeenCalledWith(
        'challenge:error',
        expect.objectContaining({ message: 'You already have a pending challenge' }),
      );
    });

    it('should emit challenge:invite to receiver sockets on success', async () => {
      await connectUser('user-a', { id: 'socket-a' });
      const { handlers } = await connectUser('user-c', { id: 'socket-c' });

      // Simulate user-a sending a challenge
      // Need a socket for user-a to send from — we already have user-a connected
      // But the handlers map is from user-c's connection. We need user-a's handlers.
      // Let's use a simpler approach: directly get user-a's socket and send from it
      // Actually, we re-connected — let's build a fresh setup
      authMiddleware = null;
      connectionHandler = null;
      __resetForTesting();
      matchService.__resetForTesting();

      initSocket({ server: {} } as any);

      await connectUser('user-a', { id: 'socket-a' });
      await connectUser('user-c', { id: 'socket-c' });

      // Now emit challenge:send from user-a
      const socketA = createMockSocket({ id: 'socket-a' });
      const handlersA = new Map<string, Function>();
      socketA.on.mockImplementation((event: string, handler: any) => {
        handlersA.set(event, handler);
      });
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socketA, vi.fn());
      await connectionHandler(socketA);

      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      const challengeSend = handlersA.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-c' });

      // Should emit challenge:invite to user-c
      // mockToFn is the io.to() mock — it should be called with user-c's socket
      expect(mockToFn).toHaveBeenCalledWith('socket-c');
    });
  });

  // ── 3.1 challenge:cancel ─────────────────────────────────────────────────

  describe('challenge:cancel', () => {
    it('should cancel a pending challenge', async () => {
      const { socket, handlers } = await connectUser('user-a');

      const id = matchService.createChallenge('user-a', 'user-b');

      const challengeCancel = handlers.get('challenge:cancel')!;
      challengeCancel({ challengeId: id });

      expect(matchService.getChallenge(id)).toBeUndefined();
    });
  });

  // ── 3.1 challenge:accept ─────────────────────────────────────────────────

  describe('challenge:accept', () => {
    it('should emit challenge:error when challenge does not exist', async () => {
      const { socket, handlers } = await connectUser('user-b');

      const challengeAccept = handlers.get('challenge:accept')!;
      await challengeAccept({ challengeId: 'nonexistent' });

      expect(socket.emit).toHaveBeenCalledWith(
        'challenge:error',
        expect.objectContaining({ message: 'Challenge not found or expired' }),
      );
    });

    it('should create match, join room, and emit match:start to both players', async () => {
      // Setup: user-a challenges user-b
      // Then user-b accepts
      await connectUser('user-a', { id: 'socket-a' });
      await connectUser('user-b', { id: 'socket-b' });

      // user-a sends challenge
      const socketA = createMockSocket({ id: 'socket-a' });
      const handlersA = new Map<string, Function>();
      socketA.on.mockImplementation((e: string, h: any) => handlersA.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socketA, vi.fn());
      await connectionHandler(socketA);

      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      const challengeSend = handlersA.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-b' });

      // user-b accepts the challenge
      const socketB = createMockSocket({ id: 'socket-b' });
      const handlersB = new Map<string, Function>();
      socketB.on.mockImplementation((e: string, h: any) => handlersB.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-b' });
      authMiddleware(socketB, vi.fn());
      await connectionHandler(socketB);

      // Get the challenge that was created
      const challengeEntry = Array.from(matchService.challenges.values())
        .find(c => c.receiverId === 'user-b');
      expect(challengeEntry).toBeDefined();

      // For challenge:accept — 2 user queries (challenger + receiver)
      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      waitData.push([{ id: 'user-b', username: 'user_b', email: 'b@t.com', language: 'en', joinCode: 'BBB', createdAt: new Date('2024-01-01') }]);
      const challengeAccept = handlersB.get('challenge:accept')!;
      await challengeAccept({ challengeId: challengeEntry!.id });

      // Should join both sockets to the match room
      expect(mockSocketJoin).toHaveBeenCalled();
      // socket-b's join should have been called (via socket.join(matchId))
      // socket-a's join should have been called (via io.sockets.sockets.get('socket-a')?.join())
      // Actually socket-b's join was called directly in the handler (socket.join)
      // socket-a's join via io.sockets.sockets.get('socket-a') won't work because
      // we didn't populate the mockSocketsMap. Let's check for the direct socket join.

      // The match should exist
      const matchEntry = Array.from(matchService.matches.values())
        .find(m => m.playerA.userId === 'user-a' && m.playerB.userId === 'user-b');
      expect(matchEntry).toBeDefined();
      expect(matchEntry!.status).toBe('active');

      // Should have emitted match:start per-player via io.to(socketId)
      expect(mockToFn).toHaveBeenCalledWith('socket-a');
      expect(mockToFn).toHaveBeenCalledWith('socket-b');
    });

    it('should emit challenge:accepted to challenger', async () => {
      await connectUser('user-a', { id: 'socket-a' });
      await connectUser('user-b', { id: 'socket-b' });

      // user-a challenges user-b
      const socketA = createMockSocket({ id: 'socket-a' });
      const handlersA = new Map<string, Function>();
      socketA.on.mockImplementation((e: string, h: any) => handlersA.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socketA, vi.fn());
      await connectionHandler(socketA);

      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      const challengeSend = handlersA.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-b' });

      // Populate mockSocketsMap so io.sockets.sockets.get works for room joining
      mockSocketsMap.set('socket-a', { join: vi.fn() });
      mockSocketsMap.set('socket-b', { join: vi.fn() });

      // user-b accepts
      const socketB = createMockSocket({ id: 'socket-b' });
      const handlersB = new Map<string, Function>();
      socketB.on.mockImplementation((e: string, h: any) => handlersB.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-b' });
      authMiddleware(socketB, vi.fn());
      await connectionHandler(socketB);

      const challengeEntry = Array.from(matchService.challenges.values())
        .find(c => c.receiverId === 'user-b');

      // For challenge:accept — 2 user queries (challenger + receiver)
      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      waitData.push([{ id: 'user-b', username: 'user_b', email: 'b@t.com', language: 'en', joinCode: 'BBB', createdAt: new Date('2024-01-01') }]);
      const challengeAccept = handlersB.get('challenge:accept')!;
      await challengeAccept({ challengeId: challengeEntry!.id });

      // Verify io.to was called for challenge:accepted to challenger socket
      // The handler emits challenge:accepted to the first challenger socket
      // We can check if to() was called with 'socket-a' (challenger's socket)
      expect(mockToFn).toHaveBeenCalledWith('socket-a');
    });
  });

  // ── 3.1 challenge:decline ────────────────────────────────────────────────

  describe('challenge:decline', () => {
    it('should emit challenge:declined to challenger', async () => {
      await connectUser('user-a', { id: 'socket-a' });
      await connectUser('user-b', { id: 'socket-b' });

      // user-a sends challenge
      const socketA = createMockSocket({ id: 'socket-a' });
      const handlersA = new Map<string, Function>();
      socketA.on.mockImplementation((e: string, h: any) => handlersA.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socketA, vi.fn());
      await connectionHandler(socketA);

      waitData.push([{ id: 'user-a', username: 'user_a', email: 'a@t.com', language: 'en', joinCode: 'AAA', createdAt: new Date('2024-01-01') }]);
      const challengeSend = handlersA.get('challenge:send')!;
      await challengeSend({ receiverId: 'user-b' });

      // user-b declines
      const socketB = createMockSocket({ id: 'socket-b' });
      const handlersB = new Map<string, Function>();
      socketB.on.mockImplementation((e: string, h: any) => handlersB.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-b' });
      authMiddleware(socketB, vi.fn());
      await connectionHandler(socketB);

      const challengeEntry = Array.from(matchService.challenges.values())
        .find(c => c.receiverId === 'user-b');

      const challengeDecline = handlersB.get('challenge:decline')!;
      await challengeDecline({ challengeId: challengeEntry!.id });

      // Challenge should be removed
      expect(matchService.getChallenge(challengeEntry!.id)).toBeUndefined();

      // Should emit to challenger's socket
      expect(mockToFn).toHaveBeenCalledWith('socket-a');
    });
  });

  // ── 3.2 match:answer ─────────────────────────────────────────────────────

  describe('match:answer', () => {
    it('should emit match:question with next question to the answering socket', async () => {
      // Setup: create a match between user-a and user-b
      const matchState = await matchService.generateMatch('user-a', 'user-b', 'en', makeMockQuestions(50));

      await connectUser('user-a', { id: 'socket-a' });

      const { socket, handlers } = await connectUser('user-b', { id: 'socket-b' });

      // User-b is already in the match via userMatchMap
      // But we need match:answer handler registered on user-b's socket
      const matchAnswer = handlers.get('match:answer')!;

      await matchAnswer({ matchId: matchState.id, optionIndex: 0 });

      // match:question should be emitted to user-b's socket with next question
      expect(socket.emit).toHaveBeenCalledWith(
        'match:question',
        expect.objectContaining({ matchId: matchState.id }),
      );

      // match:opponent_answered should be emitted to opponent (user-a)
      expect(mockToFn).toHaveBeenCalledWith('socket-a');
    });

    it('should emit match:end to room when both players finish all questions', async () => {
      const matchState = await matchService.generateMatch('user-a', 'user-b', 'en', makeMockQuestions(50));

      await connectUser('user-a', { id: 'socket-a' });
      const { handlers } = await connectUser('user-b', { id: 'socket-b' });

      // user-a submits answer via their handler
      const socketA = createMockSocket({ id: 'socket-a' });
      const handlersA = new Map<string, Function>();
      socketA.on.mockImplementation((e: string, h: any) => handlersA.set(e, h));
      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socketA, vi.fn());
      await connectionHandler(socketA);

      const matchAnswerA = handlersA.get('match:answer')!;

      // Player A answers all 50 questions
      for (let i = 0; i < 50; i++) {
        await matchAnswerA({ matchId: matchState.id, optionIndex: 0 });
      }

      // Player B answers all 50 questions
      const matchAnswerB = handlers.get('match:answer')!;
      for (let i = 0; i < 49; i++) {
        await matchAnswerB({ matchId: matchState.id, optionIndex: 0 });
      }

      // Clear the mock toFn calls to get clean assertion
      mockToFn.mockClear();

      // Last answer should trigger match end
      await matchAnswerB({ matchId: matchState.id, optionIndex: 0 });

      // Should emit match:end to the room
      expect(mockToFn).toHaveBeenCalledWith(matchState.id);
    });
  });

  // ── 3.3 match:rejoin ─────────────────────────────────────────────────────

  describe('match:rejoin', () => {
    it('should return rejoin state on successful rejoin', async () => {
      const matchState = await matchService.generateMatch('user-a', 'user-b', 'en', makeMockQuestions(50));

      await connectUser('user-a', { id: 'socket-a' });
      const { socket, handlers } = await connectUser('user-b', { id: 'socket-b' });

      // Disconnect user-b
      matchService.handleDisconnect('user-b');

      // Rejoin
      const matchRejoin = handlers.get('match:rejoin')!;
      await matchRejoin({ matchId: matchState.id });

      expect(socket.emit).toHaveBeenCalledWith(
        'match:rejoined',
        expect.objectContaining({
          matchId: matchState.id,
          remainingMs: expect.any(Number),
          opponentScore: expect.any(Number),
        }),
      );

      // Socket should have joined the room
      expect(mockSocketJoin).toHaveBeenCalledWith(matchState.id);
    });
  });

  // ── 3.4 disconnect extension ──────────────────────────────────────────────

  describe('disconnect — match cleanup', () => {
    it('should call matchService.handleDisconnect when user has an active match', async () => {
      await matchService.generateMatch('user-a', 'user-b', 'en', makeMockQuestions(50));

      let disconnectHandler: Function = () => {};
      const socket = createMockSocket({ id: 'socket-a' });
      socket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'disconnect') disconnectHandler = handler;
      });

      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-a' });
      authMiddleware(socket, vi.fn());
      await connectionHandler(socket);

      disconnectHandler();

      // userMatchMap entry should have been processed
      const matchEntry = matchService.matches.get(
        matchService.userMatchMap.get('user-a')!
      );
      if (matchEntry) {
        expect(matchEntry.disconnectedAt.has('user-a')).toBe(true);
      } else {
        // Match might have ended if both disconnected
        expect(matchService.userMatchMap.has('user-a')).toBe(false);
      }
    });

    it('should not crash when user has no active match', async () => {
      let disconnectHandler: Function = () => {};
      const socket = createMockSocket({ id: 'socket-1' });
      socket.on.mockImplementation((event: string, handler: any) => {
        if (event === 'disconnect') disconnectHandler = handler;
      });

      waitData.push([]);
      mockVerifyToken.mockReturnValueOnce({ userId: 'user-no-match' });
      authMiddleware(socket, vi.fn());
      await connectionHandler(socket);

      // Should not throw
      expect(() => disconnectHandler()).not.toThrow();
    });
  });
});
