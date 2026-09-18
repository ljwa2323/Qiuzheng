import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';

const conceptSchema = z.object({
  id: z.string().min(1).max(80),
  index: z.string().max(80).optional(),
  title: z.string().max(500),
  controlled: z.array(z.string().max(300)).max(40).default([]),
  free: z.array(z.string().max(300)).max(80).default([]),
});

function normalizeConcepts(raw: unknown) {
  const parsed = z.array(conceptSchema).max(40).parse(raw ?? []);
  return parsed.map((item, i) => ({
    id: item.id,
    index: item.index || `Concept ${i + 1}`,
    title: String(item.title || '').trim() || `Concept ${i + 1}`,
    controlled: (item.controlled || []).map((t) => String(t).trim()).filter(Boolean),
    free: (item.free || []).map((t) => String(t).trim()).filter(Boolean),
  }));
}

export async function searchStrategyRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/search-strategy', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const row = await prisma.searchStrategy.findUnique({ where: { projectId } });
      return {
        strategy: {
          projectId,
          concepts: normalizeConcepts(row?.concepts ?? []),
          notes: row?.notes || '',
          updatedAt: row?.updatedAt || null,
          updatedBy: row?.updatedBy || null,
        },
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.put('/api/projects/:projectId/search-strategy', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);

      const body = z
        .object({
          concepts: z.array(conceptSchema).max(40),
          notes: z.string().max(4000).optional(),
        })
        .parse(request.body);

      const concepts = normalizeConcepts(body.concepts);
      const row = await prisma.searchStrategy.upsert({
        where: { projectId },
        create: {
          projectId,
          concepts,
          notes: body.notes?.trim() || null,
          updatedBy: request.user!.id,
        },
        update: {
          concepts,
          notes: body.notes === undefined ? undefined : body.notes.trim() || null,
          updatedBy: request.user!.id,
        },
      });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Saved search strategy',
        detail: `${concepts.length} concept block(s)`,
        module: 'Search',
      });

      return {
        strategy: {
          projectId,
          concepts,
          notes: row.notes || '',
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy,
        },
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
