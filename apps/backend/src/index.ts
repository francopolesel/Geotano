import Fastify from 'fastify';
import { env } from './config/index.js';
import { registerCors } from './plugins/index.js';
import { healthRoutes, authRoutes, quizRoutes, countriesRoutes, friendsRoutes, chatRoutes, rankingsRoutes } from './routes/index.js';
import { initSocket } from './socket/index.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await registerCors(app);

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(quizRoutes);
  await app.register(countriesRoutes);
  await app.register(friendsRoutes);
  await app.register(chatRoutes);
  await app.register(rankingsRoutes);

  return app;
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    // Initialize Socket.io after server is listening
    initSocket(app);
    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
    app.log.info(`Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }
}

start();

export { buildApp };
