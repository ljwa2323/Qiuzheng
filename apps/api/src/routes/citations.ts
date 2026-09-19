import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, sendError } from '../lib/errors.js';
import { assertCanWrite, requireProjectMember, writeAudit } from '../services/rbac.js';
import { rollbackCitation } from '../services/citation-lifecycle.js';
import { sha256 } from '../lib/crypto.js';
import { getObjectBuffer, putObject, deleteObject } from '../lib/s3.js';
import { loadEnv } from '../config/env.js';
import { createQueue, defaultJobOptions, QUEUE_IMPORT } from '../lib/queue.js';
import { pdfBufferToMarkdown } from '../services/pdf-to-markdown.js';

function importQueue() {
  return createQueue(QUEUE_IMPORT);
}

function isMarkdownUpload(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.txt') ||
    mimeType.includes('markdown')
  );
}

function isPdfUpload(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.pdf') || mimeType === 'application/pdf';
}

function resolveFullTextStatus(hasPdf: boolean, hasMd: boolean): string {
  if (hasMd) return 'Full text';
  if (hasPdf) return 'PDF';
  return 'Missing';
}

async function storeDerivedMarkdown(input: {
  projectId: string;
  citationId: string;
  title: string;
  markdown: string;
  sourceFilename: string;
}) {
  const mdFilename = input.sourceFilename.replace(/\.pdf$/i, '') + '.auto.md';
  const mdBuffer = Buffer.from(input.markdown, 'utf8');
  const objectKey = `projects/${input.projectId}/citations/${input.citationId}/md/${Date.now()}-${mdFilename}`;
  await putObject(objectKey, mdBuffer, 'text/markdown; charset=utf-8');
  return prisma.storedFile.create({
    data: {
      projectId: input.projectId,
      bucket: loadEnv().S3_BUCKET,
      objectKey,
      filename: mdFilename,
      mimeType: 'text/markdown',
      sizeBytes: mdBuffer.byteLength,
      sha256: sha256(mdBuffer),
    },
  });
}

async function loadCitationImpacts(projectId: string, citationIds: string[]) {
  const uniqueIds = [...new Set(citationIds.map(String).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const citations = await prisma.citation.findMany({
    where: { projectId, id: { in: uniqueIds } },
    select: {
      id: true,
      title: true,
      pdfFileId: true,
      mdFileId: true,
      fullTextMarkdown: true,
      _count: {
        select: {
          decisions: true,
          extractionValues: true,
          riskOfBiasJudgements: true,
          effectRows: true,
        },
      },
    },
  });
  return citations.map((citation) => {
    const hasFulltext = Boolean(
      citation.pdfFileId || citation.mdFileId || String(citation.fullTextMarkdown || '').trim(),
    );
    const screeningDecisions = citation._count.decisions;
    const extractionValues = citation._count.extractionValues;
    const robJudgements = citation._count.riskOfBiasJudgements;
    const effectRows = citation._count.effectRows;
    const hasDownstream =
      screeningDecisions > 0
      || extractionValues > 0
      || robJudgements > 0
      || effectRows > 0
      || hasFulltext;
    return {
      id: citation.id,
      title: citation.title,
      screeningDecisions,
      extractionValues,
      robJudgements,
      effectRows,
      hasFulltext,
      hasDownstream,
    };
  });
}

async function deleteCitationRecords(projectId: string, citationIds: string[]) {
  const citations = await prisma.citation.findMany({
    where: { projectId, id: { in: citationIds } },
    include: { pdfFile: true, mdFile: true },
  });
  if (!citations.length) return { deleted: 0, filesRemoved: 0 };

  const fileIds = new Set<string>();
  const objectKeys: string[] = [];
  for (const citation of citations) {
    if (citation.pdfFile) {
      fileIds.add(citation.pdfFile.id);
      objectKeys.push(citation.pdfFile.objectKey);
    }
    if (citation.mdFile && !fileIds.has(citation.mdFile.id)) {
      fileIds.add(citation.mdFile.id);
      objectKeys.push(citation.mdFile.objectKey);
    }
  }

  await prisma.citation.deleteMany({
    where: { projectId, id: { in: citations.map((c) => c.id) } },
  });

  for (const key of objectKeys) {
    try {
      await deleteObject(key);
    } catch {
      /* best-effort */
    }
  }
  if (fileIds.size) {
    await prisma.storedFile.deleteMany({ where: { id: { in: [...fileIds] } } }).catch(() => undefined);
  }

  return { deleted: citations.length, filesRemoved: objectKeys.length };
}

export async function citationRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/citations', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const query = request.query as { q?: string; skip?: string; take?: string };
      const take = Math.min(Number(query.take || 50), 5000);
      const skip = Number(query.skip || 0);
      const where = {
        projectId,
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' as const } },
                { authors: { contains: query.q, mode: 'insensitive' as const } },
                { doi: { contains: query.q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };
      const [citations, total] = await Promise.all([
        prisma.citation.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: {
            decisions: { orderBy: { createdAt: 'desc' }, take: 6 },
            sources: true,
          },
        }),
        prisma.citation.count({ where }),
      ]);
      return { citations, total, skip, take };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/citations/:citationId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      await requireProjectMember(projectId, request.user!.id);
      const citation = await prisma.citation.findFirst({
        where: { id: citationId, projectId },
        include: {
          decisions: { orderBy: { createdAt: 'desc' } },
          sources: true,
          pdfFile: true,
          mdFile: true,
        },
      });
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');
      return { citation };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/citations/:citationId/rollback', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        to: z.enum(['title_abstract', 'fulltext_pending']),
      }).parse(request.body ?? {});
      const result = await rollbackCitation({
        projectId,
        citationId,
        to: body.to,
        userId: request.user!.id,
        actorName: request.user!.name,
      });
      return result;
    } catch (err) {
      return sendError(reply, err instanceof z.ZodError ? new AppError(400, 'validation', err.message) : err);
    }
  });

  app.post('/api/projects/:projectId/citations/delete-preview', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id, 'reviewer');
      const body = z.object({
        citationIds: z.array(z.string().min(1)).min(1).max(10000),
      }).parse(request.body ?? {});
      const impacts = await loadCitationImpacts(projectId, body.citationIds);
      const foundIds = new Set(impacts.map((row) => row.id));
      const missingIds = body.citationIds.filter((id) => !foundIds.has(id));
      return {
        items: impacts,
        missingIds,
        total: impacts.length,
        safeCount: impacts.filter((row) => !row.hasDownstream).length,
        riskyCount: impacts.filter((row) => row.hasDownstream).length,
      };
    } catch (err) {
      return sendError(
        reply,
        err instanceof z.ZodError
          ? new AppError(400, 'validation', '最多一次选择 10000 条文献')
          : err,
      );
    }
  });

  app.post('/api/projects/:projectId/citations/delete', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const body = z.object({
        citationIds: z.array(z.string().min(1)).min(1).max(10000),
        confirmDownstream: z.boolean().optional(),
      }).parse(request.body ?? {});

      const impacts = await loadCitationImpacts(projectId, body.citationIds);
      if (!impacts.length) throw new AppError(404, 'not_found', 'No matching citations to delete');

      const risky = impacts.filter((row) => row.hasDownstream);
      if (risky.length && !body.confirmDownstream) {
        throw new AppError(
          409,
          'needs_confirmation',
          `${risky.length} citation(s) have screening, full text, extraction, or risk-of-bias data. Confirm to delete.`,
          {
            items: impacts,
            safeCount: impacts.length - risky.length,
            riskyCount: risky.length,
          },
        );
      }

      const result = await deleteCitationRecords(projectId, impacts.map((row) => row.id));
      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Deleted citations',
        detail: `Removed ${result.deleted} citation(s)`
          + (risky.length ? ` · ${risky.length} had downstream data` : ' · import-only/safe')
          + (result.filesRemoved ? ` · ${result.filesRemoved} file(s) cleaned` : ''),
        module: 'Library',
      });

      return {
        deleted: result.deleted,
        filesRemoved: result.filesRemoved,
        riskyCount: risky.length,
        safeCount: impacts.length - risky.length,
        items: impacts,
      };
    } catch (err) {
      return sendError(
        reply,
        err instanceof z.ZodError
          ? new AppError(400, 'validation', '最多一次选择 10000 条文献')
          : err,
      );
    }
  });

  app.post('/api/projects/:projectId/citations/:citationId/fulltext', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);

      const citation = await prisma.citation.findFirst({ where: { id: citationId, projectId } });
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

      const file = await request.file();
      if (!file) throw new AppError(400, 'validation', 'File required');
      const buffer = await file.toBuffer();
      if (buffer.byteLength > loadEnv().MAX_UPLOAD_BYTES) {
        throw new AppError(413, 'payload_too_large', 'File exceeds upload limit');
      }

      const mimeType = file.mimetype || 'application/octet-stream';
      const filename = file.filename || 'fulltext';
      const asPdf = isPdfUpload(filename, mimeType);
      const asMd = isMarkdownUpload(filename, mimeType);
      if (!asPdf && !asMd) {
        throw new AppError(400, 'validation', 'Upload a PDF or Markdown (.md) full-text file');
      }

      const hash = sha256(buffer);
      const kind = asPdf ? 'pdf' : 'md';
      const objectKey = `projects/${projectId}/citations/${citationId}/${kind}/${Date.now()}-${filename}`;
      await putObject(objectKey, buffer, mimeType);

      const stored = await prisma.storedFile.create({
        data: {
          projectId,
          bucket: loadEnv().S3_BUCKET,
          objectKey,
          filename,
          mimeType,
          sizeBytes: buffer.byteLength,
          sha256: hash,
        },
      });

      const data: {
        pdfFileId?: string;
        mdFileId?: string;
        fullTextMarkdown?: string;
        fullTextStatus: string;
        completeness?: number;
      } = {
        fullTextStatus: citation.fullTextStatus,
      };

      let conversionNote = '';

      if (asPdf) {
        data.pdfFileId = stored.id;
        data.fullTextStatus = resolveFullTextStatus(true, Boolean(citation.mdFileId || citation.fullTextMarkdown?.trim()));
        data.completeness = Math.max(citation.completeness, 85);
        try {
          const converted = await pdfBufferToMarkdown(buffer, { title: citation.title });
          if (converted.markdown.trim()) {
            const mdStored = await storeDerivedMarkdown({
              projectId,
              citationId,
              title: citation.title,
              markdown: converted.markdown,
              sourceFilename: filename,
            });
            data.mdFileId = mdStored.id;
            data.fullTextMarkdown = converted.markdown;
            data.fullTextStatus = 'Full text';
            data.completeness = Math.max(citation.completeness, 95);
            conversionNote = `auto-converted via ${converted.engine}: ${converted.pageCount} page(s), ${converted.charCount} chars`;
          } else {
            data.fullTextStatus = 'PDF';
            conversionNote = 'PDF stored; no extractable text (likely scanned). Upload Markdown manually or use OCR later.';
          }
        } catch (err) {
          data.fullTextStatus = 'PDF';
          conversionNote = `PDF stored; Markdown conversion failed: ${(err as Error).message}`;
        }
      }
      if (asMd) {
        const markdown = buffer.toString('utf8');
        data.mdFileId = stored.id;
        data.fullTextMarkdown = markdown;
        data.fullTextStatus = resolveFullTextStatus(Boolean(citation.pdfFileId) || asPdf, true);
        data.completeness = Math.max(citation.completeness, 95);
      }

      const updated = await prisma.citation.update({
        where: { id: citationId },
        data,
        include: { pdfFile: true, mdFile: true, sources: true },
      });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Uploaded citation full text',
        detail: `${filename} (${kind}) for ${citation.title}${conversionNote ? ` · ${conversionNote}` : ''}`,
        module: 'Library',
      });

      return {
        citation: updated,
        conversion: asPdf
          ? {
              attempted: true,
              ok: Boolean(updated.fullTextMarkdown?.trim()),
              note: conversionNote,
            }
          : { attempted: false, ok: true, note: 'Markdown uploaded directly' },
      };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/citations/:citationId/fulltext/pdf', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      await requireProjectMember(projectId, request.user!.id);
      const citation = await prisma.citation.findFirst({
        where: { id: citationId, projectId },
        include: { pdfFile: true },
      });
      if (!citation?.pdfFile) throw new AppError(404, 'not_found', 'PDF full text not found');
      const buffer = await getObjectBuffer(citation.pdfFile.objectKey);
      reply.header('Content-Type', citation.pdfFile.mimeType || 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${citation.pdfFile.filename.replace(/"/g, '')}"`);
      return reply.send(buffer);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete('/api/projects/:projectId/citations/:citationId/fulltext', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId, citationId } = request.params as { projectId: string; citationId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);
      const scope = String((request.query as { scope?: string })?.scope || 'all').toLowerCase();
      if (!['all', 'pdf', 'md'].includes(scope)) {
        throw new AppError(400, 'validation', 'scope must be all, pdf, or md');
      }

      const citation = await prisma.citation.findFirst({
        where: { id: citationId, projectId },
        include: { pdfFile: true, mdFile: true },
      });
      if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

      const removePdf = scope === 'all' || scope === 'pdf';
      const removeMd = scope === 'all' || scope === 'md';
      if (!removePdf && !removeMd) {
        throw new AppError(400, 'validation', 'Nothing to delete');
      }
      if (removePdf && !citation.pdfFileId && removeMd && !citation.mdFileId && !citation.fullTextMarkdown?.trim()) {
        throw new AppError(404, 'not_found', 'No full text to delete');
      }

      const filesToDelete: Array<{ id: string; objectKey: string }> = [];
      if (removePdf && citation.pdfFile) filesToDelete.push({ id: citation.pdfFile.id, objectKey: citation.pdfFile.objectKey });
      if (removeMd && citation.mdFile) {
        // Avoid double-delete when pdf and md point to same file (unlikely but safe).
        if (!filesToDelete.some((f) => f.id === citation.mdFile!.id)) {
          filesToDelete.push({ id: citation.mdFile.id, objectKey: citation.mdFile.objectKey });
        }
      }

      const data: {
        pdfFileId?: string | null;
        mdFileId?: string | null;
        fullTextMarkdown?: string;
        fullTextStatus: string;
      } = {
        fullTextStatus: citation.fullTextStatus,
      };

      if (removePdf) data.pdfFileId = null;
      if (removeMd) {
        data.mdFileId = null;
        data.fullTextMarkdown = '';
      }
      const stillHasPdf = removePdf ? false : Boolean(citation.pdfFileId);
      const stillHasMd = removeMd ? false : Boolean(citation.mdFileId || citation.fullTextMarkdown?.trim());
      data.fullTextStatus = resolveFullTextStatus(stillHasPdf, stillHasMd);

      const updated = await prisma.citation.update({
        where: { id: citationId },
        data,
        include: { pdfFile: true, mdFile: true, sources: true },
      });

      for (const file of filesToDelete) {
        try {
          await deleteObject(file.objectKey);
        } catch {
          /* best-effort object cleanup */
        }
        try {
          await prisma.storedFile.delete({ where: { id: file.id } });
        } catch {
          /* may already be unlinked */
        }
      }

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Deleted citation full text',
        detail: `Removed ${scope} full text for ${citation.title}`,
        module: 'Library',
      });

      return { citation: updated, scope };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post('/api/projects/:projectId/imports', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const membership = await requireProjectMember(projectId, request.user!.id, 'reviewer');
      assertCanWrite(membership.role);

      const file = await request.file();
      if (!file) throw new AppError(400, 'validation', 'File required');
      const buffer = await file.toBuffer();
      if (buffer.byteLength > loadEnv().MAX_UPLOAD_BYTES) {
        throw new AppError(413, 'payload_too_large', 'File exceeds upload limit');
      }

      const fields = file.fields as Record<string, { value?: string } | Array<{ value?: string }> | undefined>;
      const readField = (name: string, fallback: string) => {
        const raw = fields?.[name];
        const part = Array.isArray(raw) ? raw[0] : raw;
        return String(part?.value || fallback);
      };
      const format = readField('format', 'RIS');
      const sourceLabel = readField('sourceLabel', format);

      const hash = sha256(buffer);
      const objectKey = `projects/${projectId}/imports/${Date.now()}-${file.filename}`;
      await putObject(objectKey, buffer, file.mimetype || 'application/octet-stream');

      const stored = await prisma.storedFile.create({
        data: {
          projectId,
          bucket: loadEnv().S3_BUCKET,
          objectKey,
          filename: file.filename,
          mimeType: file.mimetype || 'application/octet-stream',
          sizeBytes: buffer.byteLength,
          sha256: hash,
        },
      });

      const batch = await prisma.importBatch.create({
        data: {
          projectId,
          fileId: stored.id,
          sourceLabel,
          format,
          status: 'pending',
          createdBy: request.user!.id,
        },
      });

      const job = await prisma.job.create({
        data: {
          projectId,
          userId: request.user!.id,
          type: 'import_parse',
          status: 'queued',
          payload: { importBatchId: batch.id },
        },
      });

      const bullJob = await importQueue().add(
        'parse',
        { importBatchId: batch.id, jobId: job.id },
        defaultJobOptions(),
      );
      await prisma.job.update({
        where: { id: job.id },
        data: { bullJobId: String(bullJob.id) },
      });

      await writeAudit({
        projectId,
        userId: request.user!.id,
        actorName: request.user!.name,
        action: 'Imported citation file',
        detail: `${file.filename} (${format})`,
        module: 'Library',
      });

      return { batch, jobId: job.id };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/projects/:projectId/imports', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      await requireProjectMember(projectId, request.user!.id);
      const batches = await prisma.importBatch.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return { batches };
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get('/api/jobs/:jobId', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) throw new AppError(404, 'not_found', 'Job not found');
      if (job.projectId) await requireProjectMember(job.projectId, request.user!.id);
      else if (job.userId !== request.user!.id) throw new AppError(403, 'forbidden', 'Forbidden');
      return { job };
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
