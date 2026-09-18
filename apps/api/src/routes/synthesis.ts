import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';
import {
  knowledgeToMarkdown,
  recallSynthesisKnowledge,
  SYNTHESIS_QUERY_KEYS,
  type SynthesisQueryKey,
} from '../services/synthesis-knowledge.js';
import { callChatCompletions, applyLlmResponseLanguage } from '../services/llm.js';

export async function synthesisRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/synthesis/knowledge', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const query = request.query as { queries?: string };
      const raw = String(query.queries || SYNTHESIS_QUERY_KEYS.join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const queries = raw.filter((k): k is SynthesisQueryKey =>
        (SYNTHESIS_QUERY_KEYS as readonly string[]).includes(k),
      );
      if (!queries.length) throw new AppError(400, 'validation', 'No valid queries');
      const knowledge = await recallSynthesisKnowledge(projectId, queries);
      return { knowledge, queries };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/synthesis/composes', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const composes = await prisma.synthesisCompose.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return { composes };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/synthesis/compose', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          queries: z.array(z.enum(SYNTHESIS_QUERY_KEYS)).min(1).max(12),
          title: z.string().max(200).optional(),
          useLlm: z.boolean().optional(),
          credentialId: z.string().optional(),
        })
        .parse(request.body);

      const knowledge = await recallSynthesisKnowledge(projectId, body.queries);
      const title = body.title || 'Evidence synthesis draft';
      let markdown = knowledgeToMarkdown(knowledge, title);

      if (body.useLlm) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        const credentialId = body.credentialId || project?.credentialId;
        if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');
        const languageHint = project?.llmResponseLanguage || 'zh';
        const messages = applyLlmResponseLanguage(
          [
            {
              role: 'system',
              content:
                'You are a systematic review writing assistant. Use ONLY the provided knowledge pack. Do not invent effect sizes; quote meta pooled estimates exactly when present. Write structured markdown.',
            },
            {
              role: 'user',
              content: `Compose an evidence synthesis section from this knowledge JSON:\n\n${JSON.stringify(knowledge, null, 2)}`,
            },
          ],
          languageHint,
          'chat',
        );
        const completion = await callChatCompletions({
          credentialId,
          messages,
          temperature: 0.2,
        });
        const text = String(completion.content || '').trim();
        if (text) {
          markdown = `${markdown}\n\n---\n\n## LLM narrative (from recalled knowledge)\n\n${text}`;
        }
      }

      const compose = await prisma.synthesisCompose.create({
        data: {
          projectId,
          queries: body.queries,
          knowledgeJson: knowledge as object,
          markdown,
          title,
          createdBy: request.user!.id,
        },
      });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Composed evidence synthesis from knowledge queries',
        detail: `${title} · queries=${body.queries.join(',')}${body.useLlm ? ' · llm' : ''}`,
        module: 'Synthesis',
      });

      return { compose, knowledge };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
