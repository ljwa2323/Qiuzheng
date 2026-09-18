import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanManage, requireProjectMember, writeAudit } from '../services/rbac.js';
import { encryptSecret, last4 } from '../lib/crypto.js';

const projectCreateSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  question: z.string().optional(),
});

function publicProject<T extends Record<string, unknown>>(project: T) {
  const {
    pubmedApiKeyCipher: _c,
    pubmedApiKeyIv: _i,
    pubmedApiKeyTag: _t,
    ...rest
  } = project as T & {
    pubmedApiKeyCipher?: string | null;
    pubmedApiKeyIv?: string | null;
    pubmedApiKeyTag?: string | null;
    pubmedApiKeyLast4?: string | null;
  };
  return {
    ...rest,
    hasPubmedApiKey: Boolean(_c),
    pubmedApiKeyLast4: rest.pubmedApiKeyLast4 || '',
  };
}

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const projects = await prisma.project.findMany({
        where: { members: { some: { userId: request.user!.id } } },
        include: {
          team: { select: { id: true, name: true } },
          members: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
          _count: { select: { citations: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return {
        projects: projects.map((p) => publicProject(p as unknown as Record<string, unknown>)),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = projectCreateSchema.parse(request.body);
      const teamMember = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: body.teamId, userId: request.user!.id } },
      });
      if (!teamMember) throw new AppError(403, 'forbidden', 'Not a team member');

      const project = await prisma.project.create({
        data: {
          teamId: body.teamId,
          name: body.name,
          description: body.description ?? '',
          question: body.question ?? '',
          members: { create: { userId: request.user!.id, role: 'owner' } },
          protocolVersions: {
            create: {
              version: 1,
              question: body.question ?? '',
              createdBy: request.user!.id,
              criteria: {
                create: [
                  {
                    code: 'P',
                    title: 'Population',
                    titleEn: 'Population',
                    includeText: '',
                    excludeText: '',
                    sortOrder: 1,
                  },
                  {
                    code: 'I',
                    title: 'Intervention',
                    titleEn: 'Intervention',
                    includeText: '',
                    excludeText: '',
                    sortOrder: 2,
                  },
                  {
                    code: 'O',
                    title: 'Outcomes',
                    titleEn: 'Outcomes',
                    includeText: '',
                    excludeText: '',
                    sortOrder: 3,
                  },
                  {
                    code: 'S',
                    title: 'Study design',
                    titleEn: 'Study design',
                    includeText: '',
                    excludeText: '',
                    sortOrder: 4,
                  },
                ],
              },
            },
          },
        },
        include: { protocolVersions: { include: { criteria: true } } },
      });

      await writeAudit({
        projectId: project.id,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Created project',
        detail: project.name,
        module: 'Project',
      });

      return { project };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.get('/api/projects/:projectId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          team: true,
          members: { include: { user: { select: { id: true, email: true, name: true } } } },
          protocolVersions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { criteria: { orderBy: { sortOrder: 'asc' } } },
          },
          credential: {
            select: {
              id: true,
              name: true,
              provider: true,
              baseUrl: true,
              defaultModel: true,
              apiKeyLast4: true,
            },
          },
          _count: { select: { citations: true, screeningDecisions: true } },
        },
      });
      return { project: publicProject(project as unknown as Record<string, unknown>), role: membership.role };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch('/api/projects/:projectId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'lead');
      assertCanManage(membership.role);
      const body = z
        .object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(4000).optional(),
          question: z.string().optional(),
          credentialId: z.string().nullable().optional(),
          llmResponseLanguage: z.enum(['zh', 'en']).optional(),
          embeddingCredentialId: z.string().nullable().optional(),
          embeddingModel: z.string().max(200).optional(),
          pubmedApiKey: z.string().max(200).optional(),
          clearPubmedApiKey: z.boolean().optional(),
        })
        .parse(request.body);

      const {
        pubmedApiKey,
        clearPubmedApiKey,
        ...rest
      } = body;

      const data: Record<string, unknown> = { ...rest };
      if (clearPubmedApiKey) {
        data.pubmedApiKeyCipher = null;
        data.pubmedApiKeyIv = null;
        data.pubmedApiKeyTag = null;
        data.pubmedApiKeyLast4 = '';
      } else if (typeof pubmedApiKey === 'string' && pubmedApiKey.trim()) {
        const enc = encryptSecret(pubmedApiKey.trim());
        data.pubmedApiKeyCipher = enc.cipher;
        data.pubmedApiKeyIv = enc.iv;
        data.pubmedApiKeyTag = enc.tag;
        data.pubmedApiKeyLast4 = last4(pubmedApiKey.trim());
      }

      const project = await prisma.project.update({
        where: { id: projectId },
        data,
      });
      const auditBody = {
        ...rest,
        ...(clearPubmedApiKey ? { pubmedApiKey: '[cleared]' } : {}),
        ...(pubmedApiKey?.trim() ? { pubmedApiKey: `[set ****${last4(pubmedApiKey.trim())}]` } : {}),
      };
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Updated project settings',
        detail: JSON.stringify(auditBody),
        module: 'Settings',
      });
      return { project: publicProject(project as unknown as Record<string, unknown>) };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.delete('/api/projects/:projectId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'owner');
      if (membership.role !== 'owner') {
        throw new AppError(403, 'forbidden', 'Only the project owner can delete the project');
      }
      const body = z
        .object({
          confirmName: z.string().min(1),
        })
        .parse(request.body ?? {});

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { _count: { select: { citations: true } } },
      });
      if (!project) throw new AppError(404, 'not_found', 'Project not found');
      if (body.confirmName.trim() !== project.name.trim()) {
        throw new AppError(400, 'validation', 'Project name confirmation does not match');
      }

      const name = project.name;
      const citationCount = project._count.citations;
      await prisma.project.delete({ where: { id: projectId } });
      // Project cascade removes related rows; audit on deleted project is not retained.
      return { ok: true, deleted: { id: projectId, name, citationCount } };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/members', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'lead');
      assertCanManage(membership.role);
      const body = z
        .object({
          email: z.string().email(),
          role: z.enum(['owner', 'lead', 'reviewer', 'viewer']).default('reviewer'),
        })
        .parse(request.body);
      const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (!user) throw new AppError(404, 'not_found', 'User not found');
      const member = await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: user.id } },
        create: { projectId, userId: user.id, role: body.role },
        update: { role: body.role },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Updated project member',
        detail: `${user.email} as ${body.role}`,
        module: 'Project',
      });
      return { member };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/seed-demo', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'lead');
      assertCanManage(membership.role);

      const { seedDemoProject } = await import('../services/demo-seed.js');
      const result = await seedDemoProject(projectId, request.user!.id, { resetCitations: true });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Reset live practice dataset',
        detail: `Protocol, ${result.citationCount} citations, screening samples, and extraction values rewritten from server seed.`,
        module: 'Project',
      });

      return { ok: true, ...result };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
