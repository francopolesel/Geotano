import Fastify from 'fastify';
import { env } from './config/index.js';
import { registerCors } from './plugins/index.js';
import { healthRoutes, authRoutes, quizRoutes, countriesRoutes, friendsRoutes, chatRoutes, rankingsRoutes, profileRoutes, notificationsRoutes } from './routes/index.js';
import { initSocket } from './socket/index.js';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await registerCors(app);

  // Prevent caching of all API responses (helps with old Android WebView/proxies)
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, no-transform');
    reply.header('Surrogate-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');
    reply.header('Vary', '*');
    return payload;
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(quizRoutes);
  await app.register(countriesRoutes);
  await app.register(friendsRoutes);
  await app.register(chatRoutes);
  await app.register(rankingsRoutes);
  await app.register(profileRoutes);
  await app.register(notificationsRoutes);

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
