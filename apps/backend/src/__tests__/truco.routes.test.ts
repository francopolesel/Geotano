import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks (available in vi.mock factories) ──────────────────────────
// Route tests mock the SERVICE layer (not the db) — routes must stay thin
// translators. Socket emission is asserted through the io/to/emit chain.

const mockCreateMatch = vi.hoisted(() => vi.fn());
const mockJoinByCode = vi.hoisted(() => vi.fn());
const mockStartTrucoMatch = vi.hoisted(() => vi.fn());
const mockGetTrucoMatchView = vi.hoisted(() => vi.fn());
const mockApplyTrucoAction = vi.hoisted(() => vi.fn());
const mockFindActiveByCode = vi.hoisted(() => vi.fn());

const emitMock = vi.hoisted(() => vi.fn());
const toMock = vi.hoisted(() => vi.fn(() => ({ emit: emitMock })));
const ioMock = vi.hoisted(() => ({ to: toMock }));
const mockGetIO = vi.hoisted(() => vi.fn(() => ioMock));
const mockGetUserSocketIds = vi.hoisted(() => vi.fn());

// authGuard variant that can simulate unauthenticated requests (401).
const mockAuthGuard = vi.hoisted(() => vi.fn());

function authenticateAs(userId: string | null) {
  mockAuthGuard.mockImplementation(async (request: any, reply: any) => {
    if (!userId) {
      return reply.status(401).send({
        errorCode: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
    request.user = { userId };
  });
}

vi.mock('../auth/index.js', () => ({
  authGuard: mockAuthGuard,
  signToken: vi.fn(() => 'mock-token'),
  verifyToken: vi.fn(() => ({ userId: 'user-1' })),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock('../services/trucoService.js', () => ({
  createTrucoMatch: mockCreateMatch,
  joinByCode: mockJoinByCode,
  startTrucoMatch: mockStartTrucoMatch,
  getTrucoMatchView: mockGetTrucoMatchView,
  applyTrucoAction: mockApplyTrucoAction,
  findActiveTrucoMatchByCode: mockFindActiveByCode,
}));
vi.mock('../socket/index.js', () => ({
  getIO: mockGetIO,
  getUserSocketIds: mockGetUserSocketIds,
}));

import { trucoRoutes } from '../routes/truco.js';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeEach(async () => {
  vi.clearAllMocks();
  authenticateAs('user-1');
  app = Fastify();
  await app.register(trucoRoutes);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

/** Multi-device socket map like the repo precedent test. */
function socketsFor(map: Record<string, string[]>) {
  mockGetUserSocketIds.mockImplementation((userId: string) => map[userId] ?? []);
}

function emitted(event: string) {
  return emitMock.mock.calls.filter((c) => c[0] === event).map((c) => c[1]);
}

const OK_CREATE = {
  ok: true,
  matchId: 'tm-1',
  code: 'ABC234',
  status: 'waiting',
  hostPlayerId: 'user-1',
};
const ERR = (httpStatus: number, errorCode: string, message = 'boom') => ({
  ok: false,
  httpStatus,
  errorCode,
  message,
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/truco/matches — create (+ optional friend invite push)
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/truco/matches', () => {
  it('rejects unauthenticated requests with 401', async () => {
    authenticateAs(null);

    const res = await app.inject({ method: 'POST', url: '/api/truco/matches', payload: {} });

    expect(res.statusCode).toBe(401);
    expect(mockCreateMatch).not.toHaveBeenCalled();
  });

  it('creates a match and returns {matchId, code, status}', async () => {
    mockCreateMatch.mockResolvedValueOnce(OK_CREATE);

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches',
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockCreateMatch).toHaveBeenCalledWith('user-1', {});
    expect(res.json()).toEqual({ matchId: 'tm-1', code: 'ABC234', status: 'waiting' });
  });

  it('pushes truco:invite to the invited friend when friendId is present', async () => {
    mockCreateMatch.mockResolvedValueOnce({ ...OK_CREATE, friendId: 'user-2' });
    socketsFor({ 'user-2': ['sid-2a', 'sid-2b'] }); // multi-device friend

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches',
      payload: { friendId: 'user-2', targetPoints: 15 },
    });

    expect(res.statusCode).toBe(200);
    // D9 payload shape: IDs only.
    expect(emitted('truco:invite')).toEqual([
      { matchId: 'tm-1', code: 'ABC234', fromUser: 'user-1' },
      { matchId: 'tm-1', code: 'ABC234', fromUser: 'user-1' },
    ]);
  });

  it('does NOT push an invite without friendId', async () => {
    mockCreateMatch.mockResolvedValueOnce(OK_CREATE);

    await app.inject({ method: 'POST', url: '/api/truco/matches', payload: {} });

    expect(emitMock).not.toHaveBeenCalled();
  });

  it('maps service errors verbatim: 400 MISSING_FIELD and 403 NOT_FRIENDS', async () => {
    mockCreateMatch.mockResolvedValueOnce(ERR(400, 'MISSING_FIELD'));
    const bad = await app.inject({
      method: 'POST',
      url: '/api/truco/matches',
      payload: { targetPoints: 20 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ errorCode: 'MISSING_FIELD' });

    mockCreateMatch.mockResolvedValueOnce(ERR(403, 'NOT_FRIENDS', 'You can only invite friends'));
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/truco/matches',
      payload: { friendId: 'user-9' },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ errorCode: 'NOT_FRIENDS' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/truco/matches/code/:code — S3 ADDITIVE CONVENIENCE ENDPOINT
// Public-minimal join-UX pre-check beyond the delta-spec minimum; intentional
// documented surface for archive. Payload carries {matchId,status} ONLY.
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/truco/matches/code/:code (S3 convenience)', () => {
  it('rejects unauthenticated requests with 401 (participant-surface parity)', async () => {
    authenticateAs(null);

    const res = await app.inject({ method: 'GET', url: '/api/truco/matches/code/ABC234' });

    expect(res.statusCode).toBe(401);
    expect(mockFindActiveByCode).not.toHaveBeenCalled();
  });

  it('returns the public-minimal {matchId, status} for a known code', async () => {
    mockFindActiveByCode.mockResolvedValueOnce({ matchId: 'tm-1', status: 'waiting' });

    const res = await app.inject({ method: 'GET', url: '/api/truco/matches/code/ABC234' });

    expect(res.statusCode).toBe(200);
    expect(mockFindActiveByCode).toHaveBeenCalledWith('ABC234');
    expect(res.json()).toEqual({ matchId: 'tm-1', status: 'waiting' });
  });

  it('returns 404 CODE_NOT_FOUND for unknown/expired codes', async () => {
    mockFindActiveByCode.mockResolvedValueOnce(null);

    const res = await app.inject({ method: 'GET', url: '/api/truco/matches/code/ZZZ999' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ errorCode: 'CODE_NOT_FOUND' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/truco/matches/code/:code/join — seat claim + player-joined push
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/truco/matches/code/:code/join', () => {
  const JOIN_OK = {
    ok: true,
    matchId: 'tm-1',
    players: [
      { userId: 'user-1', nickname: 'Hosty' },
      { userId: 'user-2', nickname: 'guest' },
    ],
  };

  it('joins and pushes truco:player-joined to BOTH players’ sockets', async () => {
    authenticateAs('user-2'); // the joining guest
    mockJoinByCode.mockResolvedValueOnce(JOIN_OK);
    socketsFor({ 'user-1': ['sid-1'], 'user-2': ['sid-2'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/code/ABC234/join',
    });

    expect(res.statusCode).toBe(200);
    expect(mockJoinByCode).toHaveBeenCalledWith('user-2', 'ABC234');
    expect(emitted('truco:player-joined')).toEqual([
      {
        matchId: 'tm-1',
        players: [
          { userId: 'user-1', nickname: 'Hosty' },
          { userId: 'user-2', nickname: 'guest' },
        ],
      },
      {
        matchId: 'tm-1',
        players: [
          { userId: 'user-1', nickname: 'Hosty' },
          { userId: 'user-2', nickname: 'guest' },
        ],
      },
    ]);
  });

  it('maps Third player rejected — 409 match_not_joinable with no push', async () => {
    mockJoinByCode.mockResolvedValueOnce(ERR(409, 'match_not_joinable'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/code/ABC234/join',
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ errorCode: 'match_not_joinable' });
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('maps 404 CODE_NOT_FOUND from the service', async () => {
    mockJoinByCode.mockResolvedValueOnce(ERR(404, 'CODE_NOT_FOUND'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/code/ZZZ999/join',
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ errorCode: 'CODE_NOT_FOUND' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/truco/matches/:id/start — W1 creator-only + state-changed 'start'
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/truco/matches/:id/start', () => {
  it('pins W1 by name: guest start → 403 FORBIDDEN', async () => {
    authenticateAs('user-2'); // the GUEST calls start
    mockStartTrucoMatch.mockResolvedValueOnce(
      ERR(403, 'FORBIDDEN', 'Only the creator can start the match'),
    );

    const res = await app.inject({ method: 'POST', url: '/api/truco/matches/tm-1/start' });

    expect(res.statusCode).toBe(403);
    expect(res.json().errorCode).toBe('FORBIDDEN');
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('starts and pushes state-changed reason "start" carrying IDs/version/reason ONLY', async () => {
    mockStartTrucoMatch.mockResolvedValueOnce({
      ok: true,
      matchId: 'tm-1',
      version: 1,
      status: 'playing',
      hostPlayerId: 'user-1',
      guestPlayerId: 'user-2',
    });
    socketsFor({ 'user-1': ['sid-1'], 'user-2': ['sid-2'] });

    const res = await app.inject({ method: 'POST', url: '/api/truco/matches/tm-1/start' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ matchId: 'tm-1', version: 1, status: 'playing' });
    const payloads = emitted('truco:state-changed');
    expect(payloads).toHaveLength(2); // both players
    for (const p of payloads) {
      expect(p).toEqual({ matchId: 'tm-1', version: 1, reason: 'start' }); // EXACT keys
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/truco/matches/:id — per-viewer snapshot passthrough
// ════════════════════════════════════════════════════════════════════════════

describe('GET /api/truco/matches/:id', () => {
  const SNAPSHOT = {
    ok: true as const,
    matchId: 'tm-1',
    code: 'ABC234',
    status: 'playing',
    version: 5,
    targetPoints: 30,
    hostPlayerId: 'user-1',
    guestPlayerId: 'user-2',
    winnerUserId: null,
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T11:00:00.000Z',
    view: null,
  };

  it('returns the per-viewer snapshot with ISO date strings', async () => {
    mockGetTrucoMatchView.mockResolvedValueOnce(SNAPSHOT);

    const res = await app.inject({ method: 'GET', url: '/api/truco/matches/tm-1' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.createdAt).toBe('2026-08-21T10:00:00.000Z');
    expect(body.updatedAt).toBe('2026-08-21T11:00:00.000Z');
    expect(body.view).toBeNull();
  });

  it('maps 404 MATCH_NOT_FOUND and 403 FORBIDDEN from the service', async () => {
    mockGetTrucoMatchView.mockResolvedValueOnce(ERR(404, 'MATCH_NOT_FOUND'));
    const missing = await app.inject({ method: 'GET', url: '/api/truco/matches/nope' });
    expect(missing.statusCode).toBe(404);

    mockGetTrucoMatchView.mockResolvedValueOnce(ERR(403, 'FORBIDDEN'));
    const forbidden = await app.inject({ method: 'GET', url: '/api/truco/matches/tm-1' });
    expect(forbidden.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/truco/matches/:id/actions — authoritative actions + finish pushes
// ════════════════════════════════════════════════════════════════════════════

describe('POST /api/truco/matches/:id/actions', () => {
  const ACTION_BODY = {
    expectedVersion: 4,
    action: { type: 'play_card', card: '1espada' },
  };

  it('requires expectedVersion (number) and action.type — 400 MISSING_FIELD otherwise', async () => {
    const noVersion = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: { action: { type: 'play_card' } },
    });
    expect(noVersion.statusCode).toBe(400);

    const noAction = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: { expectedVersion: 4 },
    });
    expect(noAction.statusCode).toBe(400);
    expect(mockApplyTrucoAction).not.toHaveBeenCalled();
  });

  it('applies an action and pushes state-changed reason "action" to BOTH players', async () => {
    mockApplyTrucoAction.mockResolvedValueOnce({
      ok: true,
      matchId: 'tm-1',
      version: 5,
      matchEnded: false,
      winnerUserId: null,
      hostPlayerId: 'user-1',
      guestPlayerId: 'user-2',
      view: { myHand: ['7oro'], opponentHandCount: 3, matchId: 'tm-1', version: 5 },
    });
    socketsFor({ 'user-1': ['sid-1'], 'user-2': ['sid-2'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(mockApplyTrucoAction).toHaveBeenCalledWith('tm-1', 'user-1', 4, ACTION_BODY.action);
    const body = res.json();
    expect(body.matchEnded).toBe(false);
    expect(body.version).toBe(5);
    expect(body.view.myHand).toEqual(['7oro']);

    for (const p of emitted('truco:state-changed')) {
      expect(p).toEqual({ matchId: 'tm-1', version: 5, reason: 'action' }); // exact keys
    }
    expect(emitted('truco:finished')).toHaveLength(0);
  });

  it('on match end pushes state-changed "finish" AND truco:finished with winnerUserId', async () => {
    mockApplyTrucoAction.mockResolvedValueOnce({
      ok: true,
      matchId: 'tm-1',
      version: 8,
      matchEnded: true,
      winnerUserId: 'user-1',
      hostPlayerId: 'user-1',
      guestPlayerId: 'user-2',
      view: { myHand: [], opponentHandCount: 0, matchId: 'tm-1', version: 8 },
    });
    socketsFor({ 'user-1': ['sid-1'], 'user-2': ['sid-2'] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().matchEnded).toBe(true);
    for (const p of emitted('truco:state-changed')) {
      expect(p).toEqual({ matchId: 'tm-1', version: 8, reason: 'finish' });
    }
    expect(emitted('truco:finished')).toEqual([
      { matchId: 'tm-1', winnerUserId: 'user-1' },
      { matchId: 'tm-1', winnerUserId: 'user-1' },
    ]);
  });

  it('passes engine rejections through as 400 E_* without pushing anything', async () => {
    mockApplyTrucoAction.mockResolvedValueOnce(ERR(400, 'E_OUT_OF_TURN', 'It is not this player’s turn to act.'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ errorCode: 'E_OUT_OF_TURN' });
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('maps stale versions to 409 version_conflict', async () => {
    mockApplyTrucoAction.mockResolvedValueOnce(ERR(409, 'version_conflict'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ errorCode: 'version_conflict' });
  });

  it('*Replay safety*: verbatim retry after success returns 409 and never double-applies', async () => {
    mockApplyTrucoAction
      .mockResolvedValueOnce({
        ok: true,
        matchId: 'tm-1',
        version: 5,
        matchEnded: false,
        winnerUserId: null,
        hostPlayerId: 'user-1',
        guestPlayerId: 'user-2',
        view: { myHand: [], opponentHandCount: 3, matchId: 'tm-1', version: 5 },
      })
      .mockResolvedValueOnce(ERR(409, 'version_conflict'));

    socketsFor({ 'user-1': ['sid-1'], 'user-2': ['sid-2'] });

    const first = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY,
    });
    const pushesAfterFirst = emitted('truco:state-changed').length;
    expect(pushesAfterFirst).toBeGreaterThan(0);

    const retry = await app.inject({
      method: 'POST',
      url: '/api/truco/matches/tm-1/actions',
      payload: ACTION_BODY, // byte-for-byte identical
    });

    expect(first.statusCode).toBe(200);
    expect(retry.statusCode).toBe(409);
    // The action reached the engine exactly once per submission attempt; the
    // retry was rejected BEFORE any state change (service contract).
    expect(mockApplyTrucoAction).toHaveBeenCalledTimes(2);
    // The verbatim retry pushed NOTHING new — no phantom state change.
    expect(emitted('truco:state-changed').length).toBe(pushesAfterFirst);
  });
});
