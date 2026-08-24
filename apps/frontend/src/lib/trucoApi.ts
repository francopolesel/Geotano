// ---------------------------------------------------------------------------
// Truco lobby API client (CU6) — typed endpoints over lib/api conventions
// ---------------------------------------------------------------------------
// Consumes EXACT backend reality (routes/truco.ts):
//   POST /api/truco/matches            {targetPoints?, friendId?}
//     → {matchId, code, status} | 400 MISSING_FIELD | 403 NOT_FRIENDS
//   GET  /api/truco/matches/code/:code → {matchId, status} | 404 CODE_NOT_FOUND
//   POST /api/truco/matches/code/:code/join → {matchId}
//     | 404 CODE_NOT_FOUND | 409 match_not_joinable
//   POST /api/truco/matches/:id/start  → {matchId, version, status}
//     | 403 FORBIDDEN | 409 match_not_startable
// Auth/headers/cache-busting stay centralized in request().

import { api } from './api';

export interface CreateTrucoMatchParams {
  targetPoints?: 15 | 30;
  /** Friend's USER id (friendsService maps rows so friendId is that id). */
  friendId?: string;
}

export interface CreateTrucoMatchResponse {
  matchId: string;
  code: string;
  status: 'waiting' | 'ready';
}

/** Convenience pre-check body (no authGuard server-side; UI-only courtesy). */
export interface TrucoMatchCodeLookup {
  matchId: string;
  status: 'waiting' | 'ready' | 'playing' | 'finished';
}

export interface JoinTrucoMatchResponse {
  matchId: string;
}

export interface StartTrucoMatchResponse {
  matchId: string;
  version: number;
  status: 'ready' | 'playing';
}

export function createTrucoMatch(params: CreateTrucoMatchParams = {}) {
  return api.post<CreateTrucoMatchResponse>('/truco/matches', params);
}

export function lookupTrucoMatchByCode(code: string) {
  return api.get<TrucoMatchCodeLookup>(`/truco/matches/code/${encodeURIComponent(code)}`);
}

export function joinTrucoMatchByCode(code: string) {
  return api.post<JoinTrucoMatchResponse>(
    `/truco/matches/code/${encodeURIComponent(code)}/join`,
    {},
  );
}

export function startTrucoMatch(matchId: string) {
  return api.post<StartTrucoMatchResponse>(`/truco/matches/${encodeURIComponent(matchId)}/start`, {});
}
