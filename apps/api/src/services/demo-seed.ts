import { prisma } from '../lib/prisma.js';
import { DEFAULT_EXTRACTION_FIELDS } from './extraction-defaults.js';

export const DEMO_PROJECT_NAME = 'LLM 辅助系统综述';
export const DEMO_QUESTION =
  '在人机共同完成系统综述时，基于任务风险、不确定性与证据充分性的动态协作流程，能否在维持筛选质量的同时降低人工工作量？';

export const DEMO_CRITERIA = [
  {
    code: 'P1',
    title: '研究对象',
    titleEn: 'Population',
    includeText: '系统综述研究人员或证据综合团队；任务包含文献筛选、数据提取或偏倚评价中的至少一项',
    excludeText: '非医学或健康相关证据综合；纯软件工程场景且无证据综合任务',
    sortOrder: 1,
  },
  {
    code: 'I1',
    title: '干预',
    titleEn: 'Intervention',
    includeText: '使用大语言模型（LLM）辅助至少一个系统综述环节',
    excludeText: '仅使用传统机器学习分类器或规则 NLP，未使用大语言模型',
    sortOrder: 2,
  },
  {
    code: 'C1',
    title: '对照',
    titleEn: 'Comparator',
    includeText: '人工独立筛选、双人筛选，或其他非 LLM 工作流作为对照',
    excludeText: '无对照描述且无法判断协作效果',
    sortOrder: 3,
  },
  {
    code: 'O1',
    title: '结局',
    titleEn: 'Outcomes',
    includeText: '报告敏感度/召回、精确度、工作量、一致率或决策时间中的至少一项',
    excludeText: '仅描述工具概念，无过程或效果指标',
    sortOrder: 4,
  },
  {
    code: 'S1',
    title: '研究设计',
    titleEn: 'Study design',
    includeText: '前瞻或回顾性验证研究；随机、交叉或前后对照的人机协作实验',
    excludeText: '观点、社论、会议摘要且无原始数据；无方法学细节的纯综述',
    sortOrder: 5,
  },
] as const;

type DemoCitationSeed = {
  title: string;
  authors: string;
  year: string;
  abstract: string;
  doi: string;
  journal: string;
  fullTextStatus: string;
  completeness: number;
  databaseName: string;
  /** Pre-seeded screening decisions for live practice (not UI mock numbers). */
  ai?: { decision: 'Include' | 'Exclude' | 'Uncertain'; rationale: string; evidence: string; confidence: string };
  human?: { decision: 'Include' | 'Exclude' | 'Uncertain'; rationale: string; evidence: string };
  extraction?: Record<string, string>;
};

export const DEMO_CITATIONS: DemoCitationSeed[] = [
  {
    title: 'Large language models for title and abstract screening in systematic reviews: a multicenter evaluation',
    authors: 'Martinez R, Chen L, Okonkwo P, et al.',
    year: '2026',
    abstract:
      'Background: Large language models (LLMs) are increasingly used to assist citation screening. Methods: We retrospectively applied GPT-4 class models to title/abstract screening across twelve completed systematic reviews (n=48,312 records). Human dual screening served as the reference standard. Results: Pooled sensitivity was 0.94 (95% CI 0.91-0.96) and workload reduction averaged 38% when uncertain records were escalated to humans. Conclusion: LLM-assisted screening can reduce workload while preserving recall when escalation rules are explicit.',
    doi: '10.1016/j.jclinepi.2026.4102',
    journal: 'Journal of Clinical Epidemiology',
    fullTextStatus: 'Full text',
    completeness: 100,
    databaseName: 'PubMed',
    ai: {
      decision: 'Include',
      rationale: 'Multicenter evaluation of LLM-assisted screening with sensitivity and workload outcomes.',
      evidence: 'Pooled sensitivity was 0.94 and workload reduction averaged 38%.',
      confidence: 'High',
    },
    human: {
      decision: 'Include',
      rationale: 'Meets PICO: LLM intervention, SR screening task, quantitative outcomes.',
      evidence: 'twelve completed systematic reviews (n=48,312 records)',
    },
    extraction: {
      study_design: '队列研究',
      sample_size: '48312',
      workflow: 'LLM first-pass with human escalation on uncertain',
      sensitivity: '0.94',
      workload_reduction: '0.38',
      human_ai_agreement: '0.81',
    },
  },
  {
    title: 'Machine learning approaches to predict hospital readmission in patients with heart failure',
    authors: 'Kim S, Park J, Nguyen T, et al.',
    year: '2025',
    abstract:
      'This study developed gradient boosting and logistic regression models to predict 30-day readmission among adults hospitalized with heart failure. The primary outcome was unplanned readmission. No evidence synthesis or literature screening tasks were performed.',
    doi: '10.1186/s12911-025-04102',
    journal: 'BMC Medical Informatics and Decision Making',
    fullTextStatus: 'Abstract',
    completeness: 72,
    databaseName: 'Embase',
    ai: {
      decision: 'Exclude',
      rationale: 'Clinical prediction study without systematic review or LLM screening workflow.',
      evidence: 'No evidence synthesis or literature screening tasks were performed.',
      confidence: 'High',
    },
  },
  {
    title: 'Artificial intelligence in evidence synthesis: a scoping review of emerging applications',
    authors: 'Ahmed H, Brooks M, Li Y, et al.',
    year: '2026',
    abstract:
      'We mapped artificial intelligence applications across evidence synthesis workflows, including screening, data extraction, and risk-of-bias assessment. Both traditional machine learning and large language models were included. Performance estimates were described narratively and were not pooled.',
    doi: '10.1002/jrsm.1964',
    journal: 'Research Synthesis Methods',
    fullTextStatus: 'Full text',
    completeness: 92,
    databaseName: 'PubMed',
    ai: {
      decision: 'Include',
      rationale: 'Scoping review of AI in evidence synthesis including LLM applications.',
      evidence: 'Both traditional machine learning and large language models were included.',
      confidence: 'Medium',
    },
    human: {
      decision: 'Uncertain',
      rationale: 'Maps the field but may be excluded if primary empirical evaluations are required.',
      evidence: 'Performance estimates were described narratively and were not pooled.',
    },
  },
  {
    title: 'GPT-4 versus dual human screening for randomized trials of digital mental health interventions',
    authors: 'Chen W, Alvarez R, Singh K, et al.',
    year: '2025',
    abstract:
      'Objective: Compare GPT-4 title/abstract decisions with independent dual human screening for a systematic review of digital mental health RCTs. Design: Cross-over experiment with blinded adjudication. Results: GPT-4 recall was 0.97 against the final include set; precision was lower than humans. Human override rescued 11 false negatives. Workload measured in decision minutes fell by 29%.',
    doi: '10.1136/bmjebm-2025-112233',
    journal: 'BMJ Evidence-Based Medicine',
    fullTextStatus: 'Full text',
    completeness: 98,
    databaseName: 'PubMed',
    ai: {
      decision: 'Exclude',
      rationale: 'Focus appears to be digital mental health interventions rather than LLM collaboration methods.',
      evidence: 'systematic review of digital mental health RCTs',
      confidence: 'Low',
    },
    human: {
      decision: 'Include',
      rationale: 'Primary exposure is GPT-4 screening performance with workload and recall outcomes.',
      evidence: 'Compare GPT-4 title/abstract decisions with independent dual human screening',
    },
    extraction: {
      study_design: 'RCT',
      sample_size: '6120',
      workflow: 'Blinded GPT-4 vs dual human with adjudication',
      sensitivity: '0.97',
      workload_reduction: '0.29',
      human_ai_agreement: '0.76',
    },
  },
  {
    title: 'ChatGPT-assisted data extraction for intervention reviews: accuracy against human double extraction',
    authors: 'Patel A, Gomez E, Tanaka H, et al.',
    year: '2026',
    abstract:
      'We evaluated ChatGPT for structured data extraction from 80 RCT full texts included in two intervention reviews. Extraction fields covered study design, sample size, and primary outcomes. Agreement with dual human extraction was 0.84 for categorical fields. Errors clustered in complex outcome definitions.',
    doi: '10.1016/j.jclinepi.2026.1188',
    journal: 'Journal of Clinical Epidemiology',
    fullTextStatus: 'Full text',
    completeness: 95,
    databaseName: 'Web of Science',
    ai: {
      decision: 'Include',
      rationale: 'LLM used for SR data extraction with agreement outcomes.',
      evidence: 'Agreement with dual human extraction was 0.84 for categorical fields.',
      confidence: 'High',
    },
  },
  {
    title: 'A rule-based and SVM pipeline for citation screening without large language models',
    authors: 'Lopez D, Ferreira C, Bauer N, et al.',
    year: '2024',
    abstract:
      'We built a classical NLP pipeline combining keyword rules and support vector machines for title/abstract screening. No transformer or large language model was used. Sensitivity reached 0.89 on an internal test set of 3,400 records.',
    doi: '10.1186/s12874-024-02201',
    journal: 'BMC Medical Research Methodology',
    fullTextStatus: 'Abstract',
    completeness: 80,
    databaseName: 'Embase',
    ai: {
      decision: 'Exclude',
      rationale: 'Uses SVM/rules only; explicitly excludes large language models.',
      evidence: 'No transformer or large language model was used.',
      confidence: 'High',
    },
    human: {
      decision: 'Exclude',
      rationale: 'Fails I1 because no LLM was used.',
      evidence: 'No transformer or large language model was used.',
    },
  },
  {
    title: 'Prompt engineering strategies for systematic review screening with open-weight LLMs',
    authors: 'Wright J, Huang Q, Ibrahim S, et al.',
    year: '2026',
    abstract:
      'This prospective study tested structured prompts, few-shot examples, and criterion-linked rationales for open-weight LLMs during title/abstract screening. Across five reviews, criterion-linked prompts improved recall by 6 percentage points versus zero-shot prompts, with a modest increase in tokens per record.',
    doi: '10.1002/jrsm.2011',
    journal: 'Research Synthesis Methods',
    fullTextStatus: 'Full text',
    completeness: 90,
    databaseName: 'PubMed',
  },
  {
    title: 'Pilot evaluation of an LLM for full-text eligibility assessment in living systematic reviews',
    authors: 'Nakamura Y, Ortega P, Klein M, et al.',
    year: '2025',
    abstract:
      'We piloted an LLM workflow for full-text eligibility checks in two living systematic reviews. The model proposed include/exclude labels with sentence-level evidence spans. Human reviewers accepted 71% of suggestions; disagreements were concentrated in poorly reported methods sections.',
    doi: '10.1136/bmjopen-2025-089001',
    journal: 'BMJ Open',
    fullTextStatus: 'Full text',
    completeness: 88,
    databaseName: 'PubMed',
  },
  {
    title: 'Artificial intelligence will transform systematic reviews overnight: an editorial',
    authors: 'Brooks M',
    year: '2025',
    abstract:
      'This editorial argues that artificial intelligence will rapidly change evidence synthesis practice. No original data, protocol, or evaluation metrics are presented.',
    doi: '10.1002/jrsm.editorial.2025',
    journal: 'Research Synthesis Methods',
    fullTextStatus: 'Missing',
    completeness: 40,
    databaseName: 'PubMed',
    ai: {
      decision: 'Exclude',
      rationale: 'Editorial without original empirical data.',
      evidence: 'No original data, protocol, or evaluation metrics are presented.',
      confidence: 'High',
    },
  },
  {
    title: 'Where humans and LLMs disagree during citation screening: a mixed-methods analysis',
    authors: 'Singh K, Martinez R, Chen W, et al.',
    year: '2026',
    abstract:
      'We analyzed 1,204 human-LLM disagreements from three systematic reviews using GPT-class models for title/abstract screening. Disagreements often involved ambiguous populations or incompletely reported interventions. Structured adjudication reduced residual false negatives. Workload accounting showed net time savings despite conflict review.',
    doi: '10.1016/j.jclinepi.2026.2204',
    journal: 'Journal of Clinical Epidemiology',
    fullTextStatus: 'Full text',
    completeness: 96,
    databaseName: 'Scopus',
    ai: {
      decision: 'Include',
      rationale: 'Empirical analysis of human-LLM screening disagreement with workload outcomes.',
      evidence: 'Structured adjudication reduced residual false negatives.',
      confidence: 'High',
    },
    human: {
      decision: 'Exclude',
      rationale: 'Appears secondary analysis without a prospective collaboration workflow experiment.',
      evidence: 'analyzed 1,204 human-LLM disagreements from three systematic reviews',
    },
    extraction: {
      study_design: '其他',
      sample_size: '1204',
      workflow: 'Post-hoc disagreement coding with structured adjudication',
      sensitivity: '',
      workload_reduction: '0.18',
      human_ai_agreement: '0.69',
    },
  },
];

export async function seedDemoProject(projectId: string, userId: string, options?: { resetCitations?: boolean }) {
  const resetCitations = options?.resetCitations !== false;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: DEMO_PROJECT_NAME,
      question: DEMO_QUESTION,
      description: 'Demo systematic review workspace for LLM-assisted screening evaluation.',
      reviewType: 'Intervention',
      collaborationMode: 'independent_parallel',
      escalationRule:
        'Escalate when uncertainty is high, evidence is insufficient, criteria conflict, or error consequence is high.',
    },
  });

  let protocol = await prisma.protocolVersion.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });

  if (!protocol) {
    protocol = await prisma.protocolVersion.create({
      data: {
        projectId,
        version: 1,
        question: DEMO_QUESTION,
        createdBy: userId,
        notes: 'Demo protocol for live practice',
      },
    });
  } else {
    await prisma.protocolVersion.update({
      where: { id: protocol.id },
      data: { question: DEMO_QUESTION },
    });
  }

  await prisma.eligibilityCriterion.deleteMany({ where: { protocolVersionId: protocol.id } });
  await prisma.eligibilityCriterion.createMany({
    data: DEMO_CRITERIA.map((c) => ({
      protocolVersionId: protocol!.id,
      code: c.code,
      title: c.title,
      titleEn: c.titleEn,
      includeText: c.includeText,
      excludeText: c.excludeText,
      sortOrder: c.sortOrder,
    })),
  });

  await prisma.extractionField.createMany({
    data: DEFAULT_EXTRACTION_FIELDS.map((field) => ({
      ...field,
      options: [...field.options],
      projectId,
      createdBy: userId,
    })),
    skipDuplicates: true,
  });

  if (resetCitations) {
    await prisma.riskOfBiasJudgement.deleteMany({ where: { projectId } });
    await prisma.extractionValue.deleteMany({ where: { projectId } });
    await prisma.screeningDecision.deleteMany({ where: { projectId } });
    await prisma.modelRun.updateMany({ where: { projectId }, data: { citationId: null } });
    await prisma.citationSource.deleteMany({
      where: { citation: { projectId } },
    });
    await prisma.citation.deleteMany({ where: { projectId } });
  }

  const existingCount = await prisma.citation.count({ where: { projectId } });
  if (existingCount > 0) {
    return { citationCount: existingCount, reset: false };
  }

  const fields = await prisma.extractionField.findMany({ where: { projectId } });
  const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  let citationCount = 0;
  for (const item of DEMO_CITATIONS) {
    const citation = await prisma.citation.create({
      data: {
        projectId,
        title: item.title,
        authors: item.authors,
        year: item.year,
        abstract: item.abstract,
        doi: item.doi,
        journal: item.journal,
        fullTextStatus: item.fullTextStatus,
        completeness: item.completeness,
        sources: {
          create: {
            databaseName: item.databaseName,
            rawPayload: { seeded: true, doi: item.doi },
          },
        },
      },
    });
    citationCount += 1;

    if (item.ai) {
      await prisma.screeningDecision.create({
        data: {
          projectId,
          citationId: citation.id,
          actor: 'ai',
          decision: item.ai.decision,
          rationale: item.ai.rationale,
          evidence: item.ai.evidence,
          confidence: item.ai.confidence,
          criterionIds: [],
        },
      });
    }

    if (item.human) {
      await prisma.screeningDecision.create({
        data: {
          projectId,
          citationId: citation.id,
          actor: 'human',
          decision: item.human.decision,
          rationale: item.human.rationale,
          evidence: item.human.evidence,
          userId,
          criterionIds: [],
        },
      });
    }

    if (item.extraction) {
      for (const [key, value] of Object.entries(item.extraction)) {
        const field = fieldByKey[key];
        if (!field || !value) continue;
        await prisma.extractionValue.create({
          data: {
            projectId,
            citationId: citation.id,
            fieldId: field.id,
            value,
            evidenceText: item.abstract.slice(0, 180),
            sourceLocation: 'Abstract',
            confidence: 'Medium',
            verified: false,
            createdBy: userId,
          },
        });
      }
    }
  }

  await prisma.auditEvent.create({
    data: {
      projectId,
      userId,
      actorName: 'Demo Seed',
      action: 'Seeded live practice dataset',
      detail: `Wrote ${citationCount} citations with protocol criteria, sample screening decisions, and extraction values.`,
      module: 'Project',
      version: 'Demo v1',
    },
  });

  return { citationCount, reset: true };
}

/** Wipe citations, screening, extraction values, RoB, imports, jobs, and audits for a project. Keeps members, credentials, and field schema. */
export async function clearProjectResearchData(projectId: string, options?: { resetProtocol?: boolean }) {
  const resetProtocol = options?.resetProtocol !== false;

  await prisma.riskOfBiasJudgement.deleteMany({ where: { projectId } });
  await prisma.extractionValue.deleteMany({ where: { projectId } });
  await prisma.screeningDecision.deleteMany({ where: { projectId } });
  await prisma.modelRun.deleteMany({ where: { projectId } });
  await prisma.job.deleteMany({ where: { projectId } });
  await prisma.auditEvent.deleteMany({ where: { projectId } });
  await prisma.citationSource.deleteMany({ where: { citation: { projectId } } });
  await prisma.citation.deleteMany({ where: { projectId } });
  await prisma.importBatch.deleteMany({ where: { projectId } });
  await prisma.storedFile.deleteMany({ where: { projectId } });

  if (resetProtocol) {
    await prisma.project.update({
      where: { id: projectId },
      data: { question: '' },
    });

    const protocols = await prisma.protocolVersion.findMany({ where: { projectId }, select: { id: true } });
    for (const protocol of protocols) {
      await prisma.eligibilityCriterion.deleteMany({ where: { protocolVersionId: protocol.id } });
      await prisma.protocolVersion.update({
        where: { id: protocol.id },
        data: { question: '', notes: null },
      });
    }
  }

  const citationCount = await prisma.citation.count({ where: { projectId } });
  return { citationCount, cleared: true };
}
