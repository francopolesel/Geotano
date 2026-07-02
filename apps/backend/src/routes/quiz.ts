import type { FastifyInstance } from 'fastify';
import { authGuard } from '../auth/index.js';
import { startSession, submitAnswer } from '../services/quizEngine.js';
import { isValidModeSlug } from '../services/gameModes.js';
import type { GameModeSlug } from '@geotano/shared';

export async function quizRoutes(app: FastifyInstance) {
  // GET /api/quiz/session — start a new quiz session
  app.get(
    '/api/quiz/session',
    { preHandler: authGuard },
    async (request, reply) => {
      const { mode } = request.query as { mode?: string };
      const { userId } = (request as any).user;

      if (!mode || !isValidModeSlug(mode)) {
        return reply.status(400).send({
          message: `Invalid mode. Valid modes: flag-guess, capital-guess, country-by-flag, continent, free`,
        });
      }

      try {
        const { sessionId, question } = await startSession(userId, mode as GameModeSlug);
        return { sessionId, question };
      } catch (err) {
        if (err instanceof Error && err.message.includes('No countries available')) {
          return reply.status(503).send({ message: err.message });
        }
        request.log.error(err, 'Failed to start session');
        return reply.status(500).send({ message: 'Failed to start quiz session' });
      }
    },
  );

  // POST /api/quiz/answer — submit an answer
  app.post(
    '/api/quiz/answer',
    { preHandler: authGuard },
    async (request, reply) => {
      const { userId } = (request as any).user;
      const { sessionId, answer, timeMs } = request.body as {
        sessionId: string;
        answer: string;
        timeMs: number;
      };

      if (!sessionId || !answer || timeMs == null) {
        return reply.status(400).send({
          message: 'sessionId, answer, and timeMs are required',
        });
      }

      try {
        const result = await submitAnswer(sessionId, userId, answer, timeMs);
        return result;
      } catch (err: any) {
        if (err.message?.includes('not found') || err.message?.includes('completed')) {
          return reply.status(400).send({ message: err.message });
        }
        request.log.error(err, 'Failed to submit answer');
        return reply.status(500).send({ message: 'Failed to submit answer' });
      }
    },
  );
}
