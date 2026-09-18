import type { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessClaims } from '../lib/jwt.js';
import { AppError, getBearer } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessClaims & { id: string };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  const token = getBearer(request);
  if (!token) throw new AppError(401, 'unauthorized', 'Missing access token');
  try {
    const claims = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) throw new AppError(401, 'unauthorized', 'User not found');
    request.user = { ...claims, id: user.id, email: user.email, name: user.name };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'unauthorized', 'Invalid access token');
  }
}

export function registerAuth(app: FastifyInstance) {
  app.decorate('authenticate', authenticate);
}
