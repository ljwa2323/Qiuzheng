import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';
import { createQueue, defaultJobOptions, QUEUE_SCREEN } from '../lib/queue.js';
import {
  buildScreeningMessages,
  buildFulltextMessages,
  buildAdjudicationMessages,
  buildCriterionLocateMessages,
  callChatCompletions,
  parseScreeningJson,
  parseAdjudicationJson,
  parseCriterionLocateJson,
  matchEvidenceInSource,
  citationAiSource,
  applyLlmResponseLanguage,
  prepareGroundedSource,
  SCREEN_PROMPT_VERSION,
  FULLTEXT_PROMPT_VERSION,
  ADJUDICATION_PROMPT_VERSION,
  CRITERION_LOCATE_PROMPT_VERSION,
} from '../services/llm.js';

function screenQueue() {
  return createQueue(QUEUE_SCREEN);
}

function normalizeDoi(doi?: string | null) {
  return String(doi || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
}

function normalizeTitle(title?: string | null) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const decisionSchema = z.object({
  decision: z.enum(['Include', 'Exclude', 'Uncertain']),
  criterionIds: z.array(z.string()).default([]),
  evidence: z.string().optional(),
  rationale: z.string().optional(),
  confidence: z.string().optional(),
  uncertainty: z.string().optional(),
});

export async function screeningRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/screening/queue', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const query = request.query as { skip?: string; take?: string };
      const take = Math.min(Number(query.take || 20), 5000);
      const skip = Number(query.skip || 0);

      const citations = await prisma.citation.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
        include: {
          decisions: {
            where: { OR: [{ actor: 'human' }, { actor: 'human_b' }, { actor: 'ai' }, { actor: 'final' }] },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
      const total = await prisma.citation.count({ where: { projectId } });
      return { citations, total, skip, take };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/screening/diff/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new AppError(404, 'not_found', 'Project not found');

      const citations = await prisma.citation.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        include: {
          decisions: {
            where: { actor: 'human' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      const decisions = citations
        .map((c) => {
          const d = c.decisions[0];
          if (!d) return null;
          return {
            citationId: c.id,
            doi: c.doi || '',
            title: c.title,
            decision: d.decision,
            rationale: d.rationale || '',
            evidence: d.evidence || '',
            criterionIds: d.criterionIds || [],
          };
        })
        .filter(Boolean);

      return {
        schema: 'qiuzheng.screening.diff.v1',
        stage: 'title_abstract',
        exportedAt: new Date().toISOString(),
        projectId,
        projectName: project.name,
        reviewer: {
          label: request.user!.name,
          email: request.user!.email,
        },
        decisions,
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/screening/diff/import', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);

      const body = z
        .object({
          schema: z.string().optional(),
          stage: z.string().optional(),
          reviewer: z
            .object({
              label: z.string().optional(),
              email: z.string().optional(),
            })
            .optional(),
          decisions: z
            .array(
              z.object({
                citationId: z.string().optional(),
                doi: z.string().optional(),
                title: z.string().optional(),
                decision: z.enum(['Include', 'Exclude', 'Uncertain']),
                rationale: z.string().optional(),
                evidence: z.string().optional(),
                criterionIds: z.array(z.string()).optional(),
              }),
            )
            .min(1)
            .max(20000),
        })
        .parse(request.body);

      if (body.schema && body.schema !== 'qiuzheng.screening.diff.v1') {
        throw new AppError(400, 'validation', `Unsupported schema: ${body.schema}`);
      }
      if (body.stage && body.stage !== 'title_abstract') {
        throw new AppError(400, 'validation', 'This import only supports stage=title_abstract');
      }

      const citations = await prisma.citation.findMany({
        where: { projectId },
        include: {
          decisions: {
            where: { OR: [{ actor: 'human' }, { actor: 'human_b' }, { actor: 'final' }] },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      const byId = new Map(citations.map((c) => [c.id, c]));
      const byDoi = new Map<string, (typeof citations)[0]>();
      const byTitle = new Map<string, (typeof citations)[0]>();
      for (const c of citations) {
        const doi = normalizeDoi(c.doi);
        if (doi && !byDoi.has(doi)) byDoi.set(doi, c);
        const title = normalizeTitle(c.title);
        if (title && !byTitle.has(title)) byTitle.set(title, c);
      }

      const reviewerLabel = body.reviewer?.label || body.reviewer?.email || 'Reviewer B';
      let matched = 0;
      let written = 0;
      let conflicts = 0;
      let agreements = 0;
      const unmatched: Array<{ title?: string; doi?: string; citationId?: string }> = [];

      for (const row of body.decisions) {
        const citation =
          (row.citationId && byId.get(row.citationId)) ||
          (normalizeDoi(row.doi) && byDoi.get(normalizeDoi(row.doi))) ||
          (normalizeTitle(row.title) && byTitle.get(normalizeTitle(row.title))) ||
          null;

        if (!citation) {
          unmatched.push({ citationId: row.citationId, doi: row.doi, title: row.title });
          continue;
        }
        matched += 1;

        const rationale = row.rationale?.trim()
          ? row.rationale
          : `[imported human_b] from ${reviewerLabel}`;

        await prisma.screeningDecision.create({
          data: {
            projectId,
            citationId: citation.id,
            actor: 'human_b',
            decision: row.decision,
            criterionIds: row.criterionIds || [],
            evidence: row.evidence || null,
            rationale,
            userId: request.user!.id,
          },
        });
        written += 1;

        const localHuman = citation.decisions.find((d) => d.actor === 'human');
        if (localHuman) {
          if (localHuman.decision === row.decision) agreements += 1;
          else conflicts += 1;
        }
      }

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Imported screening Diff (human_b)',
        detail: `${written} written · ${conflicts} conflicts · ${agreements} agreements · ${unmatched.length} unmatched · reviewer ${reviewerLabel}`,
        module: 'Screening',
      });

      return {
        ok: true,
        matched,
        written,
        conflicts,
        agreements,
        unmatchedCount: unmatched.length,
        unmatched: unmatched.slice(0, 50),
        reviewerLabel,
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post(
    '/api/projects/:projectId/screening/:citationId/human',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
        assertCanWrite(membership.role);
        const body = decisionSchema.parse(request.body);
        const citation = await prisma.citation.findFirst({ where: { id: citationId, projectId } });
        if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

        const record = await prisma.screeningDecision.create({
          data: {
            projectId,
            citationId,
            actor: 'human',
            decision: body.decision,
            criterionIds: body.criterionIds,
            evidence: body.evidence,
            rationale: body.rationale,
            confidence: body.confidence,
            uncertainty: body.uncertainty,
            userId: request.user!.id,
          },
        });

        await writeAudit({
          projectId,
          userId: request.user!.id,
          actorName: request.user!.name,
          action: 'Submitted human screening decision',
          detail: `${body.decision} for ${citation.title}`,
          module: 'Screening',
        });

        return { decision: record };
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );

  app.post(
    '/api/projects/:projectId/screening/:citationId/final',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
        assertCanWrite(membership.role);
        const body = decisionSchema.parse(request.body);
        const citation = await prisma.citation.findFirst({ where: { id: citationId, projectId } });
        if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

        const record = await prisma.screeningDecision.create({
          data: {
            projectId,
            citationId,
            actor: 'final',
            decision: body.decision,
            criterionIds: body.criterionIds,
            evidence: body.evidence,
            rationale: body.rationale,
            confidence: body.confidence,
            uncertainty: body.uncertainty,
            userId: request.user!.id,
          },
        });

        await writeAudit({
          projectId,
          userId: request.user!.id,
          actorName: request.user!.name,
          action: 'Submitted final screening decision',
          detail: `${body.decision} for ${citation.title}`,
          module: 'Adjudication',
        });

        return { decision: record };
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );

  app.post(
    '/api/projects/:projectId/screening/:citationId/ai',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
        assertCanWrite(membership.role);
        const body = z
          .object({
            credentialId: z.string().optional(),
            model: z.string().optional(),
            async: z.boolean().optional(),
          })
          .parse(request.body ?? {});

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        const credentialId = body.credentialId || project?.credentialId;
        if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

        if (body.async) {
          const job = await prisma.job.create({
            data: {
              projectId,
              userId: request.user!.id,
              type: 'screening_ai',
              status: 'queued',
              payload: { citationId, credentialId, model: body.model },
            },
          });
          const bullJob = await screenQueue().add(
            'screen-one',
            { jobId: job.id, projectId, citationId, credentialId, model: body.model, userId: request.user!.id },
            defaultJobOptions(),
          );
          await prisma.job.update({ where: { id: job.id }, data: { bullJobId: String(bullJob.id) } });
          return { jobId: job.id, queued: true };
        }

        const result = await runScreeningAi({
          projectId,
          citationId,
          credentialId,
          model: body.model,
          userId: request.user!.id,
        });
        return result;
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );

  app.post('/api/projects/:projectId/screening/batch-ai', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          citationIds: z.array(z.string()).min(1).max(5000),
          credentialId: z.string().optional(),
          model: z.string().optional(),
        })
        .parse(request.body);

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const credentialId = body.credentialId || project?.credentialId;
      if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

      const job = await prisma.job.create({
        data: {
          projectId,
          userId: request.user!.id,
          type: 'screening_ai_batch',
          status: 'queued',
          payload: { citationIds: body.citationIds, credentialId, model: body.model },
        },
      });

      const bullJob = await screenQueue().add(
        'screen-batch',
        {
          jobId: job.id,
          projectId,
          citationIds: body.citationIds,
          credentialId,
          model: body.model,
          userId: request.user!.id,
        },
        defaultJobOptions(),
      );
      await prisma.job.update({ where: { id: job.id }, data: { bullJobId: String(bullJob.id) } });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Queued batch AI screening',
        detail: `${body.citationIds.length} citations`,
        module: 'Screening',
      });

      return { jobId: job.id };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post(
    '/api/projects/:projectId/citations/:citationId/criterion-locate',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        await requireProjectMember(projectId, request.user!.id);
        const body = z
          .object({
            criterionId: z.string().trim().min(1).max(64),
            criterionTitle: z.string().trim().max(400).optional(),
            includeTexts: z.array(z.string().trim().max(2_000)).max(20).optional(),
            excludeTexts: z.array(z.string().trim().max(2_000)).max(20).optional(),
            credentialId: z.string().optional(),
            model: z.string().optional(),
          })
          .parse(request.body ?? {});

        const [citation, project, protocol] = await Promise.all([
          prisma.citation.findFirst({ where: { id: citationId, projectId } }),
          prisma.project.findUnique({ where: { id: projectId } }),
          prisma.protocolVersion.findFirst({
            where: { projectId },
            orderBy: { version: 'desc' },
            include: { criteria: { orderBy: { sortOrder: 'asc' } } },
          }),
        ]);
        if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

        const criterion = (protocol?.criteria || []).find(
          (row) => row.code === body.criterionId || row.id === body.criterionId,
        );
        const criterionTitle = body.criterionTitle || criterion?.title || body.criterionId;
        const includeText = (body.includeTexts?.length
          ? body.includeTexts
          : [criterion?.includeText || '']
        ).filter(Boolean).join('\n');
        const excludeText = (body.excludeTexts?.length
          ? body.excludeTexts
          : [criterion?.excludeText || '']
        ).filter(Boolean).join('\n');

        const fullSource = citationAiSource(citation);
        if (!fullSource.trim()) {
          return {
            quote: '',
            quotes: [],
            method: 'none',
            usedEmbeddings: false,
            usedLlm: false,
            cacheHit: false,
            rankedEvidence: [],
          };
        }

        // 1) Cheap literal match first (rules, no LLM).
        const literalNeedles = [
          ...((body.includeTexts || []).length ? body.includeTexts! : [criterion?.includeText || '']),
          ...((body.excludeTexts || []).length ? body.excludeTexts! : [criterion?.excludeText || '']),
          criterionTitle,
          body.criterionId,
        ]
          .map((item) => String(item || '').trim())
          .filter((item) => item.length >= 4);
        for (const needle of literalNeedles) {
          const hit = matchEvidenceInSource(fullSource, needle);
          if (hit) {
            return {
              quote: hit,
              quotes: [hit],
              method: 'literal',
              usedEmbeddings: false,
              usedLlm: false,
              cacheHit: false,
              rankedEvidence: [],
            };
          }
        }

        // 2) Embedding recall with a lower similarity floor.
        const query = [
          `Criterion ${body.criterionId}: ${criterionTitle}`,
          includeText ? `Include: ${includeText}` : '',
          excludeText ? `Exclude: ${excludeText}` : '',
        ].filter(Boolean).join('\n');
        const grounded = await prepareGroundedSource({
          projectId,
          sourceText: fullSource,
          query,
          topK: 8,
          minScore: 0.12,
          citationId,
        });

        // 3) LLM selects verbatim quotes from ranked SOURCE.
        const credentialId = body.credentialId || project?.credentialId;
        let quotes: string[] = [];
        let usedLlm = false;
        if (credentialId) {
          usedLlm = true;
          const completion = await callChatCompletions({
            credentialId,
            model: body.model,
            messages: applyLlmResponseLanguage(
              buildCriterionLocateMessages({
                title: citation.title,
                criterionCode: body.criterionId,
                criterionTitle,
                includeText,
                excludeText,
                sourceText: grounded.sourceText,
              }),
              project?.llmResponseLanguage,
            ),
            responseFormatJson: true,
          });
          let rawQuotes: string[] = [];
          try {
            rawQuotes = parseCriterionLocateJson(completion.content);
          } catch {
            rawQuotes = [];
          }
          quotes = rawQuotes
            .map((q) => matchEvidenceInSource(fullSource, q))
            .filter(Boolean);
          await prisma.modelRun.create({
            data: {
              projectId,
              citationId,
              userId: request.user!.id,
              credentialId,
              provider: completion.provider,
              model: completion.model,
              promptVersion: CRITERION_LOCATE_PROMPT_VERSION,
              status: 'succeeded',
              latencyMs: completion.latencyMs,
              inputTokens: completion.inputTokens,
              outputTokens: completion.outputTokens,
              requestMeta: {
                criterionId: body.criterionId,
                usedEmbeddings: grounded.usedEmbeddings,
                cacheHit: grounded.cacheHit,
                mode: 'criterion-locate',
              },
              responseMeta: { quoteCount: quotes.length, rawCount: rawQuotes.length },
            },
          });
        }

        if (!quotes.length && grounded.ranked[0]) {
          quotes = [grounded.ranked[0].text];
        }

        return {
          quote: quotes[0] || '',
          quotes,
          method: quotes.length
            ? (usedLlm ? 'embedding+llm' : 'embedding')
            : (grounded.usedEmbeddings ? 'embedding-miss' : 'none'),
          usedEmbeddings: grounded.usedEmbeddings,
          usedLlm,
          cacheHit: grounded.cacheHit,
          rankedEvidence: grounded.ranked,
        };
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );

  app.post(
    '/api/projects/:projectId/screening/:citationId/fulltext-ai',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
        assertCanWrite(membership.role);
        const body = z
          .object({
            credentialId: z.string().optional(),
            model: z.string().optional(),
          })
          .parse(request.body ?? {});

        const [citation, project, protocol] = await Promise.all([
          prisma.citation.findFirst({ where: { id: citationId, projectId } }),
          prisma.project.findUnique({ where: { id: projectId } }),
          prisma.protocolVersion.findFirst({
            where: { projectId },
            orderBy: { version: 'desc' },
            include: { criteria: { orderBy: { sortOrder: 'asc' } } },
          }),
        ]);
        if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
        const credentialId = body.credentialId || project?.credentialId;
        if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

        const sourceText = citationAiSource(citation);
        const criteriaQuery = (protocol?.criteria || [])
          .map((c) => `${c.code} ${c.title}: ${c.includeText}`)
          .join('\n');
        const grounded = await prepareGroundedSource({
          projectId,
          sourceText,
          query: `${protocol?.question || project?.question || ''}\n${criteriaQuery}`,
          topK: 8,
          citationId: citation.id,
        });
        const completion = await callChatCompletions({
          credentialId,
          model: body.model,
          messages: applyLlmResponseLanguage(
            buildFulltextMessages({
              question: protocol?.question || project?.question || '',
              criteria: (protocol?.criteria || []).map((c) => ({
                code: c.code,
                title: c.title,
                includeText: c.includeText,
                excludeText: c.excludeText,
              })),
              title: citation.title,
              authors: citation.authors,
              sourceText: grounded.sourceText,
            }),
            project?.llmResponseLanguage,
          ),
          responseFormatJson: true,
        });

        let parsed;
        try {
          parsed = parseScreeningJson(completion.content);
        } catch {
          throw new AppError(502, 'llm_parse_error', 'Model returned invalid full-text JSON');
        }
        const evidenceSpans = parsed.evidenceSpans
          .map((span) => matchEvidenceInSource(sourceText, span))
          .filter(Boolean);
        if (parsed.evidenceSpans.length && !evidenceSpans.length) {
          throw new AppError(502, 'llm_evidence_error', 'Model evidence was not found in the source text');
        }

        const modelRun = await prisma.modelRun.create({
          data: {
            projectId,
            citationId,
            userId: request.user!.id,
            credentialId,
            provider: completion.provider,
            model: completion.model,
            promptVersion: FULLTEXT_PROMPT_VERSION,
            status: 'succeeded',
            latencyMs: completion.latencyMs,
            inputTokens: completion.inputTokens,
            outputTokens: completion.outputTokens,
            responseMeta: { ...parsed, evidenceSpans },
          },
        });

        const decision = await prisma.screeningDecision.create({
          data: {
            projectId,
            citationId,
            actor: 'ai',
            decision: parsed.decision,
            criterionIds: parsed.criterionIds,
            evidence: evidenceSpans.join(' | ') || null,
            rationale: `[fulltext] ${parsed.rationale}`,
            confidence: parsed.confidence,
            uncertainty: parsed.uncertainty,
            modelRunId: modelRun.id,
          },
        });

        await writeAudit({
          projectId,
          userId: request.user!.id,
          actorName: 'Qiuzheng AI',
          action: 'Suggested full-text eligibility',
          detail: `${parsed.decision} for ${citation.title}`,
          module: 'Full text',
          version: FULLTEXT_PROMPT_VERSION,
        });

        return { decision, result: { ...parsed, evidenceSpans }, modelRun };
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );

  app.post(
    '/api/projects/:projectId/screening/:citationId/adjudication-suggest',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { projectId, citationId } = request.params as { projectId: string; citationId: string };
        const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
        assertCanWrite(membership.role);
        const body = z
          .object({
            credentialId: z.string().optional(),
            model: z.string().optional(),
          })
          .parse(request.body ?? {});

        const [citation, project, protocol] = await Promise.all([
          prisma.citation.findFirst({
            where: { id: citationId, projectId },
            include: { decisions: { orderBy: { createdAt: 'desc' } } },
          }),
          prisma.project.findUnique({ where: { id: projectId } }),
          prisma.protocolVersion.findFirst({ where: { projectId }, orderBy: { version: 'desc' } }),
        ]);
        if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
        const human = citation.decisions.find((d) => d.actor === 'human');
        const ai = citation.decisions.find((d) => d.actor === 'ai');
        if (!human || !ai) throw new AppError(400, 'missing_decisions', 'Need both human and AI decisions');
        if (human.decision === ai.decision) {
          throw new AppError(400, 'no_conflict', 'Human and AI already agree');
        }
        const credentialId = body.credentialId || project?.credentialId;
        if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');

        const completion = await callChatCompletions({
          credentialId,
          model: body.model,
          messages: applyLlmResponseLanguage(
            buildAdjudicationMessages({
              question: protocol?.question || project?.question || '',
              title: citation.title,
              abstract: citation.abstract,
              human: { decision: human.decision, rationale: human.rationale, evidence: human.evidence },
              ai: { decision: ai.decision, rationale: ai.rationale, evidence: ai.evidence },
            }),
            project?.llmResponseLanguage,
          ),
          responseFormatJson: true,
        });

        let parsed;
        try {
          parsed = parseAdjudicationJson(completion.content);
        } catch {
          throw new AppError(502, 'llm_parse_error', 'Model returned invalid adjudication JSON');
        }
        const evidenceSpans = parsed.evidenceSpans
          .map((span) => matchEvidenceInSource(citation.abstract, span))
          .filter(Boolean);

        const modelRun = await prisma.modelRun.create({
          data: {
            projectId,
            citationId,
            userId: request.user!.id,
            credentialId,
            provider: completion.provider,
            model: completion.model,
            promptVersion: ADJUDICATION_PROMPT_VERSION,
            status: 'succeeded',
            latencyMs: completion.latencyMs,
            inputTokens: completion.inputTokens,
            outputTokens: completion.outputTokens,
            responseMeta: { ...parsed, evidenceSpans, suggestionOnly: true },
          },
        });

        await writeAudit({
          projectId,
          userId: request.user!.id,
          actorName: 'Qiuzheng AI',
          action: 'Suggested adjudication (not final)',
          detail: `${parsed.decision} for ${citation.title}`,
          module: 'Adjudication',
          version: ADJUDICATION_PROMPT_VERSION,
        });

        return {
          suggestion: {
            decision: parsed.decision,
            rationale: parsed.rationale,
            evidence: evidenceSpans.join(' | '),
            evidenceSpans,
            confidence: parsed.confidence,
          },
          modelRun,
        };
      } catch (err) {
        return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
      }
    },
  );
}

export async function runScreeningAi(input: {
  projectId: string;
  citationId: string;
  credentialId: string;
  model?: string;
  userId?: string;
}) {
  const citation = await prisma.citation.findFirst({
    where: { id: input.citationId, projectId: input.projectId },
  });
  if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

  const protocol = await prisma.protocolVersion.findFirst({
    where: { projectId: input.projectId },
    orderBy: { version: 'desc' },
    include: { criteria: { orderBy: { sortOrder: 'asc' } } },
  });
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });

  const messages = applyLlmResponseLanguage(
    buildScreeningMessages({
      question: protocol?.question || project?.question || '',
      criteria: (protocol?.criteria || []).map((c) => ({
        code: c.code,
        title: c.title,
        includeText: c.includeText,
        excludeText: c.excludeText,
      })),
      title: citation.title,
      authors: citation.authors,
      abstract: citation.abstract,
    }),
    project?.llmResponseLanguage,
  );

  let completion;
  try {
    completion = await callChatCompletions({
      credentialId: input.credentialId,
      model: input.model,
      messages,
      responseFormatJson: true,
    });
  } catch (err) {
    await prisma.modelRun.create({
      data: {
        projectId: input.projectId,
        citationId: input.citationId,
        userId: input.userId,
        credentialId: input.credentialId,
        provider: 'custom',
        model: input.model || 'unknown',
        promptVersion: SCREEN_PROMPT_VERSION,
        status: 'failed',
        errorMessage: (err as Error).message,
      },
    });
    throw err;
  }

  let parsed;
  try {
    parsed = parseScreeningJson(completion.content);
  } catch (err) {
    await prisma.modelRun.create({
      data: {
        projectId: input.projectId,
        citationId: input.citationId,
        userId: input.userId,
        credentialId: input.credentialId,
        provider: completion.provider,
        model: completion.model,
        promptVersion: SCREEN_PROMPT_VERSION,
        status: 'failed',
        latencyMs: completion.latencyMs,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        responseMeta: { content: completion.content },
        errorMessage: (err as Error).message,
      },
    });
    throw new AppError(502, 'llm_parse_error', 'Model returned invalid screening JSON');
  }

  const modelRun = await prisma.modelRun.create({
    data: {
      projectId: input.projectId,
      citationId: input.citationId,
      userId: input.userId,
      credentialId: input.credentialId,
      provider: completion.provider,
      model: completion.model,
      promptVersion: SCREEN_PROMPT_VERSION,
      status: 'succeeded',
      latencyMs: completion.latencyMs,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      requestMeta: { promptVersion: SCREEN_PROMPT_VERSION },
      responseMeta: parsed as object,
    },
  });

  const decision = await prisma.screeningDecision.create({
    data: {
      projectId: input.projectId,
      citationId: input.citationId,
      actor: 'ai',
      decision: parsed.decision,
      criterionIds: parsed.criterionIds,
      evidence: parsed.evidenceSpans.join(' | '),
      rationale: parsed.rationale,
      confidence: parsed.confidence,
      uncertainty: parsed.uncertainty,
      userId: input.userId,
      modelRunId: modelRun.id,
    },
  });

  return { decision, modelRun, result: parsed };
}
