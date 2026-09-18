import type { ProjectRole } from '@prisma/client';
import { canManageProject, canWriteProject, roleAtLeast } from '@qiuzheng/shared';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

export async function requireProjectMember(
  projectId: string,
  userId: string,
  minimum: ProjectRole = 'viewer',
) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: true },
  });
  if (!membership) throw new AppError(403, 'forbidden', 'Not a project member');
  if (!roleAtLeast(membership.role, minimum)) {
    throw new AppError(403, 'forbidden', 'Insufficient project role');
  }
  return membership;
}

export function assertCanWrite(role: ProjectRole) {
  if (!canWriteProject(role)) throw new AppError(403, 'forbidden', 'Write access required');
}

export function assertCanManage(role: ProjectRole) {
  if (!canManageProject(role)) throw new AppError(403, 'forbidden', 'Manage access required');
}

export async function writeAudit(input: {
  projectId?: string | null;
  userId?: string | null;
  actorName: string;
  action: string;
  detail: string;
  module: string;
  version?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      actorName: input.actorName,
      action: input.action,
      detail: input.detail,
      module: input.module,
      version: input.version,
    },
  });
}
