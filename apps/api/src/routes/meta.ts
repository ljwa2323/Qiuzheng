import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';
import { runMetaInSandbox } from '../services/meta-sandbox.js';
import { META_RECIPES, type MetaMeasure, type MetaModel } from '../services/meta-stats.js';
import {
  META_TOOL_KINDS,
  assessComputability,
  listMetaTools,
  runMetaTool,
  type MetaToolKind,
} from '../services/meta-tools.js';

const measureEnum = z.enum(['OR', 'RR', 'MD', 'SMD']);
const modelEnum = z.enum(['fixed', 'random']);
const recipeEnum = z.enum(META_RECIPES);

const effectRowSchema = z.object({
  citationId: z.string().min(1),
  label: z.string().optional(),
  eventsT: z.number().nullable().optional(),
  nT: z.number().nullable().optional(),
  eventsC: z.number().nullable().optional(),
  nC: z.number().nullable().optional(),
  meanT: z.number().nullable().optional(),
  sdT: z.number().nullable().optional(),
  meanC: z.number().nullable().optional(),
  sdC: z.number().nullable().optional(),
  yi: z.number().nullable().optional(),
  sei: z.number().nullable().optional(),
  ciLow: z.number().nullable().optional(),
  ciHigh: z.number().nullable().optional(),
  subgroup: z.string().optional(),
  armT: z.string().optional(),
  armC: z.string().optional(),
  source: z.string().optional(),
});

export async function metaRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/meta/analyses', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const analyses = await prisma.outcomeAnalysis.findMany({
        where: { projectId },
        include: {
          _count: { select: { rows: true, runs: true } },
          runs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return { analyses };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/meta/analyses', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          name: z.string().min(1).max(200),
          measure: measureEnum.default('OR'),
          modelPref: modelEnum.default('random'),
          notes: z.string().optional(),
        })
        .parse(request.body);
      const analysis = await prisma.outcomeAnalysis.create({
        data: {
          projectId,
          name: body.name,
          measure: body.measure,
          modelPref: body.modelPref,
          notes: body.notes || '',
        },
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Created meta outcome analysis',
        detail: `${analysis.name} (${analysis.measure})`,
        module: 'Meta',
      });
      return { analysis };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.delete('/api/projects/:projectId/meta/analyses/:analysisId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const current = await prisma.outcomeAnalysis.findFirst({
        where: { id: analysisId, projectId },
        include: { _count: { select: { rows: true, runs: true } } },
      });
      if (!current) throw new AppError(404, 'not_found', 'Outcome analysis not found');
      // Cascades EffectRow + MetaRun via Prisma relations.
      await prisma.outcomeAnalysis.delete({ where: { id: analysisId } });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Deleted meta outcome analysis',
        detail: `${current.name} (${current.measure}) · rows ${current._count.rows} · runs ${current._count.runs}`,
        module: 'Meta',
      });
      return { ok: true };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/meta/analyses/:analysisId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      await requireProjectMember(projectId, request.user!.id);
      const analysis = await prisma.outcomeAnalysis.findFirst({
        where: { id: analysisId, projectId },
        include: {
          rows: {
            include: { citation: { select: { id: true, title: true, year: true, authors: true } } },
            orderBy: { createdAt: 'asc' },
          },
          runs: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
      if (!analysis) throw new AppError(404, 'not_found', 'Outcome analysis not found');
      return { analysis };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put('/api/projects/:projectId/meta/analyses/:analysisId/rows', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({ rows: z.array(effectRowSchema).max(500) }).parse(request.body);
      const analysis = await prisma.outcomeAnalysis.findFirst({ where: { id: analysisId, projectId } });
      if (!analysis) throw new AppError(404, 'not_found', 'Outcome analysis not found');

      const citationIds = [...new Set(body.rows.map((r) => r.citationId))];
      const citations = await prisma.citation.findMany({
        where: { projectId, id: { in: citationIds } },
        select: { id: true, title: true },
      });
      const titleById = new Map(citations.map((c) => [c.id, c.title]));
      for (const id of citationIds) {
        if (!titleById.has(id)) throw new AppError(400, 'validation', `Unknown citationId: ${id}`);
      }

      await prisma.$transaction(async (tx) => {
        await tx.effectRow.deleteMany({ where: { outcomeAnalysisId: analysisId } });
        if (body.rows.length) {
          await tx.effectRow.createMany({
            data: body.rows.map((row) => ({
              projectId,
              outcomeAnalysisId: analysisId,
              citationId: row.citationId,
              label: row.label || titleById.get(row.citationId) || '',
              eventsT: row.eventsT ?? null,
              nT: row.nT ?? null,
              eventsC: row.eventsC ?? null,
              nC: row.nC ?? null,
              meanT: row.meanT ?? null,
              sdT: row.sdT ?? null,
              meanC: row.meanC ?? null,
              sdC: row.sdC ?? null,
              yi: row.yi ?? null,
              sei: row.sei ?? null,
              ciLow: row.ciLow ?? null,
              ciHigh: row.ciHigh ?? null,
              subgroup: row.subgroup || '',
              armT: row.armT?.trim() || 'Treatment',
              armC: row.armC?.trim() || 'Control',
              source: row.source || 'manual',
            })),
          });
        }
      });

      const rows = await prisma.effectRow.findMany({
        where: { outcomeAnalysisId: analysisId },
        include: { citation: { select: { id: true, title: true, year: true } } },
        orderBy: { createdAt: 'asc' },
      });
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Updated meta effect rows',
        detail: `${analysis.name}: ${rows.length} rows`,
        module: 'Meta',
      });
      return { rows };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/meta/analyses/:analysisId/map-extraction', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          mapping: z.record(z.string(), z.string()).default({}),
          replace: z.boolean().default(true),
        })
        .parse(request.body ?? {});

      const analysis = await prisma.outcomeAnalysis.findFirst({ where: { id: analysisId, projectId } });
      if (!analysis) throw new AppError(404, 'not_found', 'Outcome analysis not found');

      const fields = await prisma.extractionField.findMany({ where: { projectId, active: true } });
      const fieldByKey = new Map(fields.map((f) => [f.key, f]));
      const values = await prisma.extractionValue.findMany({ where: { projectId } });
      const byCitation = new Map<string, Map<string, string>>();
      for (const v of values) {
        const field = fields.find((f) => f.id === v.fieldId);
        if (!field || !v.value) continue;
        if (!byCitation.has(v.citationId)) byCitation.set(v.citationId, new Map());
        byCitation.get(v.citationId)!.set(field.key, v.value);
      }

      const citations = await prisma.citation.findMany({
        where: { projectId },
        select: { id: true, title: true },
      });

      const defaultMap: Record<string, string> = {
        eventsT: 'events_t',
        nT: 'n_t',
        eventsC: 'events_c',
        nC: 'n_c',
        meanT: 'mean_t',
        sdT: 'sd_t',
        meanC: 'mean_c',
        sdC: 'sd_c',
        subgroup: 'subgroup',
        armT: 'arm_t',
        armC: 'arm_c',
      };
      const mapping = { ...defaultMap, ...body.mapping };

      const num = (raw?: string) => {
        if (raw == null || raw === '') return null;
        const n = Number(String(raw).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : null;
      };

      const rows = citations
        .map((c) => {
          const vals = byCitation.get(c.id);
          if (!vals) return null;
          const row = {
            citationId: c.id,
            label: c.title,
            eventsT: num(vals.get(mapping.eventsT || '')),
            nT: num(vals.get(mapping.nT || '')),
            eventsC: num(vals.get(mapping.eventsC || '')),
            nC: num(vals.get(mapping.nC || '')),
            meanT: num(vals.get(mapping.meanT || '')),
            sdT: num(vals.get(mapping.sdT || '')),
            meanC: num(vals.get(mapping.meanC || '')),
            sdC: num(vals.get(mapping.sdC || '')),
            subgroup: vals.get(mapping.subgroup || '') || '',
            armT: vals.get(mapping.armT || '') || 'Treatment',
            armC: vals.get(mapping.armC || '') || 'Control',
            source: 'mapped_from_extraction',
          };
          const hasBinary = row.eventsT != null && row.nT != null && row.eventsC != null && row.nC != null;
          const hasCont = row.meanT != null && row.sdT != null && row.nT != null && row.meanC != null && row.sdC != null && row.nC != null;
          if (!hasBinary && !hasCont) return null;
          return row;
        })
        .filter(Boolean) as z.infer<typeof effectRowSchema>[];

      if (body.replace) {
        await prisma.$transaction(async (tx) => {
          await tx.effectRow.deleteMany({ where: { outcomeAnalysisId: analysisId } });
          if (rows.length) {
            await tx.effectRow.createMany({
              data: rows.map((row) => ({
                projectId,
                outcomeAnalysisId: analysisId,
                citationId: row.citationId,
                label: row.label || '',
                eventsT: row.eventsT ?? null,
                nT: row.nT ?? null,
                eventsC: row.eventsC ?? null,
                nC: row.nC ?? null,
                meanT: row.meanT ?? null,
                sdT: row.sdT ?? null,
                meanC: row.meanC ?? null,
                sdC: row.sdC ?? null,
                subgroup: row.subgroup || '',
                armT: row.armT?.trim() || 'Treatment',
                armC: row.armC?.trim() || 'Control',
                source: 'mapped_from_extraction',
              })),
            });
          }
          await tx.outcomeAnalysis.update({
            where: { id: analysisId },
            data: { mappingJson: { mapping, fieldKeys: [...fieldByKey.keys()] } },
          });
        });
      }

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Mapped extraction to meta effect rows',
        detail: `${analysis.name}: ${rows.length} rows`,
        module: 'Meta',
      });
      return { mapped: rows.length, rows };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.get('/api/projects/:projectId/meta/tools', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      return { schema: 'qiuzheng.meta.tools.v1', tools: listMetaTools() };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/meta/tools/:toolName', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, toolName } = request.params as { projectId: string; toolName: string };
      await requireProjectMember(projectId, request.user!.id);
      if (!(META_TOOL_KINDS as readonly string[]).includes(toolName)) {
        throw new AppError(400, 'validation', `Unknown meta tool: ${toolName}`);
      }
      const body = z.record(z.string(), z.unknown()).parse(request.body ?? {});
      const result = runMetaTool(toolName as MetaToolKind, body);
      return { tool: toolName, result };
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/meta/analyses/:analysisId/validate', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      await requireProjectMember(projectId, request.user!.id);
      const analysis = await prisma.outcomeAnalysis.findFirst({
        where: { id: analysisId, projectId },
        include: { rows: true },
      });
      if (!analysis) throw new AppError(404, 'not_found', 'Outcome analysis not found');
      const report = assessComputability(analysis.rows, analysis.measure as MetaMeasure);
      return { analysisId, name: analysis.name, measure: analysis.measure, report };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/meta/analyses/:analysisId/run', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, analysisId } = request.params as { projectId: string; analysisId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z
        .object({
          model: modelEnum.optional(),
          recipe: recipeEnum.default('fixed_random'),
          skipComputabilityGate: z.boolean().optional(),
        })
        .parse(request.body ?? {});

      const analysis = await prisma.outcomeAnalysis.findFirst({
        where: { id: analysisId, projectId },
        include: { rows: true },
      });
      if (!analysis) throw new AppError(404, 'not_found', 'Outcome analysis not found');
      if (!analysis.rows.length) throw new AppError(400, 'validation', 'Add effect rows before running meta');

      const model = (body.model || analysis.modelPref || 'random') as MetaModel;
      const measure = analysis.measure as MetaMeasure;
      const computability = assessComputability(analysis.rows, measure);
      if (!body.skipComputabilityGate && !computability.canRun) {
        return reply.code(400).send({
          error: {
            code: 'not_computable',
            message: `No computable effect rows for ${measure}. Fix inputs or use conversion tools.`,
          },
          computability,
        });
      }

      const runId = `run_${Date.now().toString(36)}`;
      const computableIds = new Set(
        computability.assessments.filter((a) => a.ok).map((a) => a.citationId).filter(Boolean),
      );
      const rowsForRun = body.skipComputabilityGate
        ? analysis.rows
        : analysis.rows.filter((r) => computableIds.has(r.citationId));

      try {
        const sandboxed = await runMetaInSandbox({
          projectId,
          analysisId,
          runId,
          measure,
          model,
          recipe: body.recipe,
          title: analysis.name,
          rows: rowsForRun.map((r) => ({
            id: r.citationId,
            label: r.label || r.citationId,
            eventsT: r.eventsT,
            nT: r.nT,
            eventsC: r.eventsC,
            nC: r.nC,
            meanT: r.meanT,
            sdT: r.sdT,
            meanC: r.meanC,
            sdC: r.sdC,
            yi: r.yi,
            sei: r.sei,
            subgroup: r.subgroup,
            armT: r.armT,
            armC: r.armC,
          })),
        });

        const run = await prisma.metaRun.create({
          data: {
            projectId,
            outcomeAnalysisId: analysisId,
            status: 'completed',
            recipe: body.recipe,
            model,
            measure,
            resultJson: {
              ...(sandboxed.result as object),
              computability: {
                total: computability.total,
                used: rowsForRun.length,
                skipped: computability.notComputable,
              },
            },
            forestSvg: sandboxed.forestSvg,
            workspacePath: sandboxed.workspace,
            createdBy: request.user!.id,
          },
        });

        await writeAudit({
          projectId,
          userId: request.user!.id,
          actorName: request.user!.name,
          action: 'Ran meta-analysis recipe',
          detail: `${analysis.name} · ${body.recipe} · ${model} · k=${(sandboxed.result.summary as { k?: number }).k ?? '?'} · skipped=${computability.notComputable}`,
          module: 'Meta',
        });
        return { run, computability };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const run = await prisma.metaRun.create({
          data: {
            projectId,
            outcomeAnalysisId: analysisId,
            status: 'failed',
            recipe: body.recipe,
            model,
            measure,
            resultJson: { error: message, computability },
            forestSvg: '',
            workspacePath: '',
            errorMessage: message,
            createdBy: request.user!.id,
          },
        });
        return reply.code(400).send({ error: { code: 'meta_failed', message }, run, computability });
      }
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.get('/api/projects/:projectId/meta/runs/:runId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, runId } = request.params as { projectId: string; runId: string };
      await requireProjectMember(projectId, request.user!.id);
      const run = await prisma.metaRun.findFirst({ where: { id: runId, projectId } });
      if (!run) throw new AppError(404, 'not_found', 'Meta run not found');
      return { run };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
