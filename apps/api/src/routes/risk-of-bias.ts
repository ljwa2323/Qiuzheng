import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import {
  callChatCompletions,
  citationAiSource,
  applyLlmResponseLanguage,
  prepareGroundedSource,
  type ChatMessage,
} from '../services/llm.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';

export const ROB_PROMPT_VERSION = 'rob-2.0';
export const ROB_FIND_PROMPT_VERSION = 'rob-find-1.0';

export const ROB_DOMAINS = [
  {
    key: 'D1',
    title: 'Randomization process',
    questions: [
      { key: 'D1.1', text: 'Was the allocation sequence random?' },
      { key: 'D1.2', text: 'Was the allocation sequence concealed until participants were enrolled and assigned to interventions?' },
    ],
  },
  {
    key: 'D2',
    title: 'Deviations from intended interventions',
    questions: [
      { key: 'D2.1', text: 'Were participants aware of their assigned intervention during the trial?' },
      { key: 'D2.2', text: 'Were carers and people delivering the interventions aware of participants assigned intervention during the trial?' },
    ],
  },
  {
    key: 'D3',
    title: 'Missing outcome data',
    questions: [
      { key: 'D3.1', text: 'Were data for this outcome available for all, or nearly all, participants randomized?' },
      { key: 'D3.2', text: 'Is there evidence that the result was not biased by missing outcome data?' },
    ],
  },
  {
    key: 'D4',
    title: 'Measurement of the outcome',
    questions: [
      { key: 'D4.1', text: 'Was the method of measuring the outcome inappropriate?' },
      { key: 'D4.2', text: 'Could measurement or ascertainment of the outcome have differed between intervention groups?' },
    ],
  },
  {
    key: 'D5',
    title: 'Selection of the reported result',
    questions: [
      { key: 'D5.1', text: 'Was the trial analyzed in accordance with a pre-specified plan that was finalized before unblinded outcome data were available for analysis?' },
      { key: 'D5.2', text: 'Is the numerical result being assessed likely to have been selected, on the basis of the results, from multiple eligible outcome measurements or analyses?' },
    ],
  },
] as const;

const answerValues = ['Yes', 'Probably yes', 'Probably no', 'No', 'No information'] as const;
const judgementValues = ['Low risk', 'Some concerns', 'High risk'] as const;

export type EvidenceSpanRecord = {
  id: string;
  text: string;
  addedBy: 'human' | 'ai' | 'embedding';
  createdAt: string;
};

const EVIDENCE_JOIN = '\n---\n';

const judgementSchema = z.object({
  domainKey: z.string(),
  questionKey: z.string(),
  answer: z.enum(answerValues),
  judgement: z.enum(judgementValues),
  evidenceSpans: z.array(z.string().trim().min(1).max(8_000)).min(1).max(40).optional(),
  evidenceText: z.string().trim().min(1).max(20_000).optional(),
  sourceLocation: z.string().trim().max(200).default('Abstract'),
  rationale: z.string().trim().max(2_000).optional(),
  confidence: z.enum(['High', 'Moderate', 'Low']).optional(),
}).refine((body) => (body.evidenceSpans && body.evidenceSpans.length > 0) || Boolean(body.evidenceText), {
  message: 'At least one evidence span is required',
});

function findRobQuestion(domainKey: string, questionKey: string) {
  const domain = ROB_DOMAINS.find((item) => item.key === domainKey);
  const question = domain?.questions.find((item) => item.key === questionKey);
  if (!domain || !question) throw new AppError(400, 'invalid_rob_question', 'Unknown risk-of-bias domain or question');
  return { domain, question };
}

export function normalizeEvidenceQuote(source: string, quote: string): string {
  const trimmed = quote.trim();
  if (!trimmed) return '';
  const index = source.toLocaleLowerCase().indexOf(trimmed.toLocaleLowerCase());
  return index < 0 ? '' : source.slice(index, index + trimmed.length);
}

/** Validate quotes against source; drop inventions. Deduplicate by lowercase text. */
export function validateEvidenceSpans(
  source: string,
  quotes: string[],
  addedBy: EvidenceSpanRecord['addedBy'] = 'human',
): { accepted: EvidenceSpanRecord[]; rejected: number } {
  const accepted: EvidenceSpanRecord[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  for (const quote of quotes) {
    const text = normalizeEvidenceQuote(source, quote);
    if (!text) {
      rejected += 1;
      continue;
    }
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({
      id: `span_${accepted.length + 1}_${Date.now().toString(36)}`,
      text,
      addedBy,
      createdAt: new Date().toISOString(),
    });
  }
  return { accepted, rejected };
}

export function joinEvidenceText(spans: EvidenceSpanRecord[]): string {
  return spans.map((s) => s.text).join(EVIDENCE_JOIN);
}

export function parseSpansFromJudgement(raw: unknown, fallbackText?: string): EvidenceSpanRecord[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((item, index) => {
        if (typeof item === 'string') {
          const text = item.trim();
          if (!text) return null;
          return {
            id: `span_${index + 1}`,
            text,
            addedBy: 'human' as const,
            createdAt: new Date().toISOString(),
          };
        }
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          const text = String(row.text || '').trim();
          if (!text) return null;
          const addedBy = row.addedBy === 'ai' || row.addedBy === 'embedding' ? row.addedBy : 'human';
          return {
            id: String(row.id || `span_${index + 1}`),
            text,
            addedBy: addedBy as EvidenceSpanRecord['addedBy'],
            createdAt: String(row.createdAt || new Date().toISOString()),
          };
        }
        return null;
      })
      .filter(Boolean) as EvidenceSpanRecord[];
  }
  const text = String(fallbackText || '').trim();
  if (!text) return [];
  return text.split(EVIDENCE_JOIN).map((part, index) => ({
    id: `legacy_${index + 1}`,
    text: part.trim(),
    addedBy: 'human' as const,
    createdAt: new Date().toISOString(),
  })).filter((row) => row.text);
}

function collectInputQuotes(body: { evidenceSpans?: string[]; evidenceText?: string }): string[] {
  if (body.evidenceSpans?.length) return body.evidenceSpans;
  if (body.evidenceText) {
    return body.evidenceText.split(EVIDENCE_JOIN).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function parseRiskOfBiasJson(content: string) {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const answer = String(parsed.answer || '');
  const judgement = String(parsed.judgement || '');
  const confidence = String(parsed.confidence || '');
  if (!answerValues.includes(answer as (typeof answerValues)[number])) throw new Error('Invalid RoB answer');
  if (!judgementValues.includes(judgement as (typeof judgementValues)[number])) throw new Error('Invalid RoB judgement');
  const evidenceQuotes = Array.isArray(parsed.evidenceQuotes)
    ? parsed.evidenceQuotes.map((q) => String(q || '').trim()).filter(Boolean)
    : (parsed.evidenceText ? [String(parsed.evidenceText)] : []);
  return {
    answer: answer as (typeof answerValues)[number],
    judgement: judgement as (typeof judgementValues)[number],
    evidenceQuotes,
    evidenceText: evidenceQuotes.join(EVIDENCE_JOIN),
    sourceLocation: String(parsed.sourceLocation || 'Abstract'),
    rationale: String(parsed.rationale || ''),
    confidence: (['High', 'Moderate', 'Low'].includes(confidence) ? confidence : 'Moderate') as 'High' | 'Moderate' | 'Low',
  };
}

export function parseEvidenceFindJson(content: string): string[] {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const quotes = Array.isArray(parsed.evidenceQuotes)
    ? parsed.evidenceQuotes
    : Array.isArray(parsed.quotes)
      ? parsed.quotes
      : [];
  return quotes.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 12);
}

export function buildRiskOfBiasFindMessages(input: {
  title: string;
  sourceText: string;
  domainTitle: string;
  questionText: string;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You locate verbatim evidence for risk-of-bias signaling questions. Return ONLY valid JSON: {"evidenceQuotes":["..."]}. Each quote MUST be an exact contiguous substring copied from SOURCE. Do not paraphrase, invent, or merge distant sentences. Prefer 1-6 short quotes. If SOURCE has no relevant text, return {"evidenceQuotes":[]}. Prompt version: ${ROB_FIND_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Study: ${input.title}\nDomain: ${input.domainTitle}\nSignaling question: ${input.questionText}\nSOURCE:\n${input.sourceText}`,
    },
  ];
}

export function buildRiskOfBiasMessages(input: {
  title: string;
  sourceText: string;
  domainTitle: string;
  questionText: string;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a systematic-review risk-of-bias assistant. Return ONLY valid JSON with keys: answer (Yes|Probably yes|Probably no|No|No information), judgement (Low risk|Some concerns|High risk), evidenceQuotes (string array of exact SOURCE quotes), sourceLocation, rationale, confidence (High|Moderate|Low). Base the answer ONLY on SOURCE. evidenceQuotes must be exact verbatim substrings. If SOURCE is insufficient, use No information, empty evidenceQuotes, and explain. Prompt version: ${ROB_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Study: ${input.title}\nDomain: ${input.domainTitle}\nSignaling question: ${input.questionText}\nSOURCE (bound evidence and/or ranked passages):\n${input.sourceText}`,
    },
  ];
}

async function saveJudgement(input: {
  projectId: string;
  citationId: string;
  domainKey: string;
  domainTitle: string;
  questionKey: string;
  questionText: string;
  actor: 'human' | 'ai';
  reviewerKey: string;
  answer: string;
  judgement: string;
  evidenceText: string;
  evidenceSpans: EvidenceSpanRecord[];
  sourceLocation?: string;
  rationale?: string;
  confidence?: string;
  userId?: string;
  modelRunId?: string;
}) {
  const existing = await prisma.riskOfBiasJudgement.findUnique({
    where: {
      citationId_domainKey_questionKey_actor_reviewerKey: {
        citationId: input.citationId,
        domainKey: input.domainKey,
        questionKey: input.questionKey,
        actor: input.actor,
        reviewerKey: input.reviewerKey,
      },
    },
  });
  const data = {
    ...input,
    evidenceSpans: input.evidenceSpans as object,
  };
  return existing
    ? prisma.riskOfBiasJudgement.update({ where: { id: existing.id }, data })
    : prisma.riskOfBiasJudgement.create({ data });
}

function serializeJudgement(row: {
  evidenceText: string;
  evidenceSpans?: unknown;
  [key: string]: unknown;
}) {
  const spans = parseSpansFromJudgement(row.evidenceSpans, row.evidenceText);
  return { ...row, evidenceSpans: spans, evidenceText: joinEvidenceText(spans) || row.evidenceText };
}

export async function riskOfBiasRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/risk-of-bias', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const query = request.query as { citationId?: string };
      const citations = await prisma.citation.findMany({
        where: {
          projectId,
          decisions: {
            some: {
              actor: 'final',
              decision: 'Include',
              OR: [
                { rationale: { contains: '[fulltext]' } },
                { rationale: { startsWith: 'Full-text eligibility' } },
              ],
            },
          },
        },
        select: {
          id: true,
          title: true,
          authors: true,
          year: true,
          abstract: true,
          fullTextMarkdown: true,
          journal: true,
          fullTextStatus: true,
          pdfFileId: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      });
      const citationId = citations.some((citation) => citation.id === query.citationId)
        ? query.citationId
        : citations[0]?.id;
      const judgements = citationId
        ? await prisma.riskOfBiasJudgement.findMany({ where: { projectId, citationId }, orderBy: { updatedAt: 'desc' } })
        : [];
      return {
        domains: ROB_DOMAINS,
        citations,
        citationId: citationId || null,
        judgements: judgements.map(serializeJudgement),
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/risk-of-bias/:citationId/human', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = judgementSchema.parse(request.body);
      const { domain, question } = findRobQuestion(body.domainKey, body.questionKey);
      const citation = await prisma.citation.findFirst({ where: { id: citationId, projectId } });
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
      const sourceText = citationAiSource(citation);
      const { accepted, rejected } = validateEvidenceSpans(sourceText, collectInputQuotes(body), 'human');
      if (!accepted.length) {
        throw new AppError(400, 'evidence_not_found', 'Evidence must be exact quote(s) from the source text');
      }
      const evidenceText = joinEvidenceText(accepted);
      const judgement = await saveJudgement({
        projectId,
        citationId,
        domainKey: domain.key,
        domainTitle: domain.title,
        questionKey: question.key,
        questionText: question.text,
        actor: 'human',
        reviewerKey: request.user!.id,
        answer: body.answer,
        judgement: body.judgement,
        evidenceText,
        evidenceSpans: accepted,
        sourceLocation: body.sourceLocation,
        rationale: body.rationale,
        confidence: body.confidence,
        userId: request.user!.id,
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Saved risk-of-bias judgement',
        detail: `${citation.title} · ${question.key} · ${body.judgement} · ${accepted.length} span(s)`,
        module: 'Risk of bias',
        version: 'RoB 2',
      });
      return { judgement: serializeJudgement(judgement), rejectedCount: rejected };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/risk-of-bias/:citationId/evidence-find', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        domainKey: z.string(),
        questionKey: z.string(),
        credentialId: z.string().optional(),
        model: z.string().optional(),
        useLlm: z.boolean().optional(),
      }).parse(request.body ?? {});
      const { domain, question } = findRobQuestion(body.domainKey, body.questionKey);
      const [citation, project] = await Promise.all([
        prisma.citation.findFirst({ where: { id: citationId, projectId } }),
        prisma.project.findUnique({ where: { id: projectId } }),
      ]);
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
      const fullSource = citationAiSource(citation);
      const grounded = await prepareGroundedSource({
        projectId,
        sourceText: fullSource,
        query: `${domain.title}. ${question.text}`,
        topK: 8,
        citationId,
      });

      let llmQuotes: string[] = [];
      let usedLlm = false;
      let modelRunId: string | null = null;
      const wantLlm = body.useLlm !== false;
      const credentialId = body.credentialId || project?.credentialId;

      if (wantLlm && credentialId) {
        usedLlm = true;
        const completion = await callChatCompletions({
          credentialId,
          model: body.model,
          messages: applyLlmResponseLanguage(
            buildRiskOfBiasFindMessages({
              title: citation.title,
              sourceText: grounded.sourceText,
              domainTitle: domain.title,
              questionText: question.text,
            }),
            project?.llmResponseLanguage,
          ),
          responseFormatJson: true,
        });
        try {
          llmQuotes = parseEvidenceFindJson(completion.content);
        } catch {
          llmQuotes = [];
        }
        const modelRun = await prisma.modelRun.create({
          data: {
            projectId,
            citationId,
            userId: request.user!.id,
            credentialId,
            provider: completion.provider,
            model: completion.model,
            promptVersion: ROB_FIND_PROMPT_VERSION,
            status: 'succeeded',
            latencyMs: completion.latencyMs,
            inputTokens: completion.inputTokens,
            outputTokens: completion.outputTokens,
            requestMeta: {
              domainKey: domain.key,
              questionKey: question.key,
              usedEmbeddings: grounded.usedEmbeddings,
              cacheHit: grounded.cacheHit,
              mode: 'evidence-find',
            },
            responseMeta: { quoteCount: llmQuotes.length },
          },
        });
        modelRunId = modelRun.id;
      }

      const embeddingQuotes = grounded.ranked.map((row) => row.text);
      const { accepted, rejected } = validateEvidenceSpans(
        fullSource,
        [...llmQuotes, ...embeddingQuotes],
        llmQuotes.length ? 'ai' : 'embedding',
      );

      return {
        evidenceSpans: accepted,
        rankedEvidence: grounded.ranked,
        usedEmbeddings: grounded.usedEmbeddings,
        cacheHit: grounded.cacheHit,
        usedLlm,
        rejectedCount: rejected,
        modelRunId,
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/risk-of-bias/:citationId/ai', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        domainKey: z.string(),
        questionKey: z.string(),
        credentialId: z.string().optional(),
        model: z.string().optional(),
        evidenceSpans: z.array(z.string().trim().min(1).max(8_000)).max(40).optional(),
      }).parse(request.body);
      const { domain, question } = findRobQuestion(body.domainKey, body.questionKey);
      const [citation, project] = await Promise.all([
        prisma.citation.findFirst({ where: { id: citationId, projectId } }),
        prisma.project.findUnique({ where: { id: projectId } }),
      ]);
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
      const credentialId = body.credentialId || project?.credentialId;
      if (!credentialId) throw new AppError(400, 'missing_credential', 'Configure a model credential first');
      const fullSource = citationAiSource(citation);

      let bound = validateEvidenceSpans(fullSource, body.evidenceSpans || [], 'human').accepted;
      let grounded = await prepareGroundedSource({
        projectId,
        sourceText: fullSource,
        query: `${domain.title}. ${question.text}`,
        topK: 6,
        citationId,
      });

      if (!bound.length) {
        const auto = validateEvidenceSpans(
          fullSource,
          grounded.ranked.map((r) => r.text),
          'embedding',
        ).accepted;
        bound = auto.slice(0, 6);
      }

      const sourceForLlm = bound.length
        ? bound.map((s, i) => `[Bound ${i + 1}]\n${s.text}`).join('\n\n')
        : grounded.sourceText;

      const completion = await callChatCompletions({
        credentialId,
        model: body.model,
        messages: applyLlmResponseLanguage(
          buildRiskOfBiasMessages({
            title: citation.title,
            sourceText: sourceForLlm,
            domainTitle: domain.title,
            questionText: question.text,
          }),
          project?.llmResponseLanguage,
        ),
        responseFormatJson: true,
      });
      let parsed;
      try {
        parsed = parseRiskOfBiasJson(completion.content);
      } catch {
        throw new AppError(502, 'llm_parse_error', 'Model returned invalid risk-of-bias JSON');
      }

      const fromModel = validateEvidenceSpans(fullSource, parsed.evidenceQuotes, 'ai').accepted;
      const merged = validateEvidenceSpans(
        fullSource,
        [...bound.map((s) => s.text), ...fromModel.map((s) => s.text)],
        bound.length ? 'human' : 'ai',
      ).accepted;
      if (!merged.length && grounded.ranked[0]) {
        merged.push(...validateEvidenceSpans(fullSource, [grounded.ranked[0].text], 'embedding').accepted);
      }
      if (!merged.length) {
        throw new AppError(502, 'llm_evidence_error', 'No verifiable evidence quotes found in the source text');
      }

      const evidenceText = joinEvidenceText(merged);
      const modelRun = await prisma.modelRun.create({
        data: {
          projectId,
          citationId,
          userId: request.user!.id,
          credentialId,
          provider: completion.provider,
          model: completion.model,
          promptVersion: ROB_PROMPT_VERSION,
          status: 'succeeded',
          latencyMs: completion.latencyMs,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          requestMeta: {
            domainKey: domain.key,
            questionKey: question.key,
            usedEmbeddings: grounded.usedEmbeddings,
            cacheHit: grounded.cacheHit,
            rankedCount: grounded.ranked.length,
            boundSpanCount: bound.length,
          },
          responseMeta: parsed,
        },
      });
      const judgement = await saveJudgement({
        projectId,
        citationId,
        domainKey: domain.key,
        domainTitle: domain.title,
        questionKey: question.key,
        questionText: question.text,
        actor: 'ai',
        reviewerKey: 'ai',
        answer: parsed.answer,
        judgement: parsed.judgement,
        evidenceText,
        evidenceSpans: merged.map((s) => ({ ...s, addedBy: s.addedBy === 'human' ? 'human' : 'ai' })),
        sourceLocation: grounded.usedEmbeddings ? 'Embedding-ranked source' : parsed.sourceLocation,
        rationale: parsed.rationale,
        confidence: parsed.confidence,
        userId: request.user!.id,
        modelRunId: modelRun.id,
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: 'Qiuzheng AI',
        action: 'Suggested risk-of-bias judgement',
        detail: `${citation.title} · ${question.key} · ${parsed.judgement}`,
        module: 'Risk of bias',
        version: ROB_PROMPT_VERSION,
      });
      return {
        judgement: serializeJudgement(judgement),
        modelRun,
        rankedEvidence: grounded.ranked,
        usedEmbeddings: grounded.usedEmbeddings,
        cacheHit: grounded.cacheHit,
        evidenceSpans: merged,
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/citations/:citationId/evidence-rank', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      await requireProjectMember(projectId, request.user!.id);
      const body = z
        .object({
          query: z.string().trim().min(1).max(4_000),
          topK: z.number().int().min(1).max(20).optional(),
        })
        .parse(request.body);
      const citation = await prisma.citation.findFirst({ where: { id: citationId, projectId } });
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
      const sourceText = citationAiSource(citation);
      const grounded = await prepareGroundedSource({
        projectId,
        sourceText,
        query: body.query,
        topK: body.topK ?? 8,
        citationId,
      });
      if (!grounded.usedEmbeddings && !grounded.ranked.length) {
        const config = await prisma.project.findUnique({
          where: { id: projectId },
          select: { embeddingCredentialId: true, credentialId: true, embeddingModel: true },
        });
        if (!config?.embeddingCredentialId && !config?.credentialId) {
          throw new AppError(400, 'missing_embedding_credential', 'Configure an embedding model in project settings first');
        }
      }
      return {
        rankedEvidence: grounded.ranked,
        usedEmbeddings: grounded.usedEmbeddings,
        cacheHit: grounded.cacheHit,
        sourcePreview: sourceText.slice(0, 500),
      };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });
}
