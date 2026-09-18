import { prisma } from '../lib/prisma.js';

export const SYNTHESIS_QUERY_KEYS = [
  'protocol',
  'screening',
  'adjudication',
  'fulltext',
  'extraction',
  'rob',
  'meta',
  'audit',
] as const;

export type SynthesisQueryKey = (typeof SYNTHESIS_QUERY_KEYS)[number];

function isFulltextFinal(rationale?: string | null) {
  return /\[fulltext\]/i.test(String(rationale || ''));
}

function isAdjudicationFinal(rationale?: string | null) {
  return /\[adjudication\]/i.test(String(rationale || ''));
}

export async function recallSynthesisKnowledge(projectId: string, queries: SynthesisQueryKey[]) {
  const wanted = new Set(queries);
  const pack: Record<string, unknown> = { projectId, queriedAt: new Date().toISOString(), sections: {} };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      protocolVersions: { orderBy: { version: 'desc' }, take: 1 },
      searchStrategy: true,
    },
  });
  if (!project) throw new Error('Project not found');

  (pack as { project: unknown }).project = {
    id: project.id,
    name: project.name,
    description: project.description,
    question: project.question,
  };

  if (wanted.has('protocol')) {
    const latest = project.protocolVersions[0];
    const criteria = latest
      ? await prisma.eligibilityCriterion.findMany({
          where: { protocolVersionId: latest.id },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    (pack.sections as Record<string, unknown>).protocol = {
      question: project.question,
      pico: latest
        ? { p: latest.picoP, i: latest.picoI, c: latest.picoC, o: latest.picoO }
        : null,
      criteria: criteria.map((c) => ({
        code: c.code,
        title: c.title,
        includeText: c.includeText,
        excludeText: c.excludeText,
      })),
      searchStrategyUpdatedAt: project.searchStrategy?.updatedAt || null,
    };
  }

  if (wanted.has('screening') || wanted.has('adjudication') || wanted.has('fulltext')) {
    const citations = await prisma.citation.findMany({
      where: { projectId },
      include: {
        decisions: { orderBy: { createdAt: 'desc' } },
      },
    });
    let humanDone = 0;
    let conflictsHumanAi = 0;
    let conflictsDual = 0;
    let fulltextInclude = 0;
    let fulltextExclude = 0;
    for (const c of citations) {
      const human = c.decisions.find((d) => d.actor === 'human');
      const humanB = c.decisions.find((d) => d.actor === 'human_b');
      const ai = c.decisions.find((d) => d.actor === 'ai');
      const finals = c.decisions.filter((d) => d.actor === 'final');
      const adj = finals.find((d) => isAdjudicationFinal(d.rationale));
      const ft = finals.find((d) => isFulltextFinal(d.rationale));
      if (human) humanDone += 1;
      if (human && humanB && human.decision !== humanB.decision && !adj) conflictsDual += 1;
      else if (human && !humanB && ai && human.decision !== ai.decision && !adj) conflictsHumanAi += 1;
      if (ft?.decision === 'Include') fulltextInclude += 1;
      if (ft?.decision === 'Exclude') fulltextExclude += 1;
    }
    if (wanted.has('screening')) {
      (pack.sections as Record<string, unknown>).screening = {
        citationCount: citations.length,
        humanDecisions: humanDone,
        remaining: Math.max(0, citations.length - humanDone),
      };
    }
    if (wanted.has('adjudication')) {
      (pack.sections as Record<string, unknown>).adjudication = {
        dualConflicts: conflictsDual,
        humanAiConflicts: conflictsHumanAi,
        openTotal: conflictsDual + conflictsHumanAi,
      };
    }
    if (wanted.has('fulltext')) {
      (pack.sections as Record<string, unknown>).fulltext = {
        included: fulltextInclude,
        excluded: fulltextExclude,
      };
    }
  }

  if (wanted.has('extraction')) {
    const [fields, values] = await Promise.all([
      prisma.extractionField.findMany({ where: { projectId, active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.extractionValue.findMany({ where: { projectId } }),
    ]);
    (pack.sections as Record<string, unknown>).extraction = {
      fieldCount: fields.length,
      filledCells: values.filter((v) => v.value).length,
      verifiedCells: values.filter((v) => v.verified).length,
      fields: fields.map((f) => ({ key: f.key, label: f.label, dataType: f.dataType })),
    };
  }

  if (wanted.has('rob')) {
    const judgements = await prisma.riskOfBiasJudgement.findMany({
      where: { projectId, actor: 'human' },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    (pack.sections as Record<string, unknown>).rob = {
      humanJudgementCount: judgements.length,
      recent: judgements.slice(0, 20).map((j) => ({
        citationId: j.citationId,
        domainKey: j.domainKey,
        questionKey: j.questionKey,
        judgement: j.judgement,
      })),
    };
  }

  if (wanted.has('meta')) {
    const analyses = await prisma.outcomeAnalysis.findMany({
      where: { projectId },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { rows: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    (pack.sections as Record<string, unknown>).meta = {
      analysisCount: analyses.length,
      analyses: analyses.map((a) => {
        const run = a.runs[0];
        const summary = (run?.resultJson as { summary?: Record<string, unknown> } | null)?.summary || null;
        return {
          id: a.id,
          name: a.name,
          measure: a.measure,
          rowCount: a._count.rows,
          latestRun: run
            ? {
                id: run.id,
                model: run.model,
                createdAt: run.createdAt,
                summary,
              }
            : null,
        };
      }),
    };
  }

  if (wanted.has('audit')) {
    const events = await prisma.auditEvent.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    (pack.sections as Record<string, unknown>).audit = {
      recent: events.map((e) => ({
        actorName: e.actorName,
        action: e.action,
        detail: e.detail,
        module: e.module,
        createdAt: e.createdAt,
      })),
    };
  }

  return pack;
}

export function knowledgeToMarkdown(pack: Record<string, unknown>, title: string) {
  const project = pack.project as { name?: string; question?: string } | undefined;
  const sections = (pack.sections || {}) as Record<string, any>;
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> Generated ${pack.queriedAt}`);
  lines.push('');
  if (project?.name) lines.push(`**Project:** ${project.name}`);
  if (project?.question) {
    lines.push('');
    lines.push('## Research question');
    lines.push(project.question);
  }

  if (sections.protocol) {
    lines.push('');
    lines.push('## Protocol');
    lines.push(`Criteria entries: ${Array.isArray(sections.protocol.criteria) ? sections.protocol.criteria.length : 0}`);
  }
  if (sections.screening) {
    lines.push('');
    lines.push('## Title/abstract screening');
    lines.push(`- Citations: ${sections.screening.citationCount}`);
    lines.push(`- Human decisions: ${sections.screening.humanDecisions}`);
    lines.push(`- Remaining: ${sections.screening.remaining}`);
  }
  if (sections.adjudication) {
    lines.push('');
    lines.push('## Adjudication');
    lines.push(`- Open conflicts: ${sections.adjudication.openTotal} (dual ${sections.adjudication.dualConflicts}, human-AI ${sections.adjudication.humanAiConflicts})`);
  }
  if (sections.fulltext) {
    lines.push('');
    lines.push('## Full-text screening');
    lines.push(`- Included: ${sections.fulltext.included}`);
    lines.push(`- Excluded: ${sections.fulltext.excluded}`);
  }
  if (sections.extraction) {
    lines.push('');
    lines.push('## Extraction');
    lines.push(`- Fields: ${sections.extraction.fieldCount}`);
    lines.push(`- Filled cells: ${sections.extraction.filledCells}`);
    lines.push(`- Verified: ${sections.extraction.verifiedCells}`);
  }
  if (sections.rob) {
    lines.push('');
    lines.push('## Risk of bias');
    lines.push(`- Human judgements: ${sections.rob.humanJudgementCount}`);
  }
  if (sections.meta) {
    lines.push('');
    lines.push('## Meta-analysis knowledge');
    lines.push(`- Analyses: ${sections.meta.analysisCount}`);
    for (const a of sections.meta.analyses || []) {
      const s = a.latestRun?.summary;
      lines.push(`- **${a.name}** (${a.measure}, ${a.rowCount} rows)`);
      if (s) {
        lines.push(
          `  - Pooled (${a.latestRun.model}): ${Number(s.yiDisplay).toFixed(3)} [${Number(s.ciLowDisplay).toFixed(3)}, ${Number(s.ciHighDisplay).toFixed(3)}]; I2=${Number(s.i2).toFixed(1)}%`,
        );
      } else {
        lines.push('  - No completed run yet');
      }
    }
  }
  if (sections.audit) {
    lines.push('');
    lines.push('## Recent audit');
    for (const e of (sections.audit.recent || []).slice(0, 8)) {
      lines.push(`- ${e.actorName}: ${e.action} — ${e.detail}`);
    }
  }

  lines.push('');
  lines.push('## Narrative (template)');
  lines.push(
    'This draft is assembled from queried stage knowledge. Meta pooled estimates above are deterministic recipe outputs and should be cited as calculated results; refine narrative wording separately.',
  );
  return lines.join('\n');
}
