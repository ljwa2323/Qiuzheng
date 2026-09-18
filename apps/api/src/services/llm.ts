import {
  PROVIDER_PRESETS,
  SCREEN_PROMPT_VERSION,
  modelSupportsThinking,
  type DecisionValue,
  type ScreeningLlmResult,
} from '@qiuzheng/shared';
import type { LlmProvider, ModelCredential } from '@prisma/client';
import { decryptSecret } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import {
  embeddingCacheKey,
  getCachedSpanVectors,
  hashSourceContent,
  setCachedSpanVectors,
} from '../lib/embedding-cache.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmResponseLanguage = 'zh' | 'en';

/** Prefer stored Markdown full text for AI; fall back to abstract. */
export function citationAiSource(citation: {
  fullTextMarkdown?: string | null;
  abstract?: string | null;
}): string {
  const md = String(citation.fullTextMarkdown || '').trim();
  if (md) return md;
  return String(citation.abstract || '');
}

export function normalizeLlmResponseLanguage(value?: string | null): LlmResponseLanguage {
  return String(value || '').toLowerCase() === 'en' ? 'en' : 'zh';
}

export function responseLanguageInstruction(
  language?: string | null,
  mode: 'json' | 'chat' = 'json',
): string {
  const lang = normalizeLlmResponseLanguage(language);
  if (mode === 'chat') {
    return lang === 'zh'
      ? 'Language: Reply entirely in Simplified Chinese. Keep verbatim source quotes untranslated.'
      : 'Language: Reply entirely in English. Keep verbatim source quotes untranslated.';
  }
  return lang === 'zh'
    ? 'Language: Write rationale, uncertainty, judgements, explanations, and free-text field values in Simplified Chinese. Keep evidenceText/evidenceSpans as exact verbatim source quotes (do not translate). Keep JSON keys and enum tokens (Include/Exclude/Uncertain, High/Moderate/Low, etc.) exactly as specified.'
    : 'Language: Write rationale, uncertainty, judgements, explanations, and free-text field values in English. Keep evidenceText/evidenceSpans as exact verbatim source quotes (do not translate). Keep JSON keys and enum tokens (Include/Exclude/Uncertain, High/Moderate/Low, etc.) exactly as specified.';
}

/** Inject fixed response-language instruction into the first system message. */
export function applyLlmResponseLanguage(
  messages: ChatMessage[],
  language?: string | null,
  mode: 'json' | 'chat' = 'json',
): ChatMessage[] {
  const block = responseLanguageInstruction(language, mode);
  if (!messages.length) return [{ role: 'system', content: block }];
  const [first, ...rest] = messages;
  if (first.role === 'system') {
    return [{ ...first, content: `${first.content}\n\n${block}` }, ...rest];
  }
  return [{ role: 'system', content: block }, ...messages];
}

/** @deprecated Use applyLlmResponseLanguage */
export function applyGlobalLlmRules(messages: ChatMessage[], _rules?: string | null): ChatMessage[] {
  return applyLlmResponseLanguage(messages, 'zh', 'json');
}

export function resolveBaseUrl(provider: LlmProvider, baseUrl: string): string {
  if (provider === 'custom' || provider === 'azure') return baseUrl.replace(/\/$/, '');
  const preset = PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS];
  return (baseUrl || preset?.baseUrl || '').replace(/\/$/, '');
}

async function loadCredentialSecret(credentialId: string) {
  const credential = await prisma.modelCredential.findUnique({ where: { id: credentialId } });
  if (!credential) throw new AppError(404, 'not_found', 'Model credential not found');
  const apiKey = decryptSecret(credential.apiKeyCipher, credential.apiKeyIv, credential.apiKeyTag);
  return { credential, apiKey };
}

function normalizeAssistantContent(content: string): string {
  return String(content || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractProviderErrorMessage(raw: unknown, status: number): string {
  if (raw && typeof raw === 'object') {
    const err = (raw as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err.trim();
    if (err && typeof err === 'object') {
      const message = String((err as { message?: unknown }).message || '').trim();
      if (message) return message;
    }
    const message = String((raw as { message?: unknown }).message || '').trim();
    if (message) return message;
  }
  return `HTTP ${status}`;
}

function friendlyLlmError(status: number, providerMessage: string): { statusCode: number; code: string; message: string } {
  const lower = providerMessage.toLowerCase();
  if (status === 429 || /rate.?limit|too many requests/i.test(lower)) {
    return {
      statusCode: 429,
      code: 'llm_rate_limited',
      message: '模型服务限流，请稍后再试',
    };
  }
  if (status === 503 || /overloaded|unavailable|capacity|temporar/i.test(lower)) {
    return {
      statusCode: 503,
      code: 'llm_overloaded',
      message: '模型服务暂时过载，请稍后再点「AI 核对」重试',
    };
  }
  if (status === 401 || status === 403) {
    return {
      statusCode: 502,
      code: 'llm_auth_error',
      message: '模型凭据无效或无权访问，请检查 API Key / 模型权限',
    };
  }
  return {
    statusCode: 502,
    code: 'llm_error',
    message: providerMessage.slice(0, 300) || `模型调用失败（HTTP ${status}）`,
  };
}

function isRetryableLlmStatus(status: number, providerMessage: string): boolean {
  if ([429, 502, 503, 504].includes(status)) return true;
  return /overloaded|unavailable|timeout|temporar|capacity|rate.?limit/i.test(providerMessage);
}

export async function callChatCompletions(opts: {
  credentialId: string;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
  timeoutMs?: number;
  retries?: number;
}): Promise<{
  content: string;
  model: string;
  provider: LlmProvider;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  raw: unknown;
  credential: ModelCredential;
}> {
  const { credential, apiKey } = await loadCredentialSecret(opts.credentialId);
  const model = opts.model || credential.defaultModel;
  const baseUrl = resolveBaseUrl(credential.provider, credential.baseUrl);
  const url = `${baseUrl}/chat/completions`;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.1,
  };
  if (opts.responseFormatJson) {
    body.response_format = { type: 'json_object' };
  }
  if (modelSupportsThinking(model, credential.provider)) {
    body.chat_template_kwargs = {
      enable_thinking: Boolean(credential.thinkingEnabled),
    };
  }

  const maxAttempts = Math.max(1, (opts.retries ?? 3) + 1);
  let lastError: AppError | null = null;
  const started = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      lastError = new AppError(502, 'llm_unreachable', `LLM request failed: ${(err as Error).message}`);
      if (attempt < maxAttempts - 1) {
        await sleep(1200 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = extractProviderErrorMessage(raw, response.status);
      const mapped = friendlyLlmError(response.status, providerMessage);
      lastError = new AppError(mapped.statusCode, mapped.code, mapped.message);
      if (isRetryableLlmStatus(response.status, providerMessage) && attempt < maxAttempts - 1) {
        await sleep(1200 * Math.pow(2, attempt));
        continue;
      }
      throw lastError;
    }

    const message = (raw as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> })
      ?.choices?.[0]?.message;
    const content = normalizeAssistantContent(message?.content ?? '');
    const usage = (raw as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;

    return {
      content,
      model,
      provider: credential.provider,
      latencyMs: Date.now() - started,
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      raw,
      credential,
    };
  }

  throw lastError || new AppError(502, 'llm_error', 'Model call failed');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function splitSourceSpans(source: string, maxChars = 480): string[] {
  const text = String(source || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const raw = text.match(/[^\n.!?。！？]+[.!?。！？]?|\n+/g) || [text];
  const sentences = raw
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length >= 12);
  const spans: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (!buffer) {
      buffer = sentence;
      continue;
    }
    if (`${buffer} ${sentence}`.length <= maxChars) {
      buffer = `${buffer} ${sentence}`;
    } else {
      spans.push(buffer);
      buffer = sentence;
    }
  }
  if (buffer) spans.push(buffer);
  return spans.slice(0, 120);
}

export async function callEmbeddings(opts: {
  credentialId: string;
  model?: string;
  inputs: string[];
  timeoutMs?: number;
}): Promise<{ vectors: number[][]; model: string; provider: LlmProvider; latencyMs: number }> {
  const inputs = opts.inputs.map((item) => String(item || '').trim()).filter(Boolean);
  if (!inputs.length) return { vectors: [], model: opts.model || '', provider: 'custom', latencyMs: 0 };

  const { credential, apiKey } = await loadCredentialSecret(opts.credentialId);
  const preset = PROVIDER_PRESETS[credential.provider as keyof typeof PROVIDER_PRESETS];
  const model = opts.model || preset?.defaultEmbeddingModel || 'text-embedding-3-small';
  const baseUrl = resolveBaseUrl(credential.provider, credential.baseUrl);
  const url = `${baseUrl}/embeddings`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({ model, input: inputs }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new AppError(502, 'embedding_unreachable', `Embedding request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = extractProviderErrorMessage(raw, response.status);
    const mapped = friendlyLlmError(response.status, providerMessage);
    throw new AppError(mapped.statusCode, 'embedding_error', mapped.message.replace('AI 核对', 'Embedding'));
  }

  const rows = Array.isArray((raw as { data?: unknown }).data)
    ? ((raw as { data: Array<{ embedding?: number[]; index?: number }> }).data || [])
    : [];
  const ordered = [...rows].sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
  const vectors = ordered.map((row) => (Array.isArray(row.embedding) ? row.embedding.map(Number) : []));
  if (vectors.length !== inputs.length || vectors.some((v) => !v.length)) {
    throw new AppError(502, 'embedding_error', 'Embedding provider returned incomplete vectors');
  }

  return {
    vectors,
    model: String((raw as { model?: string }).model || model),
    provider: credential.provider,
    latencyMs: Date.now() - started,
  };
}

export type RankedEvidenceSpan = {
  text: string;
  score: number;
  index: number;
};

/** Rank source spans by embedding similarity to a query (criterion / question / field). */
export async function rankEvidenceSpans(opts: {
  sourceText: string;
  query: string;
  credentialId: string;
  model?: string;
  topK?: number;
  minScore?: number;
  citationId?: string;
}): Promise<{ ranked: RankedEvidenceSpan[]; cacheHit: boolean; model: string }> {
  const spans = splitSourceSpans(opts.sourceText);
  const query = String(opts.query || '').trim();
  if (!spans.length || !query) return { ranked: [], cacheHit: false, model: opts.model || '' };

  const topK = Math.min(Math.max(opts.topK ?? 5, 1), 20);
  const minScore = opts.minScore ?? 0.18;
  const contentHash = hashSourceContent(opts.sourceText);
  const modelHint = opts.model || '';
  const cacheKey = embeddingCacheKey({
    credentialId: opts.credentialId,
    model: modelHint || 'default',
    citationId: opts.citationId,
    contentHash,
  });

  let spanVectors: number[][] | null = null;
  let cacheHit = false;
  let usedModel = modelHint;

  const cached = await getCachedSpanVectors(cacheKey);
  if (cached && cached.spans.length === spans.length && cached.spans.every((s, i) => s === spans[i])) {
    spanVectors = cached.vectors;
    cacheHit = true;
    usedModel = cached.model || usedModel;
  }

  let queryVector: number[];
  if (spanVectors) {
    const embeddedQuery = await callEmbeddings({
      credentialId: opts.credentialId,
      model: opts.model,
      inputs: [query],
    });
    queryVector = embeddedQuery.vectors[0];
    usedModel = embeddedQuery.model || usedModel;
  } else {
    const embedded = await callEmbeddings({
      credentialId: opts.credentialId,
      model: opts.model,
      inputs: [query, ...spans],
    });
    queryVector = embedded.vectors[0];
    spanVectors = embedded.vectors.slice(1);
    usedModel = embedded.model || usedModel;
    await setCachedSpanVectors(cacheKey, {
      spans,
      vectors: spanVectors,
      model: usedModel,
    });
  }

  const ranked = spanVectors
    .map((vector, index) => ({
      text: spans[index],
      score: cosineSimilarity(queryVector, vector),
      index,
    }))
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { ranked, cacheHit, model: usedModel };
}

export async function resolveProjectEmbeddingConfig(projectId: string): Promise<{
  credentialId: string | null;
  model: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      credentialId: true,
      embeddingCredentialId: true,
      embeddingModel: true,
      embeddingCredential: { select: { id: true, provider: true } },
      credential: { select: { id: true, provider: true } },
    },
  });
  if (!project) return null;
  const credentialId = project.embeddingCredentialId || project.credentialId || null;
  if (!credentialId) return { credentialId: null, model: '' };
  const provider = project.embeddingCredential?.provider || project.credential?.provider;
  const preset = provider ? PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS] : undefined;
  const model = String(project.embeddingModel || '').trim() || preset?.defaultEmbeddingModel || '';
  return { credentialId, model };
}

/** Prefer embedding-ranked spans as the SOURCE fed to LLM; fall back to full text. */
export async function prepareGroundedSource(opts: {
  projectId: string;
  sourceText: string;
  query: string;
  topK?: number;
  minScore?: number;
  citationId?: string;
}): Promise<{
  sourceText: string;
  ranked: RankedEvidenceSpan[];
  usedEmbeddings: boolean;
  cacheHit: boolean;
}> {
  const full = String(opts.sourceText || '');
  const config = await resolveProjectEmbeddingConfig(opts.projectId);
  if (!config?.credentialId || !full.trim()) {
    return { sourceText: full, ranked: [], usedEmbeddings: false, cacheHit: false };
  }
  try {
    const result = await rankEvidenceSpans({
      sourceText: full,
      query: opts.query,
      credentialId: config.credentialId,
      model: config.model || undefined,
      topK: opts.topK ?? 6,
      minScore: opts.minScore,
      citationId: opts.citationId,
    });
    if (!result.ranked.length) {
      return { sourceText: full, ranked: [], usedEmbeddings: true, cacheHit: result.cacheHit };
    }
    const clipped = result.ranked
      .map((row, i) => `[Span ${i + 1} | score=${row.score.toFixed(3)}]\n${row.text}`)
      .join('\n\n');
    return {
      sourceText: clipped,
      ranked: result.ranked,
      usedEmbeddings: true,
      cacheHit: result.cacheHit,
    };
  } catch {
    return { sourceText: full, ranked: [], usedEmbeddings: false, cacheHit: false };
  }
}

function parseScreeningJson(content: string): ScreeningLlmResult {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<ScreeningLlmResult>;
  const decision = parsed.decision;
  if (decision !== 'Include' && decision !== 'Exclude' && decision !== 'Uncertain') {
    throw new Error('Invalid decision in model response');
  }
  return {
    decision: decision as DecisionValue,
    criterionIds: Array.isArray(parsed.criterionIds) ? parsed.criterionIds.map(String) : [],
    evidenceSpans: Array.isArray(parsed.evidenceSpans) ? parsed.evidenceSpans.map(String) : [],
    uncertainty: String(parsed.uncertainty || ''),
    rationale: String(parsed.rationale || ''),
    confidence:
      parsed.confidence === 'High' || parsed.confidence === 'Moderate' || parsed.confidence === 'Low'
        ? parsed.confidence
        : 'Moderate',
  };
}

export function buildScreeningMessages(input: {
  question: string;
  criteria: Array<{ code: string; title: string; includeText: string; excludeText: string }>;
  title: string;
  authors: string;
  abstract: string;
}): ChatMessage[] {
  const criteriaText = input.criteria
    .map(
      (c) =>
        `- ${c.code} ${c.title}\n  Include: ${c.includeText}\n  Exclude: ${c.excludeText}`,
    )
    .join('\n');
  return [
    {
      role: 'system',
      content: `You are Qiuzheng screening assistant for systematic reviews.
Return ONLY valid JSON with keys: decision (Include|Exclude|Uncertain), criterionIds (string[]), evidenceSpans (string[] from the abstract), uncertainty (string), rationale (string), confidence (High|Moderate|Low).
Do not invent evidence. If evidence is insufficient, use Uncertain.
Prompt version: ${SCREEN_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Research question:
${input.question}

Eligibility criteria:
${criteriaText}

Citation:
Title: ${input.title}
Authors: ${input.authors}
Abstract: ${input.abstract}`,
    },
  ];
}

export function matchEvidenceInSource(source: string, quote: string): string {
  const trimmed = quote.trim();
  if (!trimmed || !source) return '';
  const index = source.toLocaleLowerCase().indexOf(trimmed.toLocaleLowerCase());
  return index < 0 ? '' : source.slice(index, index + trimmed.length);
}

export const EXTRACTION_PROMPT_VERSION = 'extract-1.0';
export const FULLTEXT_PROMPT_VERSION = 'fulltext-1.0';
export const ADJUDICATION_PROMPT_VERSION = 'adjudication-1.0';
export const ASSISTANT_CHAT_PROMPT_VERSION = 'assistant-chat-1.1';
export const CRITERION_LOCATE_PROMPT_VERSION = 'criterion-locate-1.0';

export function parseCriterionLocateJson(content: string): string[] {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const quotes = Array.isArray(parsed.evidenceQuotes)
    ? parsed.evidenceQuotes
    : Array.isArray(parsed.quotes)
      ? parsed.quotes
      : (parsed.quote ? [parsed.quote] : []);
  return quotes.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 8);
}

export function buildCriterionLocateMessages(input: {
  title: string;
  criterionCode: string;
  criterionTitle: string;
  includeText: string;
  excludeText: string;
  sourceText: string;
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You locate verbatim evidence for a systematic-review eligibility criterion.
Return ONLY valid JSON: {"evidenceQuotes":["..."]}.
Each quote MUST be an exact contiguous substring copied from SOURCE (no paraphrase).
Prefer 1-4 short quotes that best support checking the criterion.
If SOURCE has nothing relevant, return {"evidenceQuotes":[]}.
Prompt version: ${CRITERION_LOCATE_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Study: ${input.title}
Criterion ${input.criterionCode}: ${input.criterionTitle}
Include guidance: ${input.includeText || '(none)'}
Exclude guidance: ${input.excludeText || '(none)'}
SOURCE (embedding-ranked passages and/or full text):
${input.sourceText}`,
    },
  ];
}

export function buildExtractionMessages(input: {
  question: string;
  title: string;
  authors: string;
  sourceText: string;
  fields: Array<{ key: string; label: string; dataType: string; description: string; options: string[] }>;
}): ChatMessage[] {
  const fieldText = input.fields
    .map(
      (f) =>
        `- ${f.key} (${f.label}, ${f.dataType})${f.options.length ? ` options=[${f.options.join('|')}]` : ''}: ${f.description || 'n/a'}`,
    )
    .join('\n');
  return [
    {
      role: 'system',
      content: `You are Qiuzheng data extraction assistant.
Return ONLY valid JSON: { "fields": [ { "key": string, "value": string, "evidenceText": string, "confidence": "High"|"Moderate"|"Low" } ] }.
evidenceText must be an exact verbatim substring of SOURCE. If a field cannot be supported by SOURCE, omit it or use empty value with empty evidenceText.
Do not invent numbers or study details. Prompt version: ${EXTRACTION_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Research question:
${input.question}

Fields to extract:
${fieldText}

SOURCE
Title: ${input.title}
Authors: ${input.authors}
${input.sourceText}`,
    },
  ];
}

export function parseExtractionJson(content: string): Array<{
  key: string;
  value: string;
  evidenceText: string;
  confidence: 'High' | 'Moderate' | 'Low';
}> {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as { fields?: unknown };
  const rows = Array.isArray(parsed.fields) ? parsed.fields : [];
  return rows
    .map((row) => {
      const item = row as Record<string, unknown>;
      const confidence = String(item.confidence || 'Moderate');
      return {
        key: String(item.key || ''),
        value: String(item.value || ''),
        evidenceText: String(item.evidenceText || ''),
        confidence: (['High', 'Moderate', 'Low'].includes(confidence)
          ? confidence
          : 'Moderate') as 'High' | 'Moderate' | 'Low',
      };
    })
    .filter((row) => row.key);
}

export function buildFulltextMessages(input: {
  question: string;
  criteria: Array<{ code: string; title: string; includeText: string; excludeText: string }>;
  title: string;
  authors: string;
  sourceText: string;
}): ChatMessage[] {
  const criteriaText = input.criteria
    .map((c) => `- ${c.code} ${c.title}\n  Include: ${c.includeText}\n  Exclude: ${c.excludeText}`)
    .join('\n');
  return [
    {
      role: 'system',
      content: `You are Qiuzheng full-text eligibility assistant.
Return ONLY valid JSON with keys: decision (Include|Exclude|Uncertain), criterionIds (string[]), evidenceSpans (string[] exact quotes from SOURCE), uncertainty (string), rationale (string), confidence (High|Moderate|Low).
Check each criterion against SOURCE. Do not invent text. Prompt version: ${FULLTEXT_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Research question:
${input.question}

Eligibility criteria:
${criteriaText}

SOURCE
Title: ${input.title}
Authors: ${input.authors}
${input.sourceText}`,
    },
  ];
}

export function buildAdjudicationMessages(input: {
  question: string;
  title: string;
  abstract: string;
  human: { decision: string; rationale?: string | null; evidence?: string | null };
  ai: { decision: string; rationale?: string | null; evidence?: string | null };
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are Qiuzheng adjudication assistant.
Given a human-AI disagreement, suggest a final decision. Return ONLY valid JSON: { "decision": "Include"|"Exclude"|"Uncertain", "rationale": string, "evidenceSpans": string[], "confidence": "High"|"Moderate"|"Low" }.
evidenceSpans must be exact quotes from SOURCE when used. Do not write the final record yourself; this is a suggestion only.
Prompt version: ${ADJUDICATION_PROMPT_VERSION}`,
    },
    {
      role: 'user',
      content: `Research question:
${input.question}

Citation:
Title: ${input.title}
Abstract: ${input.abstract}

Human decision: ${input.human.decision}
Human rationale: ${input.human.rationale || ''}
Human evidence: ${input.human.evidence || ''}

AI decision: ${input.ai.decision}
AI rationale: ${input.ai.rationale || ''}
AI evidence: ${input.ai.evidence || ''}`,
    },
  ];
}

export function parseAdjudicationJson(content: string): {
  decision: DecisionValue;
  rationale: string;
  evidenceSpans: string[];
  confidence: 'High' | 'Moderate' | 'Low';
} {
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const decision = String(parsed.decision || '');
  if (decision !== 'Include' && decision !== 'Exclude' && decision !== 'Uncertain') {
    throw new Error('Invalid adjudication decision');
  }
  const confidence = String(parsed.confidence || 'Moderate');
  return {
    decision: decision as DecisionValue,
    rationale: String(parsed.rationale || ''),
    evidenceSpans: Array.isArray(parsed.evidenceSpans) ? parsed.evidenceSpans.map(String) : [],
    confidence: (['High', 'Moderate', 'Low'].includes(confidence)
      ? confidence
      : 'Moderate') as 'High' | 'Moderate' | 'Low',
  };
}

export async function buildAssistantContextBlock(input: {
  projectId?: string;
  module?: string;
  citationId?: string;
}): Promise<string> {
  if (!input.projectId) return 'No project context.';
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) return 'Project not found.';
  const protocol = await prisma.protocolVersion.findFirst({
    where: { projectId: input.projectId },
    orderBy: { version: 'desc' },
    include: { criteria: { orderBy: { sortOrder: 'asc' } } },
  });
  const citation = input.citationId
    ? await prisma.citation.findFirst({
        where: { id: input.citationId, projectId: input.projectId },
        include: { decisions: { orderBy: { createdAt: 'desc' }, take: 6 } },
      })
    : null;
  const criteria = (protocol?.criteria || [])
    .map((c) => `${c.code} ${c.title}`)
    .join('; ');
  const decisions = (citation?.decisions || [])
    .map((d) => `${d.actor}:${d.decision}`)
    .join(', ');
  const sourcePreview = citation ? citationAiSource(citation).slice(0, 2000) : '';
  const language = normalizeLlmResponseLanguage(project.llmResponseLanguage);
  return [
    `Module: ${input.module || 'unknown'}`,
    `Project: ${project.name}`,
    `Question: ${protocol?.question || project.question || ''}`,
    `Protocol version: ${protocol?.version ?? 'n/a'}`,
    `Criteria: ${criteria || 'none'}`,
    `Response language: ${language === 'zh' ? 'Simplified Chinese' : 'English'}`,
    citation
      ? `Focus citation: ${citation.title}\nAuthors: ${citation.authors}\nSource text: ${sourcePreview}\nRecent decisions: ${decisions || 'none'}`
      : 'Focus citation: none',
  ].join('\n');
}

export { parseScreeningJson, SCREEN_PROMPT_VERSION };
