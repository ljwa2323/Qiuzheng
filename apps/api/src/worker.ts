import { prisma } from './lib/prisma.js';
import { getObjectBuffer } from './lib/s3.js';
import { parseCitationFile } from './services/citation-parser.js';
import { createWorker, QUEUE_IMPORT, QUEUE_SCREEN, QUEUE_EXTRACT } from './lib/queue.js';
import { runScreeningAi } from './routes/screening.js';
import { runExtractionAi } from './routes/extraction.js';
import { writeAudit } from './services/rbac.js';
import { loadEnv } from './config/env.js';
import { ensureBucket } from './lib/s3.js';

loadEnv();

async function processImport(data: Record<string, unknown>) {
  const importBatchId = String(data.importBatchId);
  const jobId = data.jobId ? String(data.jobId) : null;

  if (jobId) {
    await prisma.job.update({ where: { id: jobId }, data: { status: 'active' } });
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: importBatchId },
    include: { file: true },
  });
  if (!batch || !batch.file) throw new Error('Import batch or file missing');

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: 'processing' },
  });

  try {
    const buffer = await getObjectBuffer(batch.file.objectKey);
    const text = buffer.toString('utf8');
    const parsed = parseCitationFile(text, batch.format);

    let createdCount = 0;
    let duplicateCount = 0;

    for (const item of parsed) {
      const existing = item.doi
        ? await prisma.citation.findFirst({
            where: { projectId: batch.projectId, doi: item.doi },
          })
        : null;

      if (existing) {
        duplicateCount += 1;
        await prisma.citationSource.create({
          data: {
            citationId: existing.id,
            importBatchId: batch.id,
            databaseName: batch.sourceLabel,
          },
        });
        continue;
      }

      const citation = await prisma.citation.create({
        data: {
          projectId: batch.projectId,
          importBatchId: batch.id,
          title: item.title,
          authors: item.authors,
          year: item.year,
          abstract: item.abstract,
          doi: item.doi || null,
          completeness: item.abstract ? 72 : 45,
          fullTextStatus: 'Missing',
          sources: {
            create: {
              importBatchId: batch.id,
              databaseName: batch.sourceLabel,
            },
          },
        },
      });
      createdCount += 1;
      void citation;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: 'completed',
        totalCount: parsed.length,
        createdCount,
        duplicateCount,
        completedAt: new Date(),
      },
    });

    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          result: { totalCount: parsed.length, createdCount, duplicateCount },
          completedAt: new Date(),
        },
      });
    }

    await writeAudit({
      projectId: batch.projectId,
      userId: batch.createdBy,
      actorName: 'System',
      action: 'Completed citation import',
      detail: `Created ${createdCount}, duplicates ${duplicateCount}`,
      module: 'Library',
    });

    return { createdCount, duplicateCount };
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: 'failed', errorMessage: (err as Error).message },
    });
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: (err as Error).message },
      });
    }
    throw err;
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableScreenError(err: unknown) {
  const message = String((err as Error)?.message || err || '');
  return /503|429|502|504|overloaded|unavailable|timeout|ECONNRESET|ETIMEDOUT|fetch failed|temporar/i.test(message);
}

async function runScreeningAiWithRetry(input: {
  projectId: string;
  citationId: string;
  credentialId: string;
  model?: string;
  userId?: string;
}, attempts = 3) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await runScreeningAi(input);
    } catch (err) {
      lastErr = err;
      if (!isRetryableScreenError(err) || i === attempts - 1) throw err;
      await sleep(1200 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

async function processScreen(data: Record<string, unknown>) {
  const jobId = data.jobId ? String(data.jobId) : null;
  if (jobId) await prisma.job.update({ where: { id: jobId }, data: { status: 'active' } });

  try {
    if (Array.isArray(data.citationIds)) {
      const citationIds = (data.citationIds as string[]).map(String);
      const total = citationIds.length;
      const results: Array<{ citationId: string; decisionId: string }> = [];
      const failures: Array<{ citationId: string; error: string }> = [];

      const writeProgress = async (status?: 'active' | 'completed' | 'failed') => {
        if (!jobId) return;
        const processed = results.length + failures.length;
        const remaining = citationIds.filter(
          (id) => !results.some((r) => r.citationId === id) && !failures.some((f) => f.citationId === id),
        );
        await prisma.job.update({
          where: { id: jobId },
          data: {
            ...(status ? { status } : {}),
            ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
            errorMessage: failures.length
              ? failures.map((f) => `${f.citationId}: ${f.error}`).slice(0, 3).join(' | ')
              : null,
            result: {
              total,
              done: processed,
              succeeded: results.length,
              failed: failures.length,
              results,
              failures,
              remaining,
            },
          },
        });
      };

      await writeProgress('active');

      for (const citationId of citationIds) {
        try {
          const result = await runScreeningAiWithRetry({
            projectId: String(data.projectId),
            citationId,
            credentialId: String(data.credentialId),
            model: data.model ? String(data.model) : undefined,
            userId: data.userId ? String(data.userId) : undefined,
          });
          results.push({ citationId, decisionId: result.decision.id });
        } catch (err) {
          failures.push({
            citationId,
            error: String((err as Error)?.message || err || 'unknown error'),
          });
        }
        await writeProgress('active');
      }

      const finalStatus = results.length === 0 && failures.length > 0 ? 'failed' : 'completed';
      await writeProgress(finalStatus);
      return { results, failures };
    }

    const result = await runScreeningAiWithRetry({
      projectId: String(data.projectId),
      citationId: String(data.citationId),
      credentialId: String(data.credentialId),
      model: data.model ? String(data.model) : undefined,
      userId: data.userId ? String(data.userId) : undefined,
    });
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          result: { decisionId: result.decision.id, succeeded: 1, failed: 0 },
          completedAt: new Date(),
        },
      });
    }
    return result;
  } catch (err) {
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: (err as Error).message },
      });
    }
    throw err;
  }
}

async function runExtractionAiWithRetry(input: {
  projectId: string;
  citationId: string;
  credentialId: string;
  model?: string;
  fieldIds?: string[];
  userId: string;
}, attempts = 3) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await runExtractionAi(input);
    } catch (err) {
      lastErr = err;
      if (!isRetryableScreenError(err) || i === attempts - 1) throw err;
      await sleep(1200 * Math.pow(2, i));
    }
  }
  throw lastErr;
}

async function processExtract(data: Record<string, unknown>) {
  const jobId = data.jobId ? String(data.jobId) : null;
  if (jobId) await prisma.job.update({ where: { id: jobId }, data: { status: 'active' } });

  try {
    const citationIds = Array.isArray(data.citationIds)
      ? (data.citationIds as string[]).map(String)
      : [String(data.citationId)];
    const fieldIds = Array.isArray(data.fieldIds)
      ? (data.fieldIds as string[]).map(String).filter(Boolean)
      : [];
    const total = citationIds.length;
    const results: Array<{ citationId: string; count: number }> = [];
    const failures: Array<{ citationId: string; error: string }> = [];

    const writeProgress = async (status?: 'active' | 'completed' | 'failed') => {
      if (!jobId) return;
      const processed = results.length + failures.length;
      const remaining = citationIds.filter(
        (id) => !results.some((r) => r.citationId === id) && !failures.some((f) => f.citationId === id),
      );
      await prisma.job.update({
        where: { id: jobId },
        data: {
          ...(status ? { status } : {}),
          ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
          errorMessage: failures.length
            ? failures.map((f) => `${f.citationId}: ${f.error}`).slice(0, 3).join(' | ')
            : null,
          result: {
            total,
            done: processed,
            succeeded: results.length,
            failed: failures.length,
            results,
            failures,
            remaining,
          },
        },
      });
    };

    await writeProgress('active');

    for (const citationId of citationIds) {
      try {
        const result = await runExtractionAiWithRetry({
          projectId: String(data.projectId),
          citationId,
          credentialId: String(data.credentialId),
          model: data.model ? String(data.model) : undefined,
          fieldIds: fieldIds.length ? fieldIds : undefined,
          userId: String(data.userId || ''),
        });
        results.push({ citationId, count: result.count });
      } catch (err) {
        failures.push({
          citationId,
          error: String((err as Error)?.message || err || 'unknown error'),
        });
      }
      await writeProgress('active');
    }

    const finalStatus = results.length === 0 && failures.length > 0 ? 'failed' : 'completed';
    await writeProgress(finalStatus);
    return { results, failures };
  } catch (err) {
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: (err as Error).message },
      });
    }
    throw err;
  }
}

async function main() {
  await ensureBucket();
  createWorker(QUEUE_IMPORT, processImport);
  createWorker(QUEUE_SCREEN, processScreen);
  createWorker(QUEUE_EXTRACT, processExtract);
  console.log('Qiuzheng workers started');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
