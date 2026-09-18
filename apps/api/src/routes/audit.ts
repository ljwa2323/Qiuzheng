import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/errors.js';
import { requireProjectMember } from '../services/rbac.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/audit', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const query = request.query as {
        q?: string;
        actor?: string;
        module?: string;
        skip?: string;
        take?: string;
      };
      const take = Math.min(Number(query.take || 50), 200);
      const skip = Number(query.skip || 0);
      const where = {
        projectId,
        ...(query.actor ? { actorName: query.actor } : {}),
        ...(query.module ? { module: query.module } : {}),
        ...(query.q
          ? {
              OR: [
                { action: { contains: query.q, mode: 'insensitive' as const } },
                { detail: { contains: query.q, mode: 'insensitive' as const } },
                { actorName: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [events, total] = await Promise.all([
        prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.auditEvent.count({ where }),
      ]);
      return { events, total, skip, take };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
