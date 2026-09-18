import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanManage, requireProjectMember, writeAudit } from '../services/rbac.js';

export async function protocolRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/protocols', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const versions = await prisma.protocolVersion.findMany({
        where: { projectId },
        include: { criteria: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { version: 'desc' },
      });
      return { versions };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/protocols', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'lead');
      assertCanManage(membership.role);
      const body = z
        .object({
          question: z.string().optional(),
          notes: z.string().optional(),
          picoP: z.string().max(4000).optional(),
          picoI: z.string().max(4000).optional(),
          picoC: z.string().max(4000).optional(),
          picoO: z.string().max(4000).optional(),
          criteria: z
            .array(
              z.object({
                code: z.string(),
                title: z.string(),
                titleEn: z.string().optional(),
                includeText: z.string().default(''),
                excludeText: z.string().default(''),
                sortOrder: z.number().int().optional(),
              }),
            )
            .optional(),
        })
        .parse(request.body);

      const latest = await prisma.protocolVersion.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        include: { criteria: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;
      const criteriaSource = body.criteria ??
        latest?.criteria.map((c) => ({
          code: c.code,
          title: c.title,
          titleEn: c.titleEn ?? undefined,
          includeText: c.includeText,
          excludeText: c.excludeText,
          sortOrder: c.sortOrder,
        })) ??
        [];

      const version = await prisma.protocolVersion.create({
        data: {
          projectId,
          version: nextVersion,
          question: body.question ?? latest?.question ?? '',
          notes: body.notes,
          picoP: body.picoP ?? latest?.picoP ?? '',
          picoI: body.picoI ?? latest?.picoI ?? '',
          picoC: body.picoC ?? latest?.picoC ?? '',
          picoO: body.picoO ?? latest?.picoO ?? '',
          createdBy: request.user!.id,
          criteria: {
            create: criteriaSource.map((c, i) => ({
              code: c.code,
              title: c.title,
              titleEn: c.titleEn,
              includeText: c.includeText,
              excludeText: c.excludeText,
              sortOrder: c.sortOrder ?? i + 1,
            })),
          },
        },
        include: { criteria: true },
      });

      if (body.question != null) {
        await prisma.project.update({ where: { id: projectId }, data: { question: body.question } });
      }

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: `Created protocol v${nextVersion}`,
        detail: body.notes || 'New protocol version',
        module: 'Protocol',
        version: `Protocol v${nextVersion}`,
      });

      return { version };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
