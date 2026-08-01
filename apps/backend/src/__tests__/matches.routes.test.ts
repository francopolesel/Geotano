import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks (available in vi.mock factories) ──────────────────────────
const mockSubmitAnswer = vi.hoisted(() => vi.fn());
const mockFinishMatch = vi.hoisted(() => vi.fn());
const mockGetMatchState = vi.hoisted(() => vi.fn());

const emitMock = vi.hoisted(() => vi.fn());
const toMock = vi.hoisted(() => vi.fn(() => ({ emit: emitMock })));
const ioMock = vi.hoisted(() => ({ to: toMock }));
const mockGetIO = vi.hoisted(() => vi.fn(() => ioMock));
const mockGetUserSocketIds = vi.hoisted(() => vi.fn());

const mockCreateNotification = vi.hoisted(() => vi.fn(() => ({ catch: vi.fn() })));

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  then(resolve: (value: any) => void) {
    resolve([]);
  },
  catch() {},
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));
vi.mock('../auth/index.js', () => ({
  authGuard: vi.fn((request: any, _reply: any, done: any) => {
    request.user = { userId: 'user-1' };
    done?.();
  }),
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock('../services/matchService.js', () => ({
  submitAnswer: mockSubmitAnswer,
  finishMatch: mockFinishMatch,
  getMatchState: mockGetMatchState,
}));
vi.mock('../services/notifications.js', () => ({
  createNotification: mockCreateNotification,
}));
vi.mock('../socket/index.js', () => ({
  getIO: mockGetIO,
  getUserSocketIds: mockGetUserSocketIds,
}));

import { matchRoutes } from '../routes/matches.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

function setupMockDb() {
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.orderBy.mockReturnThis();
  mockDb.limit.mockReturnThis();
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockReturnThis();
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

let app: FastifyInstance;

describe('POST /api/matches/:id/answer — match:finished emit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockDb();
    app = Fastify();
    await app.register(matchRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('emits match:finished to BOTH players’ sockets when the answer completes the match', async () => {
    mockSubmitAnswer.mockResolvedValueOnce({ matchEnded: true, finished: true });
    mockGetMatchState.mockResolvedValueOnce({ player1Id: 'user-1', player2Id: 'user-2' });
    // Multi-device: player 1 has two sockets, player 2 has one.
    mockGetUserSocketIds.mockImplementation((userId: string) =>
      userId === 'user-1' ? ['sid-1a', 'sid-1b'] : ['sid-2'],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/answer',
      payload: { optionIndex: 0 },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetMatchState).toHaveBeenCalledWith('m-1');
    // Every connected socket of both players receives the event.
    expect(toMock).toHaveBeenCalledWith('sid-1a');
    expect(toMock).toHaveBeenCalledWith('sid-1b');
    expect(toMock).toHaveBeenCalledWith('sid-2');
    expect(emitMock).toHaveBeenCalledTimes(3);
    emitMock.mock.calls.forEach((call) => {
      expect(call[0]).toBe('match:finished');
      expect(call[1]).toEqual({ matchId: 'm-1', status: 'completed' });
    });
  });

  it('does NOT emit match:finished when the answer does not end the match', async () => {
    mockSubmitAnswer.mockResolvedValueOnce({ matchEnded: false, finished: true });

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/answer',
      payload: { optionIndex: 0 },
    });

    expect(res.statusCode).toBe(200);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a missing optionIndex and emits nothing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/answer',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('returns 400 when submitAnswer fails and emits nothing', async () => {
    mockSubmitAnswer.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/answer',
      payload: { optionIndex: 2 },
    });

    expect(res.statusCode).toBe(400);
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/matches/:id/finish — match:finished emit', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    setupMockDb();
    app = Fastify();
    await app.register(matchRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('emits match:finished to BOTH players’ sockets when finish completes the match', async () => {
    mockFinishMatch.mockResolvedValueOnce({ finished: true, matchEnded: true });
    mockGetMatchState.mockResolvedValueOnce({ player1Id: 'user-1', player2Id: 'user-2' });
    mockGetUserSocketIds.mockImplementation((userId: string) =>
      userId === 'user-1' ? ['sid-1'] : ['sid-2a', 'sid-2b'],
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/finish',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetMatchState).toHaveBeenCalledWith('m-1');
    expect(toMock).toHaveBeenCalledWith('sid-1');
    expect(toMock).toHaveBeenCalledWith('sid-2a');
    expect(toMock).toHaveBeenCalledWith('sid-2b');
    expect(emitMock).toHaveBeenCalledTimes(3);
    emitMock.mock.calls.forEach((call) => {
      expect(call[0]).toBe('match:finished');
      expect(call[1]).toEqual({ matchId: 'm-1', status: 'completed' });
    });
  });

  it('does NOT emit match:finished when finish does not end the match', async () => {
    mockFinishMatch.mockResolvedValueOnce({ finished: true, matchEnded: false });

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/finish',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('returns 404 when finishMatch returns null and emits nothing', async () => {
    mockFinishMatch.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/m-1/finish',
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    expect(emitMock).not.toHaveBeenCalled();
  });
});
