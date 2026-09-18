export const TEAM_ROLES = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const PROJECT_ROLES = ['owner', 'lead', 'reviewer', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const DECISION_VALUES = ['Include', 'Exclude', 'Uncertain'] as const;
export type DecisionValue = (typeof DECISION_VALUES)[number];

export const DECISION_ACTORS = ['human', 'human_b', 'ai', 'final'] as const;
export type DecisionActor = (typeof DECISION_ACTORS)[number];

export const SCREENING_DIFF_SCHEMA = 'qiuzheng.screening.diff.v1';
export const SCREENING_DIFF_STAGE_TITLE_ABSTRACT = 'title_abstract';

export const META_RESULT_SCHEMA = 'qiuzheng.meta.result.v1';
export const META_MEASURES = ['OR', 'RR', 'MD', 'SMD'] as const;
export type MetaMeasure = (typeof META_MEASURES)[number];

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

export const LLM_PROVIDERS = ['openai', 'azure', 'nvidia', 'deepseek', 'custom'] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const PROVIDER_PRESETS: Record<
  Exclude<LlmProvider, 'custom' | 'azure'>,
  { label: string; baseUrl: string; defaultModel: string; defaultEmbeddingModel: string }
> = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultEmbeddingModel: 'text-embedding-3-small',
  },
  nvidia: {
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    defaultEmbeddingModel: 'nvidia/nv-embedqa-e5-v5',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultEmbeddingModel: 'text-embedding-3-small',
  },
};

export const SCREEN_PROMPT_VERSION = 'screen-1.0';

/** Heuristic: models that accept enable_thinking / chat_template_kwargs. */
export function modelSupportsThinking(model?: string | null, provider?: string | null): boolean {
  const m = String(model || '').toLowerCase();
  const p = String(provider || '').toLowerCase();
  if (/qwen3|qwq|nemotron|deepseek-r1|deepseek-reasoner|glm-?4\.?5|glm5|reasoning|thinking|\br1\b/.test(m)) {
    return true;
  }
  if (p === 'nvidia' && /qwen|nemotron|glm|deepseek/.test(m)) return true;
  if (p === 'deepseek' && /reasoner|r1/.test(m)) return true;
  return false;
}

export type ScreeningLlmResult = {
  decision: DecisionValue;
  criterionIds: string[];
  evidenceSpans: string[];
  uncertainty: string;
  rationale: string;
  confidence: 'High' | 'Moderate' | 'Low';
};

export function canWriteProject(role: ProjectRole): boolean {
  return role === 'owner' || role === 'lead' || role === 'reviewer';
}

export function canManageProject(role: ProjectRole): boolean {
  return role === 'owner' || role === 'lead';
}

export function canManageTeam(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function roleAtLeast(role: ProjectRole, minimum: ProjectRole): boolean {
  const order: ProjectRole[] = ['viewer', 'reviewer', 'lead', 'owner'];
  return order.indexOf(role) >= order.indexOf(minimum);
}
