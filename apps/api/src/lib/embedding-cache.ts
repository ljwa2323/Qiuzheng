import { createHash } from 'node:crypto';
import { redisConnection } from './queue.js';

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_PREFIX = 'emb:v1';

export type CachedSpanVectors = {
  spans: string[];
  vectors: number[][];
  model: string;
};

export function hashSourceContent(sourceText: string): string {
  return createHash('sha256').update(String(sourceText || ''), 'utf8').digest('hex').slice(0, 32);
}

export function embeddingCacheKey(opts: {
  credentialId: string;
  model: string;
  citationId?: string;
  contentHash: string;
}): string {
  const scope = opts.citationId || 'anon';
  const modelKey = String(opts.model || 'default').replace(/[^a-zA-Z0-9._-]/g, '_');
  const material = `${scope}:${opts.contentHash}`;
  const digest = createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 40);
  return `${CACHE_PREFIX}:${opts.credentialId}:${modelKey}:${digest}`;
}

export async function getCachedSpanVectors(key: string): Promise<CachedSpanVectors | null> {
  try {
    const raw = await redisConnection().get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSpanVectors;
    if (!Array.isArray(parsed.spans) || !Array.isArray(parsed.vectors)) return null;
    if (parsed.spans.length !== parsed.vectors.length || !parsed.spans.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedSpanVectors(key: string, value: CachedSpanVectors): Promise<void> {
  try {
    await redisConnection().set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
  } catch {
    /* cache write is best-effort */
  }
}
