// ---------------------------------------------------------------------------
// Geotano — Truco Argentino multiplayer service (CU3)
// ---------------------------------------------------------------------------
// Server-authoritative lifecycle around the pure engine in @geotano/shared.
// One durable row per match (`truco_matches`): the whole engine state lives in
// the `engine_state` JSONB column wrapped as `{ schemaVersion, state }`, and
// every mutation goes through an optimistic-concurrency guard
// (`WHERE version = $expected`) so stale clients get 409 instead of
// clobbering each other.
//
// Outcomes are plain unions ({ok:false,...} carrying the HTTP mapping) so the
// route layer stays a thin translator — mirroring the `{ message }` +
// errorCode repo conventions.

import crypto from 'crypto';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { friends, trucoMatches, users } from '../db/schema/index.js';
import {
  buildView,
  createMatch as createEngineMatch,
} from '@geotano/shared';
import type {
  PlayerSlot,
  Rng,
  TrucoAction,
  TrucoState,
  TrucoView,
} from '@geotano/shared';

// ─── Constants ──────────────────────────────────────────────────────────────

/** 32-char unambiguous alphabet: no 0/O/1/I/L — spec-pinned `^[A-HJ-NP-Z2-9]{6}$`. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const CODE_ALLOCATION_RETRIES = 5;
const TRUCO_MATCH_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h retention parity

const ACTIVE_STATUSES = ['waiting', 'ready', 'playing'] as const;

const ENGINE_SCHEMA_VERSION = 1;

// ─── Outcome helpers ────────────────────────────────────────────────────────

/** Error outcome carrying its HTTP mapping (route layer translates 1:1). */
export interface TrucoServiceError {
  ok: false;
  httpStatus: number;
  errorCode: string;
  message: string;
}

function fail(httpStatus: number, errorCode: string, message: string): TrucoServiceError {
  return { ok: false, httpStatus, errorCode, message };
}

// ─── Engine-state JSONB envelope (D6) ───────────────────────────────────────

interface EngineStateWrapper {
  schemaVersion: number;
  state: TrucoState;
}

function wrapEngineState(state: TrucoState): EngineStateWrapper {
  return { schemaVersion: ENGINE_SCHEMA_VERSION, state };
}

/**
 * Forward-migration hook for persisted engine states (D6). Identity at v1 —
 * future versions add branches here instead of touching call sites.
 */
export function migrateState(schemaVersion: number, raw: unknown): TrucoState {
  if (schemaVersion === ENGINE_SCHEMA_VERSION) return raw as TrucoState;
  throw new Error(`Unsupported truco engine state schemaVersion: ${schemaVersion}`);
}

function unwrapEngineState(raw: unknown): TrucoState {
  if (
    !raw ||
    typeof raw !== 'object' ||
    typeof (raw as EngineStateWrapper).schemaVersion !== 'number' ||
    !(raw as EngineStateWrapper).state
  ) {
    throw new Error('Corrupt truco engine_state payload: missing schemaVersion/state wrapper');
  }
  const wrapper = raw as EngineStateWrapper;
  return migrateState(wrapper.schemaVersion, wrapper.state);
}

// ─── Room codes ─────────────────────────────────────────────────────────────

/**
 * Cryptographically random room code. `randomBytes(6)` gives unbiased symbols
 * (256 % 32 === 0); uniqueness among ACTIVE matches is enforced by the partial
 * unique index plus the insert-retry below.
 */
export function generateRoomCode(): string {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/** Crypto-backed rng handed to the engine ONLY at deal boundaries (D3). */
function cryptoRng(): Rng {
  return () => crypto.randomBytes(4).readUInt32LE(0) / 2 ** 32;
}

// ─── Shared row helpers ─────────────────────────────────────────────────────

type TrucoRow = typeof trucoMatches.$inferSelect;

/** Maps an authenticated user onto their engine slot; null when outsider. */
function slotOf(row: Pick<TrucoRow, 'hostPlayerId' | 'guestPlayerId'>, userId: string): PlayerSlot | null {
  if (row.hostPlayerId === userId) return 'A';
  if (row.guestPlayerId === userId) return 'B';
  return null;
}

async function loadRow(matchId: string): Promise<TrucoRow | null> {
  const [row] = await db
    .select()
    .from(trucoMatches)
    .where(eq(trucoMatches.id, matchId))
    .limit(1);
  return row ?? null;
}

function nicknameOf(profile: { username?: string | null; displayName?: string | null } | undefined): string {
  return profile?.displayName ?? profile?.username ?? 'player';
}

// ─── Create ─────────────────────────────────────────────────────────────────

export type CreateTrucoMatchOutcome =
  | {
      ok: true;
      matchId: string;
      code: string;
      status: 'waiting';
      hostPlayerId: string;
      /** Present only when the creator attached a friend invite. */
      friendId?: string;
    }
  | TrucoServiceError;

export async function createTrucoMatch(
  userId: string,
  body: { targetPoints?: 15 | 30; friendId?: string },
): Promise<CreateTrucoMatchOutcome> {
  // S4: targetPoints is OPTIONAL — the server defaults to 30.
  const targetPoints = body.targetPoints ?? 30;
  if (targetPoints !== 15 && targetPoints !== 30) {
    return fail(400, 'MISSING_FIELD', 'targetPoints must be 15 or 30');
  }

  // Invite path mirrors the quiz challenge flow: friendship REQUIRED.
  if (body.friendId) {
    const [friendship] = await db
      .select()
      .from(friends)
      .where(
        and(
          or(
            and(eq(friends.userId, userId), eq(friends.friendId, body.friendId)),
            and(eq(friends.userId, body.friendId), eq(friends.friendId, userId)),
          ),
          eq(friends.status, 'accepted'),
        ),
      )
      .limit(1);

    if (!friendship) {
      return fail(403, 'NOT_FRIENDS', 'You can only invite friends');
    }
  }

  const matchId = crypto.randomUUID();
  // Partial unique index rejects code collisions among active matches —
  // regenerate and retry a bounded number of times before giving up.
  for (let attempt = 0; attempt < CODE_ALLOCATION_RETRIES; attempt++) {
    const code = generateRoomCode();
    try {
      await db.insert(trucoMatches).values({
        id: matchId,
        code,
        hostPlayerId: userId,
        targetPoints,
        status: 'waiting',
      });
      return {
        ok: true,
        matchId,
        code,
        status: 'waiting',
        hostPlayerId: userId,
        ...(body.friendId ? { friendId: body.friendId } : {}),
      };
    } catch (err: any) {
      if (err?.code === '23505') continue; // duplicate active code — try another
      throw err;
    }
  }
  throw new Error('Could not allocate a free room code');
}

// ─── Join by code ───────────────────────────────────────────────────────────

export type JoinByCodeOutcome =
  | {
      ok: true;
      matchId: string;
      players: { userId: string; nickname: string }[];
    }
  | TrucoServiceError;

export async function joinByCode(userId: string, code: string): Promise<JoinByCodeOutcome> {
  // Only ACTIVE rows claim their code; finished/expired rows release it.
  const [row] = await db
    .select()
    .from(trucoMatches)
    .where(
      and(eq(trucoMatches.code, code.toUpperCase()), inArray(trucoMatches.status, [...ACTIVE_STATUSES])),
    )
    .orderBy(sql`${trucoMatches.createdAt} DESC`)
    .limit(1);

  if (!row) {
    return fail(404, 'CODE_NOT_FOUND', 'No active match found for this code');
  }
  if (row.status !== 'waiting') {
    return fail(409, 'match_not_joinable', 'This match can no longer be joined');
  }
  if (slotOf(row, userId) !== null) {
    return fail(409, 'match_not_joinable', 'You are already a participant in this match');
  }

  // Profiles for the player-joined push payload (route layer emits).
  const [hostProfile] = await db
    .select({ username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, row.hostPlayerId))
    .limit(1);
  const [guestProfile] = await db
    .select({ username: users.username, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Atomic seat claim: only wins if the match is STILL waiting and the guest
  // seat is empty — two concurrent joins resolve to exactly one winner.
  const claimed: any = await db
    .update(trucoMatches)
    .set({ guestPlayerId: userId, status: 'ready', updatedAt: sql`NOW()` })
    .where(
      and(
        eq(trucoMatches.id, row.id),
        eq(trucoMatches.status, 'waiting'),
        isNull(trucoMatches.guestPlayerId),
      ),
    );

  if (Number(claimed?.count ?? 0) === 0) {
    return fail(409, 'match_not_joinable', 'This match can no longer be joined');
  }

  return {
    ok: true,
    matchId: row.id,
    players: [
      { userId: row.hostPlayerId, nickname: nicknameOf(hostProfile) },
      { userId, nickname: nicknameOf(guestProfile) },
    ],
  };
}

// ─── Start (W1: creator-only) ───────────────────────────────────────────────

export type StartTrucoMatchOutcome =
  | {
      ok: true;
      matchId: string;
      version: number;
      status: 'playing';
      hostPlayerId: string;
      guestPlayerId: string;
    }
  | TrucoServiceError;

export async function startTrucoMatch(matchId: string, userId: string): Promise<StartTrucoMatchOutcome> {
  const row = await loadRow(matchId);
  if (!row) {
    return fail(404, 'MATCH_NOT_FOUND', 'Match not found');
  }
  // W1 (gate finding): start is CREATOR-ONLY — unambiguous.
  if (row.hostPlayerId !== userId) {
    return fail(403, 'FORBIDDEN', 'Only the creator can start the match');
  }
  if (row.status !== 'ready' || !row.guestPlayerId) {
    return fail(409, 'match_not_startable', 'Match cannot be started right now');
  }

  // Deal hand 1 server-side with a crypto rng; concrete hands live INSIDE
  // the persisted state so replays never need randomness again (D3).
  const state = createEngineMatch(
    { targetPoints: (row.targetPoints === 15 ? 15 : 30) as 15 | 30 },
    cryptoRng(),
  );

  // CAS: starting twice concurrently resolves to exactly one deal.
  const started: any = await db
    .update(trucoMatches)
    .set({
      engineState: wrapEngineState(state),
      version: 1,
      status: 'playing',
      updatedAt: sql`NOW()`,
    })
    .where(and(eq(trucoMatches.id, row.id), eq(trucoMatches.version, row.version)));

  if (Number(started?.count ?? 0) === 0) {
    return fail(409, 'match_not_startable', 'Match cannot be started right now');
  }

  return {
    ok: true,
    matchId: row.id,
    version: 1,
    status: 'playing',
    hostPlayerId: row.hostPlayerId,
    guestPlayerId: row.guestPlayerId!,
  };
}

// ─── Per-viewer read model ──────────────────────────────────────────────────

export interface TrucoMatchSnapshot {
  ok: true;
  matchId: string;
  code: string;
  status: string;
  version: number;
  targetPoints: number;
  hostPlayerId: string;
  guestPlayerId: string | null;
  winnerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Redacted per-viewer DTO; null until hand 1 is dealt. */
  view: (TrucoView & { matchId: string; version: number }) | null;
}

export type GetTrucoMatchViewOutcome = TrucoMatchSnapshot | TrucoServiceError;

export async function getTrucoMatchView(
  matchId: string,
  viewerId: string,
): Promise<GetTrucoMatchViewOutcome> {
  const row = await loadRow(matchId);
  if (!row) {
    return fail(404, 'MATCH_NOT_FOUND', 'Match not found');
  }
  const slot = slotOf(row, viewerId);
  if (slot === null) {
    return fail(403, 'FORBIDDEN', 'You are not a participant in this match');
  }

  // Redaction rule: hands NEVER leave the server raw — buildView whitelists
  // public info and reduces the opponent hand to a count.
  const view = row.engineState
    ? { ...buildView(unwrapEngineState(row.engineState), slot), matchId: row.id, version: row.version }
    : null;

  return {
    ok: true,
    matchId: row.id,
    code: row.code,
    status: row.status,
    version: row.version,
    targetPoints: row.targetPoints,
    hostPlayerId: row.hostPlayerId,
    guestPlayerId: row.guestPlayerId,
    winnerUserId: row.winnerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    view,
  };
}

// ─── Expiry cleanup (parity with deleteExpiredMatches) ─────────────────────

/**
 * Deletes truco matches untouched for more than 24 hours — unfinished AND
 * finished alike (bounded growth), matching the quiz/match cleanup cadence.
 */
export async function deleteExpiredTrucoMatches(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - TRUCO_MATCH_EXPIRY_MS);
  const deleted: any = await db
    .delete(trucoMatches)
    .where(lt(trucoMatches.updatedAt, cutoff));
  return { deleted: Number(deleted?.count ?? 0) };
}

// Re-exported for route-layer typing convenience (kept close to usage).
export type { TrucoAction, TrucoState };
