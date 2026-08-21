import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

// ─── Hoisted mocks (available in vi.mock factories) ──────────────────────────
// Single FIFO queue shared by every chainable: each awaited query shifts one
// entry. Push an Error instance to make that query REJECT (unique-violation
// retry simulation); push { count: N } to emulate driver rowCount results.

const pendingResults: any[] = [];

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
  // `await chainable` resolves through the CALLBACKS passed into .then —
  // the returned value of a then-method is ignored by await semantics.
  chain.then = (resolve: any, reject?: any) => {
    const data = pendingResults.shift();
    if (data instanceof Error) {
      if (reject) reject(data);
      else throw data;
    } else {
      resolve(data !== undefined ? data : []);
    }
  };
  chain.catch = vi.fn();
  return chain;
}

const mockDb = vi.hoisted(() => {
  // placeholder — replaced below because the factory cannot see helpers
  return {} as any;
});

vi.mock('../db/index.js', () => ({ db: mockDb }));

import {
  ROOM_CODE_ALPHABET,
  generateRoomCode,
  createTrucoMatch,
  joinByCode,
  startTrucoMatch,
  getTrucoMatchView,
  deleteExpiredTrucoMatches,
} from '../services/trucoService.js';
import { trucoMatches } from '../db/schema/index.js';
import type { TrucoState } from '@geotano/shared';

// Wire the chainables + transaction AFTER the hoisted factory ran.
const dbChain = makeChainable();
const txChain = makeChainable();
Object.assign(mockDb, dbChain, {
  transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(txChain)),
});

beforeEach(() => {
  vi.clearAllMocks();
  pendingResults.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const HOST = { id: 'user-1', username: 'host', displayName: 'Hosty' };
const GUEST = { id: 'user-2', username: 'guest', displayName: null };

function makeRow(overrides: Record<string, any> = {}) {
  return {
    id: 'tm-1',
    code: 'ABC234',
    hostPlayerId: 'user-1',
    guestPlayerId: null as string | null,
    status: 'waiting',
    targetPoints: 30,
    engineState: null,
    version: 0,
    winnerUserId: null,
    finishedAt: null,
    createdAt: new Date('2026-08-21T10:00:00Z'),
    updatedAt: new Date('2026-08-21T11:00:00Z'),
    ...overrides,
  };
}

/** Pushes the SELECT result for "load match row by id". */
function pushRow(row: any | null) {
  pendingResults.push(row ? [row] : []);
}

function pushProfiles(host = true, guest = true) {
  if (host) pendingResults.push([HOST]);
  if (guest) pendingResults.push([GUEST]);
}

// ════════════════════════════════════════════════════════════════════════════
// generateRoomCode — code shape + cryptographic source + uniqueness
// ════════════════════════════════════════════════════════════════════════════

describe('generateRoomCode', () => {
  it('produces codes matching ^[A-HJ-NP-Z2-9]{6}$ — 1,000 matches, none repeated (spec: Code shape and uniqueness)', () => {
    // Injective fake source: counter spread as BASE-32 DIGITS across byte
    // positions — distinct counters yield distinct alphabet indices, so
    // 1,000 draws are provably collision-free.
    let counter = 0;
    const spy = vi.spyOn(crypto, 'randomBytes').mockImplementation((n: number) => {
      const buf = Buffer.alloc(n);
      let c = counter;
      for (let j = 0; j < n; j++) {
        buf[j] = c % 32;
        c = Math.floor(c / 32);
      }
      counter += 1;
      return buf;
    });

    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBe(1000);
    spy.mockRestore();
  });

  it('derives every character from crypto.randomBytes mapped onto the 32-char alphabet', () => {
    // bytes [0,0,0,42,0,0] → alphabet[0]×3 + alphabet[42 % 32] + alphabet[0]×2
    const spy = vi
      .spyOn(crypto, 'randomBytes')
      .mockImplementation(() => Buffer.from([0, 0, 0, 42, 0, 0]));

    const expected =
      ROOM_CODE_ALPHABET[0] +
      ROOM_CODE_ALPHABET[0] +
      ROOM_CODE_ALPHABET[0] +
      ROOM_CODE_ALPHABET[42 % ROOM_CODE_ALPHABET.length] +
      ROOM_CODE_ALPHABET[0] +
      ROOM_CODE_ALPHABET[0];

    expect(generateRoomCode()).toBe(expected);
    expect(spy).toHaveBeenCalledWith(6);
    spy.mockRestore();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createTrucoMatch — S4 optional targetPoints, friendship on invite path,
// unique-violation retry
// ════════════════════════════════════════════════════════════════════════════

describe('createTrucoMatch', () => {
  it('defaults targetPoints to 30 when the body omits it (S4: server default)', async () => {
    pendingResults.push(undefined); // insert

    const outcome = await createTrucoMatch('user-1', {});

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.status).toBe('waiting');
    expect(outcome.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(outcome.hostPlayerId).toBe('user-1');
    const inserted = mockDb.values.mock.calls[0][0];
    expect(inserted.targetPoints).toBe(30);
    expect(inserted.status).toBe('waiting');
    expect(inserted.hostPlayerId).toBe('user-1');
  });

  it('persists an explicit targetPoints of 15', async () => {
    pendingResults.push(undefined); // insert

    const outcome = await createTrucoMatch('user-1', { targetPoints: 15 });

    expect(outcome.ok).toBe(true);
    expect(mockDb.values.mock.calls[0][0].targetPoints).toBe(15);
  });

  it('rejects invalid targetPoints with 400 MISSING_FIELD without inserting', async () => {
    const outcome = await createTrucoMatch('user-1', { targetPoints: 20 as 15 | 30 });

    expect(outcome).toMatchObject({ ok: false, httpStatus: 400, errorCode: 'MISSING_FIELD' });
    expect(mockDb.values).not.toHaveBeenCalled();
  });

  it('requires friendship on the friendId invite path — 403 NOT_FRIENDS, no insert', async () => {
    pendingResults.push([]); // friendship lookup → none

    const outcome = await createTrucoMatch('user-1', { friendId: 'user-9' });

    expect(outcome).toMatchObject({ ok: false, httpStatus: 403, errorCode: 'NOT_FRIENDS' });
    expect(mockDb.values).not.toHaveBeenCalled();
  });

  it('creates an invited match for friends and reports the invite target', async () => {
    pendingResults.push([{ userId: 'user-1', friendId: 'user-2', status: 'accepted' }]); // friendship
    pendingResults.push(undefined); // insert

    const outcome = await createTrucoMatch('user-1', { friendId: 'user-2', targetPoints: 15 });

    expect(outcome).toMatchObject({
      ok: true,
      status: 'waiting',
      friendId: 'user-2',
      hostPlayerId: 'user-1',
    });
    expect(mockDb.values.mock.calls[0][0].targetPoints).toBe(15);
  });

  it('regenerates the code and retries the insert on a unique violation (23505)', async () => {
    const dup: Error & { code?: string } = new Error('duplicate key');
    dup.code = '23505';
    pendingResults.push(dup); // first insert rejects
    pendingResults.push(undefined); // retry succeeds

    const outcome = await createTrucoMatch('user-1', {});

    expect(outcome.ok).toBe(true);
    // Two attempts, two DIFFERENT codes.
    expect(mockDb.values).toHaveBeenCalledTimes(2);
    const [first, second] = mockDb.values.mock.calls.map((c: any[]) => c[0].code);
    expect(first).not.toBe(second);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// joinByCode — 404 unknown/expired, 409 not joinable, ready transition
// ════════════════════════════════════════════════════════════════════════════

describe('joinByCode', () => {
  it('returns 404 CODE_NOT_FOUND for an unknown code', async () => {
    pushRow(null);

    const outcome = await joinByCode('user-2', 'ZZZ999');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 404, errorCode: 'CODE_NOT_FOUND' });
  });

  it('returns 409 match_not_joinable unless the match is waiting (Third player rejected)', async () => {
    pushRow(makeRow({ status: 'ready', guestPlayerId: 'user-2' }));

    const outcome = await joinByCode('user-3', 'ABC234');

    expect(outcome).toMatchObject({
      ok: false,
      httpStatus: 409,
      errorCode: 'match_not_joinable',
    });
  });

  it('rejects the host re-joining their own match', async () => {
    pushRow(makeRow()); // waiting, host user-1

    const outcome = await joinByCode('user-1', 'ABC234');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 409, errorCode: 'match_not_joinable' });
  });

  it('joins atomically: fills the guest seat, flips to ready and reports both nicknames', async () => {
    pushRow(makeRow()); // waiting
    pushProfiles(); // HOST + GUEST profiles
    pendingResults.push({ count: 1 }); // CAS seat claim succeeds

    const outcome = await joinByCode('user-2', 'ABC234');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.matchId).toBe('tm-1');
    expect(outcome.players).toEqual([
      { userId: 'user-1', nickname: 'Hosty' },
      { userId: 'user-2', nickname: 'guest' },
    ]);
    // Seat claim must be conditional on still-waiting + empty seat.
    const whereArg = mockDb.where.mock.calls.at(-1)?.[0];
    expect(whereArg).toBeDefined();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ guestPlayerId: 'user-2', status: 'ready' }),
    );
  });

  it('loses the race for the last seat gracefully — 409 match_not_joinable', async () => {
    pushRow(makeRow());
    pushProfiles(); // profiles are fetched before the seat claim
    pendingResults.push({ count: 0 }); // another claim won concurrently

    const outcome = await joinByCode('user-2', 'ABC234');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 409, errorCode: 'match_not_joinable' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// startTrucoMatch — W1 creator-only + deal hand 1 server-side
// ════════════════════════════════════════════════════════════════════════════

describe('startTrucoMatch', () => {
  it('returns 404 for an unknown match', async () => {
    pushRow(null);

    const outcome = await startTrucoMatch('nope', 'user-1');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 404, errorCode: 'MATCH_NOT_FOUND' });
  });

  it('pins W1: a GUEST attempting to start is forbidden with 403 FORBIDDEN', async () => {
    pushRow(makeRow({ status: 'ready', guestPlayerId: 'user-2' }));

    const outcome = await startTrucoMatch('tm-1', 'user-2');

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.httpStatus).toBe(403);
    expect(outcome.errorCode).toBe('FORBIDDEN');
  });

  it('returns 409 match_not_startable unless the match is ready', async () => {
    pushRow(makeRow({ status: 'waiting' }));

    const outcome = await startTrucoMatch('tm-1', 'user-1');

    expect(outcome).toMatchObject({
      ok: false,
      httpStatus: 409,
      errorCode: 'match_not_startable',
    });
  });

  it('deals hand 1 server-side, persists the wrapped state and bumps version to 1', async () => {
    pushRow(makeRow({ status: 'ready', guestPlayerId: 'user-2' }));
    pendingResults.push({ count: 1 }); // CAS start succeeds

    const outcome = await startTrucoMatch('tm-1', 'user-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.version).toBe(1);

    const setArg = mockDb.set.mock.calls[0][0];
    expect(setArg.version).toBe(1);
    expect(setArg.status).toBe('playing');
    const wrapper = setArg.engineState;
    expect(wrapper.schemaVersion).toBe(1);
    const state = wrapper.state as TrucoState;
    expect(state.phase).toBe('playing');
    expect(state.hands.A).toHaveLength(3);
    expect(state.hands.B).toHaveLength(3);
    expect(state.deckRemaining).toHaveLength(34);
  });

  it('refuses a concurrent double start via the CAS guard — 409', async () => {
    pushRow(makeRow({ status: 'ready', guestPlayerId: 'user-2' }));
    pendingResults.push({ count: 0 }); // another start already committed

    const outcome = await startTrucoMatch('tm-1', 'user-1');

    expect(outcome).toMatchObject({
      ok: false,
      httpStatus: 409,
      errorCode: 'match_not_startable',
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getTrucoMatchView — per-viewer DTO + redaction
// ════════════════════════════════════════════════════════════════════════════

describe('getTrucoMatchView', () => {
  it('returns 404 for an unknown match', async () => {
    pushRow(null);

    const outcome = await getTrucoMatchView('nope', 'user-1');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 404, errorCode: 'MATCH_NOT_FOUND' });
  });

  it('blocks non-participants with 403 FORBIDDEN', async () => {
    pushRow(makeRow());

    const outcome = await getTrucoMatchView('tm-1', 'user-3');

    expect(outcome).toMatchObject({ ok: false, httpStatus: 403, errorCode: 'FORBIDDEN' });
  });

  it('exposes metadata-only payload before hand 1 is dealt (waiting/ready)', async () => {
    pushRow(makeRow());

    const outcome = await getTrucoMatchView('tm-1', 'user-1');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.view).toBeNull();
    expect(outcome.code).toBe('ABC234');
    expect(outcome.status).toBe('waiting');
    expect(outcome.createdAt).toBe('2026-08-21T10:00:00.000Z');
    expect(outcome.updatedAt).toBe('2026-08-21T11:00:00.000Z');
  });

  it('redacts the opponent hand: viewer sees own cards, opponent reduced to a count', async () => {
    // Deterministic deal from the shared engine (same seed → same hands).
    const { createMatch, mulberry32 } = await import('@geotano/shared');
    const seeded = createMatch({ targetPoints: 30, mano: 'A' }, mulberry32(7));
    const row = makeRow({
      status: 'playing',
      version: 4,
      engineState: { schemaVersion: 1, state: seeded },
    });
    pushRow(row);

    const outcome = await getTrucoMatchView('tm-1', 'user-1'); // host → slot A

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.view!.myHand).toEqual(seeded.hands.A);
    expect(outcome.view!.opponentHandCount).toBe(seeded.hands.B.length);
    expect(outcome.version).toBe(4);
    // Redaction firewall: NONE of the opponent's unrevealed cards may appear
    // anywhere in the serialized payload.
    const serialized = JSON.stringify(outcome);
    for (const card of seeded.hands.B) {
      expect(serialized).not.toContain(`"${card}"`);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// deleteExpiredTrucoMatches — 24h retention parity (all statuses)
// ════════════════════════════════════════════════════════════════════════════

describe('deleteExpiredTrucoMatches', () => {
  it('deletes rows untouched for more than 24 hours regardless of status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
    pendingResults.push({ count: 3 });

    const result = await deleteExpiredTrucoMatches();

    expect(result).toEqual({ deleted: 3 });
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(trucoMatches);
    // The cutoff must be exactly now − 24h on updated_at.
    const whereArg = mockDb.where.mock.calls[0][0];
    const { lt } = await import('drizzle-orm');
    expect(whereArg).toEqual(lt(trucoMatches.updatedAt, new Date('2026-08-20T12:00:00Z')));
  });

  it('reports zero deletions when nothing expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
    pendingResults.push({ count: 0 });

    const result = await deleteExpiredTrucoMatches();

    expect(result).toEqual({ deleted: 0 });
  });
});
