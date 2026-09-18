import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { canManageTeam } from '@qiuzheng/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';

export async function teamRoutes(app: FastifyInstance) {
  app.get('/api/teams', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const teams = await prisma.team.findMany({
        where: { members: { some: { userId: request.user!.id } } },
        include: {
          members: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
          _count: { select: { projects: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return { teams };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/teams', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = z.object({ name: z.string().min(1).max(200) }).parse(request.body);
      const team = await prisma.team.create({
        data: {
          name: body.name,
          members: { create: { userId: request.user!.id, role: 'owner' } },
        },
      });
      return { team };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/teams/:teamId/members', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { teamId } = request.params as { teamId: string };
      const body = z
        .object({
          email: z.string().email(),
          role: z.enum(['owner', 'admin', 'member']).default('member'),
        })
        .parse(request.body);
      const me = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: request.user!.id } },
      });
      if (!me || !canManageTeam(me.role)) throw new AppError(403, 'forbidden', 'Team admin required');
      const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (!user) throw new AppError(404, 'not_found', 'User not found');
      const member = await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        create: { teamId, userId: user.id, role: body.role },
        update: { role: body.role },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      return { member };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
