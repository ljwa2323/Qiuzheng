import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { decryptSecret } from '../lib/crypto.js';
import { requireProjectMember } from '../services/rbac.js';
import { formatMeshLabel, resolveMeshQueries } from '../services/mesh.js';

async function loadPubmedApiKey(projectId: string): Promise<string | undefined> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      pubmedApiKeyCipher: true,
      pubmedApiKeyIv: true,
      pubmedApiKeyTag: true,
    },
  });
  if (!project?.pubmedApiKeyCipher || !project.pubmedApiKeyIv || !project.pubmedApiKeyTag) {
    return undefined;
  }
  try {
    return decryptSecret(project.pubmedApiKeyCipher, project.pubmedApiKeyIv, project.pubmedApiKeyTag);
  } catch {
    throw new AppError(500, 'decrypt_error', 'Failed to decrypt PubMed API key');
  }
}

export async function meshRoutes(app: FastifyInstance) {
  app.post('/api/projects/:projectId/mesh/resolve', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const body = z
        .object({
          queries: z.array(z.string().trim().min(1).max(200)).min(1).max(24),
        })
        .parse(request.body);

      const apiKey = await loadPubmedApiKey(projectId);
      const results = await resolveMeshQueries(body.queries, apiKey);
      return {
        results: results.map((hit) => ({
          ...hit,
          label: hit.preferredTerm ? formatMeshLabel(hit.preferredTerm) : undefined,
        })),
        usedApiKey: Boolean(apiKey),
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
