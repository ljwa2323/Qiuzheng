import type { DecisionValue, ScreeningDecision } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { writeAudit } from './rbac.js';

export type DecisionLike = Pick<ScreeningDecision, 'id' | 'actor' | 'decision' | 'rationale' | 'createdAt'>;

export type RollbackTarget = 'title_abstract' | 'fulltext_pending';

export type CitationWorkflowSnapshot = {
  citationId: string;
  title: string;
  latestFulltextFinal: DecisionLike | null;
  latestAdjudicationFinal: DecisionLike | null;
  titleAbstractIncluded: boolean;
  effectivelyIncluded: boolean;
  hasExtraction: boolean;
  hasRob: boolean;
  hasMeta: boolean;
  locksTitleAbstract: boolean;
  locksFulltextDecisionChange: boolean;
};

function rationaleOf(decision: { rationale?: string | null } | null | undefined): string {
  return String(decision?.rationale || '');
}

export function isFulltextTaggedDecision(decision: { rationale?: string | null } | null | undefined): boolean {
  const rationale = rationaleOf(decision);
  return /\[fulltext\]/i.test(rationale) || /^Full-text eligibility/i.test(rationale);
}

export function isAdjudicationFinalDecision(decision: { rationale?: string | null } | null | undefined): boolean {
  const rationale = rationaleOf(decision);
  return /\[adjudication\]/i.test(rationale) || /^Adjudication of/i.test(rationale);
}

export function latestByCreatedAt<T extends { createdAt: Date | string }>(rows: T[]): T | null {
  if (!rows?.length) return null;
  return rows.reduce((best, row) => {
    if (!best) return row;
    const a = new Date(row.createdAt).getTime() || 0;
    const b = new Date(best.createdAt).getTime() || 0;
    return a >= b ? row : best;
  }, null as T | null);
}

export function latestFulltextFinal(decisions: DecisionLike[]): DecisionLike | null {
  return latestByCreatedAt(
    decisions.filter((d) => d.actor === 'final' && isFulltextTaggedDecision(d)),
  );
}

export function latestTitleAbstractAi(decisions: DecisionLike[]): DecisionLike | null {
  return latestByCreatedAt(
    decisions.filter((d) => d.actor === 'ai' && !isFulltextTaggedDecision(d)),
  );
}

export function latestActor(decisions: DecisionLike[], actor: DecisionLike['actor']): DecisionLike | null {
  if (actor === 'ai') return latestTitleAbstractAi(decisions);
  return latestByCreatedAt(decisions.filter((d) => d.actor === actor));
}

/** Adjudication final is ignored once newer human/AI title-abstract decisions exist. */
export function latestAdjudicationFinal(decisions: DecisionLike[]): DecisionLike | null {
  const adj = latestByCreatedAt(
    decisions.filter((d) => d.actor === 'final' && isAdjudicationFinalDecision(d)),
  );
  if (!adj) return null;
  const peers = [
    latestActor(decisions, 'human'),
    latestActor(decisions, 'human_b'),
    latestTitleAbstractAi(decisions),
  ].filter(Boolean) as DecisionLike[];
  const maxPeer = Math.max(0, ...peers.map((p) => new Date(p.createdAt).getTime() || 0));
  const adjAt = new Date(adj.createdAt).getTime() || 0;
  if (maxPeer > adjAt) return null;
  return adj;
}

export function titleAbstractIncluded(decisions: DecisionLike[]): boolean {
  const adj = latestAdjudicationFinal(decisions);
  if (adj) return adj.decision === 'Include';
  const human = latestActor(decisions, 'human');
  const humanB = latestActor(decisions, 'human_b');
  if (humanB) {
    if (!human || human.decision !== humanB.decision) return false;
    return human.decision === 'Include';
  }
  return human?.decision === 'Include';
}

export function isEffectivelyIncluded(decisions: DecisionLike[]): boolean {
  return titleAbstractIncluded(decisions) && latestFulltextFinal(decisions)?.decision === 'Include';
}

export async function loadCitationWorkflow(
  projectId: string,
  citationId: string,
): Promise<CitationWorkflowSnapshot> {
  const citation = await prisma.citation.findFirst({
    where: { id: citationId, projectId },
    select: {
      id: true,
      title: true,
      decisions: {
        select: { id: true, actor: true, decision: true, rationale: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          extractionValues: true,
          riskOfBiasJudgements: true,
          effectRows: true,
        },
      },
    },
  });
  if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

  const ft = latestFulltextFinal(citation.decisions);
  const adj = latestAdjudicationFinal(citation.decisions);
  const hasExtraction = citation._count.extractionValues > 0;
  const hasRob = citation._count.riskOfBiasJudgements > 0;
  const hasMeta = citation._count.effectRows > 0;
  const locksTitleAbstract = Boolean(ft) || hasExtraction || hasRob || hasMeta;
  const locksFulltextDecisionChange = hasExtraction || hasRob || hasMeta;

  return {
    citationId: citation.id,
    title: citation.title,
    latestFulltextFinal: ft,
    latestAdjudicationFinal: adj,
    titleAbstractIncluded: titleAbstractIncluded(citation.decisions),
    effectivelyIncluded: isEffectivelyIncluded(citation.decisions),
    hasExtraction,
    hasRob,
    hasMeta,
    locksTitleAbstract,
    locksFulltextDecisionChange,
  };
}

export async function assertCanMutateTitleAbstract(projectId: string, citationId: string) {
  const snap = await loadCitationWorkflow(projectId, citationId);
  if (!snap.locksTitleAbstract) return snap;
  throw new AppError(
    409,
    'upstream_locked',
    'This citation already has full-text or later-stage work. Rollback this paper before changing title/abstract screening.',
    {
      citationId,
      rollbackTo: 'title_abstract',
      hasFulltextFinal: Boolean(snap.latestFulltextFinal),
      hasExtraction: snap.hasExtraction,
      hasRob: snap.hasRob,
      hasMeta: snap.hasMeta,
    },
  );
}

export async function assertCanMutateFulltextDecision(
  projectId: string,
  citationId: string,
  nextDecision: DecisionValue,
) {
  const snap = await loadCitationWorkflow(projectId, citationId);
  if (!snap.latestFulltextFinal) return snap;
  if (snap.latestFulltextFinal.decision === nextDecision) return snap;
  if (!snap.locksFulltextDecisionChange) return snap;
  throw new AppError(
    409,
    'upstream_locked',
    'This citation has extraction, risk-of-bias, or meta data. Rollback to full-text pending before changing the full-text decision.',
    {
      citationId,
      rollbackTo: 'fulltext_pending',
      hasExtraction: snap.hasExtraction,
      hasRob: snap.hasRob,
      hasMeta: snap.hasMeta,
    },
  );
}

export async function assertEffectivelyIncluded(projectId: string, citationId: string) {
  const snap = await loadCitationWorkflow(projectId, citationId);
  if (snap.effectivelyIncluded) return snap;
  throw new AppError(
    409,
    'not_eligible',
    'Citation is not effectively included (title/abstract Include and latest full-text Include required).',
    {
      citationId,
      titleAbstractIncluded: snap.titleAbstractIncluded,
      fulltextDecision: snap.latestFulltextFinal?.decision || null,
    },
  );
}

export async function listEffectivelyIncludedCitationIds(projectId: string): Promise<string[]> {
  const citations = await prisma.citation.findMany({
    where: { projectId },
    select: {
      id: true,
      decisions: {
        select: { id: true, actor: true, decision: true, rationale: true, createdAt: true },
      },
    },
    take: 10_000,
  });
  return citations.filter((c) => isEffectivelyIncluded(c.decisions)).map((c) => c.id);
}

export async function rollbackCitation(input: {
  projectId: string;
  citationId: string;
  to: RollbackTarget;
  userId: string;
  actorName: string;
}) {
  const citation = await prisma.citation.findFirst({
    where: { id: input.citationId, projectId: input.projectId },
    select: {
      id: true,
      title: true,
      decisions: {
        select: { id: true, actor: true, decision: true, rationale: true, createdAt: true },
      },
    },
  });
  if (!citation) throw new AppError(404, 'not_found', 'Citation not found');

  const fulltextIds = citation.decisions
    .filter((d) => d.actor === 'final' && isFulltextTaggedDecision(d))
    .map((d) => d.id);
  const adjudicationIds =
    input.to === 'title_abstract'
      ? citation.decisions
          .filter((d) => d.actor === 'final' && isAdjudicationFinalDecision(d))
          .map((d) => d.id)
      : [];
  const decisionIds = [...new Set([...fulltextIds, ...adjudicationIds])];

  const result = await prisma.$transaction(async (tx) => {
    const deletedDecisions = decisionIds.length
      ? await tx.screeningDecision.deleteMany({ where: { id: { in: decisionIds } } })
      : { count: 0 };
    const deletedExtraction = await tx.extractionValue.deleteMany({
      where: { projectId: input.projectId, citationId: input.citationId },
    });
    const deletedRob = await tx.riskOfBiasJudgement.deleteMany({
      where: { projectId: input.projectId, citationId: input.citationId },
    });
    const deletedEffect = await tx.effectRow.deleteMany({
      where: { projectId: input.projectId, citationId: input.citationId },
    });
    return {
      deletedDecisions: deletedDecisions.count,
      deletedExtraction: deletedExtraction.count,
      deletedRob: deletedRob.count,
      deletedEffect: deletedEffect.count,
    };
  });

  const targetLabel =
    input.to === 'title_abstract' ? 'title/abstract' : 'full-text pending';
  await writeAudit({
    projectId: input.projectId,
    userId: input.userId,
    actorName: input.actorName,
    action: `Rolled back citation to ${targetLabel}`,
    detail:
      `${citation.title}: cleared ${result.deletedDecisions} decision(s), `
      + `${result.deletedExtraction} extraction value(s), `
      + `${result.deletedRob} RoB judgement(s), `
      + `${result.deletedEffect} meta row(s)`,
    module: 'Workflow',
  });

  return {
    ok: true,
    to: input.to,
    citationId: citation.id,
    title: citation.title,
    ...result,
  };
}
