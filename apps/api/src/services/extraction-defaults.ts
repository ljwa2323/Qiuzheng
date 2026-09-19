import { prisma } from '../lib/prisma.js';

export const DEFAULT_EXTRACTION_FIELDS = [
  { key: 'study_design', label: '研究设计', group: 'characteristics', dataType: 'select', options: ['RCT', '队列研究', '病例对照', '横断面', '其他'], required: true, sortOrder: 10, description: '研究采用的主要设计。' },
  { key: 'sample_size', label: '样本量', group: 'characteristics', dataType: 'number', options: [], required: false, sortOrder: 20, description: '纳入分析的参与者或记录数量。' },
  { key: 'workflow', label: '协作流程', group: 'characteristics', dataType: 'text', options: [], required: false, sortOrder: 30, description: '人工与 AI 的任务分工和顺序。' },
  { key: 'sensitivity', label: '敏感度', group: 'characteristics', dataType: 'number', options: [], required: true, sortOrder: 40, description: '主要筛选敏感度或召回率。' },
  { key: 'workload_reduction', label: '工作量降低', group: 'characteristics', dataType: 'number', options: [], required: false, sortOrder: 50, description: '相较对照流程降低的人工工作量。' },
  { key: 'human_ai_agreement', label: '人机一致率', group: 'characteristics', dataType: 'number', options: [], required: false, sortOrder: 60, description: '人工与 AI 初始判断的一致比例。' },
] as const;

export async function ensureDefaultExtractionFields(projectId: string, userId: string) {
  // Only seed once for an empty project. Do not recreate keys after the user deletes them.
  const existing = await prisma.extractionField.count({ where: { projectId } });
  if (existing > 0) return;

  await prisma.extractionField.createMany({
    data: DEFAULT_EXTRACTION_FIELDS.map((field) => ({
      ...field,
      options: [...field.options],
      projectId,
      createdBy: userId,
    })),
    skipDuplicates: true,
  });
}
