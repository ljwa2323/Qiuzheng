import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PROVIDER_PRESETS } from '@qiuzheng/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { encryptSecret, last4 } from '../lib/crypto.js';
import { callChatCompletions, buildAssistantContextBlock, applyLlmResponseLanguage, ASSISTANT_CHAT_PROMPT_VERSION } from '../services/llm.js';
import { canManageTeam } from '@qiuzheng/shared';
import { requireProjectMember, writeAudit } from '../services/rbac.js';

const credentialSchema = z.object({
  name: z.string().min(1).max(120),
  provider: z.enum(['openai', 'azure', 'nvidia', 'deepseek', 'custom']),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1),
  thinkingEnabled: z.boolean().optional(),
  teamId: z.string().optional(),
});

const credentialUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  defaultModel: z.string().min(1).optional(),
  thinkingEnabled: z.boolean().optional(),
});

function publicCredential(c: {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  defaultModel: string;
  thinkingEnabled?: boolean;
  apiKeyLast4: string;
  teamId: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    provider: c.provider,
    baseUrl: c.baseUrl,
    defaultModel: c.defaultModel,
    thinkingEnabled: Boolean(c.thinkingEnabled),
    apiKeyLast4: c.apiKeyLast4,
    teamId: c.teamId,
    userId: c.userId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export async function credentialRoutes(app: FastifyInstance) {
  app.get('/api/llm/presets', async (_request, reply) => {
    return {
      presets: {
        ...PROVIDER_PRESETS,
        azure: {
          label: 'Azure OpenAI',
          baseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT',
          defaultModel: 'gpt-4o',
          defaultEmbeddingModel: 'text-embedding-3-small',
        },
        custom: {
          label: 'Custom OpenAI-compatible',
          baseUrl: 'https://example.com/v1',
          defaultModel: 'your-model',
          defaultEmbeddingModel: 'text-embedding-3-small',
        },
      },
    };
  });

  app.get('/api/credentials', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const teamIds = (
        await prisma.teamMember.findMany({
          where: { userId: request.user!.id },
          select: { teamId: true },
        })
      ).map((t) => t.teamId);

      const credentials = await prisma.modelCredential.findMany({
        where: {
          OR: [{ userId: request.user!.id }, { teamId: { in: teamIds } }],
        },
        orderBy: { updatedAt: 'desc' },
      });
      return { credentials: credentials.map(publicCredential) };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/credentials', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = credentialSchema.parse(request.body);
      if (body.teamId) {
        const member = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: body.teamId, userId: request.user!.id } },
        });
        if (!member || !canManageTeam(member.role)) {
          throw new AppError(403, 'forbidden', 'Team admin required for team credentials');
        }
      }

      const preset = PROVIDER_PRESETS[body.provider as keyof typeof PROVIDER_PRESETS];
      const baseUrl = body.baseUrl || preset?.baseUrl;
      if (!baseUrl) throw new AppError(400, 'validation', 'baseUrl required');

      const enc = encryptSecret(body.apiKey);
      const credential = await prisma.modelCredential.create({
        data: {
          userId: body.teamId ? null : request.user!.id,
          teamId: body.teamId ?? null,
          name: body.name,
          provider: body.provider,
          baseUrl,
          apiKeyCipher: enc.cipher,
          apiKeyIv: enc.iv,
          apiKeyTag: enc.tag,
          apiKeyLast4: last4(body.apiKey),
          defaultModel: body.defaultModel,
          thinkingEnabled: Boolean(body.thinkingEnabled),
        },
      });

      await writeAudit({
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Created model credential',
        detail: `${credential.name} (${credential.provider}) ****${credential.apiKeyLast4}`,
        module: 'Settings',
      });

      return { credential: publicCredential(credential) };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.patch('/api/credentials/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = credentialUpdateSchema.parse(request.body ?? {});
      const credential = await prisma.modelCredential.findUnique({ where: { id } });
      if (!credential) throw new AppError(404, 'not_found', 'Credential not found');
      if (credential.userId && credential.userId !== request.user!.id) {
        throw new AppError(403, 'forbidden', 'Forbidden');
      }
      if (credential.teamId) {
        const member = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: credential.teamId, userId: request.user!.id } },
        });
        if (!member || !canManageTeam(member.role)) throw new AppError(403, 'forbidden', 'Forbidden');
      }
      const updated = await prisma.modelCredential.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.defaultModel !== undefined ? { defaultModel: body.defaultModel } : {}),
          ...(body.thinkingEnabled !== undefined ? { thinkingEnabled: body.thinkingEnabled } : {}),
        },
      });
      await writeAudit({
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Updated model credential',
        detail: `${updated.name} thinking=${updated.thinkingEnabled ? 'on' : 'off'}`,
        module: 'Settings',
      });
      return { credential: publicCredential(updated) };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.delete('/api/credentials/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const credential = await prisma.modelCredential.findUnique({ where: { id } });
      if (!credential) throw new AppError(404, 'not_found', 'Credential not found');
      if (credential.userId && credential.userId !== request.user!.id) {
        throw new AppError(403, 'forbidden', 'Forbidden');
      }
      if (credential.teamId) {
        const member = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: credential.teamId, userId: request.user!.id } },
        });
        if (!member || !canManageTeam(member.role)) throw new AppError(403, 'forbidden', 'Forbidden');
      }
      await prisma.modelCredential.delete({ where: { id } });
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/credentials/:id/test', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const credential = await prisma.modelCredential.findUnique({ where: { id } });
      if (!credential) throw new AppError(404, 'not_found', 'Credential not found');

      const result = await callChatCompletions({
        credentialId: id,
        messages: [
          { role: 'system', content: 'Reply with the single word: ok' },
          { role: 'user', content: 'ping' },
        ],
        temperature: 0,
        timeoutMs: 30_000,
      });
      return {
        ok: true,
        model: result.model,
        provider: result.provider,
        latencyMs: result.latencyMs,
        sample: result.content.slice(0, 200),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/llm/chat', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const body = z
        .object({
          credentialId: z.string(),
          model: z.string().optional(),
          messages: z
            .array(
              z.object({
                role: z.enum(['system', 'user', 'assistant']),
                content: z.string(),
              }),
            )
            .min(1),
          projectId: z.string().optional(),
          context: z
            .object({
              module: z.string().optional(),
              citationId: z.string().optional(),
            })
            .optional(),
        })
        .parse(request.body);

      if (body.projectId) {
        await requireProjectMember(body.projectId, request.user!.id);
      }

      const contextBlock = await buildAssistantContextBlock({
        projectId: body.projectId,
        module: body.context?.module,
        citationId: body.context?.citationId,
      });
      const projectLang = body.projectId
        ? (await prisma.project.findUnique({ where: { id: body.projectId }, select: { llmResponseLanguage: true } }))
            ?.llmResponseLanguage
        : 'zh';
      const systemPrefix = {
        role: 'system' as const,
        content: `You are Qiuzheng AI assistant for systematic reviews. Use only the provided task context; do not invent citation evidence. Prompt version: ${ASSISTANT_CHAT_PROMPT_VERSION}\n\nTASK CONTEXT:\n${contextBlock}`,
      };
      const messages = applyLlmResponseLanguage(
        [systemPrefix, ...body.messages.filter((m) => m.role !== 'system')],
        projectLang,
        'chat',
      );

      const completion = await callChatCompletions({
        credentialId: body.credentialId,
        model: body.model,
        messages,
      });

      await prisma.modelRun.create({
        data: {
          projectId: body.projectId,
          citationId: body.context?.citationId,
          userId: request.user!.id,
          credentialId: body.credentialId,
          provider: completion.provider,
          model: completion.model,
          promptVersion: ASSISTANT_CHAT_PROMPT_VERSION,
          status: 'succeeded',
          latencyMs: completion.latencyMs,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          requestMeta: { module: body.context?.module || null },
        },
      });

      return {
        content: completion.content,
        model: completion.model,
        provider: completion.provider,
        latencyMs: completion.latencyMs,
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
