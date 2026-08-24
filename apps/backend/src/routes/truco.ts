// ---------------------------------------------------------------------------
// Geotano — Truco Argentino routes (CU3, D8 route table)
// ---------------------------------------------------------------------------
// Thin translators: every handler delegates to trucoService and maps its
// outcome union 1:1 onto HTTP. Socket pushes live IN THE ROUTE LAYER (repo
// precedent) and carry IDs/version/reason ONLY — hands never travel through
// pushes; they reach clients exclusively via the redacted per-viewer REST DTO.

import type { FastifyInstance } from 'fastify';
import { authGuard } from '../auth/index.js';
import {
  applyTrucoAction,
  createTrucoMatch,
  findActiveTrucoMatchByCode,
  getTrucoMatchView,
  joinByCode,
  startTrucoMatch,
} from '../services/trucoService.js';
import { getIO, getUserSocketIds } from '../socket/index.js';

/** Direct-emit to every connected socket of the given users (multi-device). */
function emitToUsers(userIds: string[], event: string, payload: Record<string, unknown>): void {
  const io = getIO();
  for (const userId of userIds) {
    for (const sid of getUserSocketIds(userId)) {
      io.to(sid).emit(event, payload);
    }
  }
}

function errorReply(
  reply: any,
  outcome: { httpStatus: number; errorCode: string; message: string },
) {
  return reply.status(outcome.httpStatus).send({
    errorCode: outcome.errorCode,
    message: outcome.message,
  });
}

export async function trucoRoutes(app: FastifyInstance) {
  // POST /api/truco/matches — create a match (+ optional friend invite push)
  app.post('/api/truco/matches', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;
    const body = (request.body ?? {}) as { targetPoints?: 15 | 30; friendId?: string };

    const outcome = await createTrucoMatch(userId, body);
    if (!outcome.ok) {
      return errorReply(reply, outcome);
    }

    if (body.friendId) {
      emitToUsers([body.friendId], 'truco:invite', {
        matchId: outcome.matchId,
        code: outcome.code,
        fromUser: userId,
      });
    }

    return { matchId: outcome.matchId, code: outcome.code, status: outcome.status };
  });

  // GET /api/truco/matches/code/:code
  // S3 ADDITIVE CONVENIENCE ENDPOINT (beyond the delta-spec minimum): kept for
  // the join-UX pre-check; public-minimal {matchId,status} only. Intentional
  // documented surface for archive.
  // Remediation #4: authenticated like every other truco route — the payload
  // is minimal but the surface must not be anonymously enumerable.
  app.get('/api/truco/matches/code/:code', { preHandler: authGuard }, async (request, reply) => {
    const { code } = request.params as { code: string };

    const found = await findActiveTrucoMatchByCode(code);
    if (!found) {
      return reply.status(404).send({ errorCode: 'CODE_NOT_FOUND', message: 'No active match found for this code' });
    }
    return found;
  });

  // POST /api/truco/matches/code/:code/join — claim the guest seat atomically
  app.post('/api/truco/matches/code/:code/join', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;
    const { code } = request.params as { code: string };

    const outcome = await joinByCode(userId, code);
    if (!outcome.ok) {
      return errorReply(reply, outcome);
    }

    emitToUsers(
      outcome.players.map((p) => p.userId),
      'truco:player-joined',
      { matchId: outcome.matchId, players: outcome.players },
    );

    return { matchId: outcome.matchId };
  });

  // POST /api/truco/matches/:id/start — W1 creator-only deal of hand 1
  app.post('/api/truco/matches/:id/start', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;
    const { id } = request.params as { id: string };

    const outcome = await startTrucoMatch(id, userId);
    if (!outcome.ok) {
      return errorReply(reply, outcome);
    }

    emitToUsers([outcome.hostPlayerId, outcome.guestPlayerId], 'truco:state-changed', {
      matchId: outcome.matchId,
      version: outcome.version,
      reason: 'start',
    });

    return { matchId: outcome.matchId, version: outcome.version, status: outcome.status };
  });

  // GET /api/truco/matches/:id — redacted per-viewer snapshot
  app.get('/api/truco/matches/:id', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;
    const { id } = request.params as { id: string };

    const outcome = await getTrucoMatchView(id, userId);
    if (!outcome.ok) {
      return errorReply(reply, outcome);
    }
    return outcome;
  });

  // POST /api/truco/matches/:id/actions — server-authoritative engine step
  app.post('/api/truco/matches/:id/actions', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = (request as any).user;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { expectedVersion?: unknown; action?: unknown };

    if (
      typeof body.expectedVersion !== 'number' ||
      !body.action ||
      typeof (body.action as any).type !== 'string'
    ) {
      return reply.status(400).send({
        errorCode: 'MISSING_FIELD',
        message: 'expectedVersion (number) and action.type are required',
      });
    }

    const outcome = await applyTrucoAction(id, userId, body.expectedVersion, body.action as Record<string, unknown>);
    if (!outcome.ok) {
      return errorReply(reply, outcome);
    }

    emitToUsers([outcome.hostPlayerId, outcome.guestPlayerId], 'truco:state-changed', {
      matchId: outcome.matchId,
      version: outcome.version,
      reason: outcome.matchEnded ? 'finish' : 'action',
    });
    if (outcome.matchEnded) {
      emitToUsers([outcome.hostPlayerId, outcome.guestPlayerId], 'truco:finished', {
        matchId: outcome.matchId,
        winnerUserId: outcome.winnerUserId,
      });
    }

    return {
      matchId: outcome.matchId,
      view: outcome.view,
      matchEnded: outcome.matchEnded,
      version: outcome.version,
      winnerUserId: outcome.winnerUserId,
    };
  });
}
