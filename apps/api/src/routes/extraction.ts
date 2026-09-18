import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { createQueue, defaultJobOptions, QUEUE_EXTRACT } from '../lib/queue.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';
import { ensureDefaultExtractionFields } from '../services/extraction-defaults.js';
import {
  buildExtractionMessages,
  callChatCompletions,
  matchEvidenceInSource,
  parseExtractionJson,
  citationAiSource,
  applyLlmResponseLanguage,
  prepareGroundedSource,
  EXTRACTION_PROMPT_VERSION,
} from '../services/llm.js';

const fieldSchema = z.object({
  key: z.string().trim().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(120),
  dataType: z.enum(['text', 'number', 'boolean', 'select', 'date']).default('text'),
  description: z.string().trim().max(500).default(''),
  options: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

function extractQueue() {
  return createQueue(QUEUE_EXTRACT);
}

export async function runExtractionAi(input: {
  projectId: string;
  citationId: string;
  credentialId: string;
  model?: string;
  fieldIds?: string[];
  userId: string;
}) {
  const { projectId, citationId, credentialId, model, fieldIds, userId } = input;
  await ensureDefaultExtractionFields(projectId, userId);
  const [citation, project, protocol, allFields] = await Promise.all([
    prisma.citation.findFirst({ where: { id: citationId, projectId } }),
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.protocolVersion.findFirst({ where: { projectId }, orderBy: { version: 'desc' } }),
    prisma.extractionField.findMany({
      where: { projectId, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
  const fields = fieldIds?.length ? allFields.filter((f) => fieldIds.includes(f.id)) : allFields;
  if (!fields.length) throw new AppError(400, 'no_fields', 'No extraction fields configured');

  const sourceText = citationAiSource(citation);
  const fieldQuery = fields.map((f) => `${f.label}: ${f.description || f.key}`).join('\n');
  const grounded = await prepareGroundedSource({
    projectId,
    sourceText,
    query: `${protocol?.question || project?.question || ''}\n${fieldQuery}`,
    topK: 8,
    citationId: citation.id,
  });
      const completion = await callChatCompletions({
        credentialId,
        model,
        messages: applyLlmResponseLanguage(
          buildExtractionMessages({
            question: protocol?.question || project?.question || '',
            title: citation.title,
            authors: citation.authors,
            sourceText: grounded.sourceText,
            fields: fields.map((f) => ({
              key: f.key,
              label: f.label,
              dataType: f.dataType,
              description: f.description,
              options: f.options,
            })),
          }),
          project?.llmResponseLanguage,
        ),
        responseFormatJson: true,
      });

  let parsed;
  try {
    parsed = parseExtractionJson(completion.content);
  } catch {
    throw new AppError(502, 'llm_parse_error', 'Model returned invalid extraction JSON');
  }

  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const saved = [];
  const skipped = [];
  for (const row of parsed) {
    const field = fieldByKey[row.key];
    if (!field) {
      skipped.push({ key: row.key, reason: 'unknown_field' });
      continue;
    }
    if (!row.value) {
      skipped.push({ key: row.key, reason: 'empty_value' });
      continue;
    }
    const evidenceText = row.evidenceText ? matchEvidenceInSource(sourceText, row.evidenceText) : '';
    if (row.evidenceText && !evidenceText) {
      skipped.push({ key: row.key, reason: 'evidence_not_in_source' });
      continue;
    }
    const value = await prisma.extractionValue.upsert({
      where: { citationId_fieldId: { citationId, fieldId: field.id } },
      create: {
        projectId,
        citationId,
        fieldId: field.id,
        value: row.value,
        evidenceText: evidenceText || null,
        sourceLocation: citation.fullTextMarkdown?.trim() ? 'Full text (Markdown)' : 'Abstract',
        confidence: row.confidence,
        verified: false,
        createdBy: userId,
      },
      update: {
        value: row.value,
        evidenceText: evidenceText || null,
        sourceLocation: citation.fullTextMarkdown?.trim() ? 'Full text (Markdown)' : 'Abstract',
        confidence: row.confidence,
        verified: false,
        createdBy: userId,
      },
    });
    saved.push(value);
  }

  await prisma.modelRun.create({
    data: {
      projectId,
      citationId,
      userId,
      credentialId,
      provider: completion.provider,
      model: completion.model,
      promptVersion: EXTRACTION_PROMPT_VERSION,
      status: 'succeeded',
      latencyMs: completion.latencyMs,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      responseMeta: { saved: saved.length, skipped },
    },
  });

  await writeAudit({
    projectId,
    userId,
    actorName: 'Qiuzheng AI',
    action: 'AI prefilled extraction values',
    detail: `${citation.title}: saved ${saved.length}, skipped ${skipped.length}`,
    module: 'Extraction',
    version: EXTRACTION_PROMPT_VERSION,
  });

  return { values: saved, skipped, count: saved.length };
}

export async function extractionRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/extraction/fields', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      await ensureDefaultExtractionFields(projectId, request.user!.id);
      const fields = await prisma.extractionField.findMany({
        where: { projectId, active: true },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { fields };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/extraction/fields', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = fieldSchema.parse(request.body);
      const existing = await prisma.extractionField.findUnique({ where: { projectId_key: { projectId, key: body.key } } });
      if (existing) throw new AppError(409, 'field_key_taken', 'Field key already exists in this project');
      let sortOrder = body.sortOrder;
      if (sortOrder == null) {
        const max = await prisma.extractionField.aggregate({
          where: { projectId, active: true },
          _max: { sortOrder: true },
        });
        sortOrder = (max._max.sortOrder ?? -10) + 10;
      }
      const field = await prisma.extractionField.create({
        data: {
          key: body.key,
          label: body.label,
          dataType: body.dataType,
          description: body.description,
          options: body.options,
          required: body.required,
          sortOrder,
          group: 'characteristics',
          projectId,
          createdBy: request.user!.id,
        },
        include: { creator: { select: { id: true, name: true } } },
      });
      await writeAudit({ projectId, userId: request.user!.id, actorName: request.user!.name, action: 'Created extraction field', detail: `${field.label} (${field.key})`, module: 'Extraction' });
      return reply.status(201).send({ field });
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.put('/api/projects/:projectId/extraction/fields/reorder', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        fieldIds: z.array(z.string().min(1)).min(1).max(500),
      }).parse(request.body ?? {});

      const active = await prisma.extractionField.findMany({
        where: { projectId, active: true },
        select: { id: true },
      });
      const activeIds = new Set(active.map((row) => row.id));
      const uniqueIds = [...new Set(body.fieldIds)];
      if (uniqueIds.length !== activeIds.size || uniqueIds.some((id) => !activeIds.has(id))) {
        throw new AppError(400, 'validation', 'fieldIds must include every active extraction field exactly once');
      }

      await prisma.$transaction(
        uniqueIds.map((id, index) =>
          prisma.extractionField.update({
            where: { id },
            data: { sortOrder: index * 10 },
          }),
        ),
      );

      const fields = await prisma.extractionField.findMany({
        where: { projectId, active: true },
        include: { creator: { select: { id: true, name: true } } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Reordered extraction fields',
        detail: `${fields.length} fields`,
        module: 'Extraction',
      });
      return { fields };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.patch('/api/projects/:projectId/extraction/fields/:fieldId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, fieldId } = request.params as { projectId: string; fieldId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = fieldSchema.partial().parse(request.body);
      const current = await prisma.extractionField.findFirst({ where: { id: fieldId, projectId, active: true } });
      if (!current) throw new AppError(404, 'not_found', 'Extraction field not found');
      if (body.key && body.key !== current.key) {
        const duplicate = await prisma.extractionField.findUnique({ where: { projectId_key: { projectId, key: body.key } } });
        if (duplicate) throw new AppError(409, 'field_key_taken', 'Field key already exists in this project');
      }
      const { sortOrder, ...rest } = body;
      const field = await prisma.extractionField.update({
        where: { id: fieldId },
        data: {
          ...rest,
          ...(sortOrder != null ? { sortOrder } : {}),
        },
      });
      await writeAudit({ projectId, userId: request.user!.id, actorName: request.user!.name, action: 'Updated extraction field', detail: `${field.label} (${field.key})`, module: 'Extraction' });
      return { field };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.delete('/api/projects/:projectId/extraction/fields/:fieldId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, fieldId } = request.params as { projectId: string; fieldId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const current = await prisma.extractionField.findFirst({
        where: { id: fieldId, projectId },
        include: { _count: { select: { values: true } } },
      });
      if (!current) throw new AppError(404, 'not_found', 'Extraction field not found');
      const valueCount = current._count.values;
      // Hard delete: ExtractionValue rows cascade via FK onDelete: Cascade.
      await prisma.extractionField.delete({ where: { id: fieldId } });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Deleted extraction field',
        detail: `${current.label} (${current.key}) · removed ${valueCount} value(s)`,
        module: 'Extraction',
      });
      return { ok: true, deletedValues: valueCount };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/extraction/values', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const values = await prisma.extractionValue.findMany({
        where: { projectId, field: { active: true } },
        orderBy: { updatedAt: 'desc' },
      });
      return { values };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put('/api/projects/:projectId/extraction/values/:citationId/:fieldId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId, fieldId } = request.params as { projectId: string; citationId: string; fieldId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        value: z.string().max(10_000).default(''),
        evidenceText: z.string().max(20_000).optional(),
        sourceLocation: z.string().max(200).optional(),
        confidence: z.enum(['High', 'Moderate', 'Low']).optional(),
        verified: z.boolean().default(false),
      }).parse(request.body);
      const [citation, field] = await Promise.all([
        prisma.citation.findFirst({ where: { id: citationId, projectId } }),
        prisma.extractionField.findFirst({ where: { id: fieldId, projectId, active: true } }),
      ]);
      if (!citation || !field) throw new AppError(404, 'not_found', 'Citation or extraction field not found');
      const value = await prisma.extractionValue.upsert({
        where: { citationId_fieldId: { citationId, fieldId } },
        create: { ...body, projectId, citationId, fieldId, createdBy: request.user!.id },
        update: { ...body, createdBy: request.user!.id },
      });
      await writeAudit({ projectId, userId: request.user!.id, actorName: request.user!.name, action: 'Saved extraction value', detail: `${citation.title} · ${field.label}`, module: 'Extraction' });
      return { value };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/extraction/:citationId/ai', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          credentialId: z.string().optional(),
          model: z.string().optional(),
          fieldIds: z.array(z.string()).optional(),
        })
        .parse(request.body ?? {});

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const credentialId = body.credentialId || project?.credentialId;
      if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

      return await runExtractionAi({
        projectId,
        citationId,
        credentialId,
        model: body.model,
        fieldIds: body.fieldIds,
        userId: request.user!.id,
      });
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/extraction/batch-ai', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          citationIds: z.array(z.string()).min(1).max(5000),
          credentialId: z.string().optional(),
          model: z.string().optional(),
          fieldIds: z.array(z.string()).optional(),
        })
        .parse(request.body);

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const credentialId = body.credentialId || project?.credentialId;
      if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

      await ensureDefaultExtractionFields(projectId, request.user!.id);

      const job = await prisma.job.create({
        data: {
          projectId,
          userId: request.user!.id,
          type: 'extraction_ai_batch',
          status: 'queued',
          payload: {
            citationIds: body.citationIds,
            credentialId,
            model: body.model,
            fieldIds: body.fieldIds || [],
          },
        },
      });

      const bullJob = await extractQueue().add(
        'extract-batch',
        {
          jobId: job.id,
          projectId,
          citationIds: body.citationIds,
          credentialId,
          model: body.model,
          fieldIds: body.fieldIds || [],
          userId: request.user!.id,
        },
        defaultJobOptions(),
      );
      await prisma.job.update({ where: { id: job.id }, data: { bullJobId: String(bullJob.id) } });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Queued batch AI extraction',
        detail: `${body.citationIds.length} citations`,
        module: 'Extraction',
      });

      return { jobId: job.id };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
