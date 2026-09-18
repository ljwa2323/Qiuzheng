import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { loadEnv } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { pingRedis } from './lib/queue.js';
import { ensureBucket } from './lib/s3.js';
import { AppError } from './lib/errors.js';
import { registerAuth } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { teamRoutes } from './routes/teams.js';
import { projectRoutes } from './routes/projects.js';
import { protocolRoutes } from './routes/protocols.js';
import { citationRoutes } from './routes/citations.js';
import { screeningRoutes } from './routes/screening.js';
import { auditRoutes } from './routes/audit.js';
import { credentialRoutes } from './routes/credentials.js';
import { extractionRoutes } from './routes/extraction.js';
import { riskOfBiasRoutes } from './routes/risk-of-bias.js';
import { meshRoutes } from './routes/mesh.js';
import { searchStrategyRoutes } from './routes/search-strategy.js';
import { metaRoutes } from './routes/meta.js';
import { synthesisRoutes } from './routes/synthesis.js';

export async function buildApp() {
  const env = loadEnv();
  const app = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  registerAuth(app);

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    }
    if ((err as { validation?: unknown }).validation) {
      return reply.status(400).send({
        error: { code: 'validation', message: (err as Error).message },
      });
    }
    app.log.error(err);
    return reply.status(500).send({ error: { code: 'internal_error', message: 'Internal server error' } });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const redisOk = await pingRedis();
      if (!redisOk) throw new Error('redis down');
      return { status: 'ready', db: true, redis: true };
    } catch (err) {
      return reply.status(503).send({
        status: 'not_ready',
        message: (err as Error).message,
      });
    }
  });

  await authRoutes(app);
  await teamRoutes(app);
  await projectRoutes(app);
  await protocolRoutes(app);
  await citationRoutes(app);
  await screeningRoutes(app);
  await auditRoutes(app);
  await credentialRoutes(app);
  await extractionRoutes(app);
  await riskOfBiasRoutes(app);
  await meshRoutes(app);
  await searchStrategyRoutes(app);
  await metaRoutes(app);
  await synthesisRoutes(app);

  app.addHook('onReady', async () => {
    try {
      await ensureBucket();
    } catch (err) {
      app.log.warn({ err }, 'MinIO bucket ensure failed (will retry on upload)');
    }
  });

  return app;
}
