import { AppError } from '../lib/errors.js';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TOOL = 'qiuzheng';
const EMAIL = 'qiuzheng@localhost';

export type MeshCandidate = {
  preferredTerm: string;
  meshUi: string;
  uid: string;
};

export type MeshResolveHit = {
  query: string;
  matched: boolean;
  preferredTerm?: string;
  meshUi?: string;
  candidates: MeshCandidate[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQuery(raw: string): string {
  return String(raw || '')
    .replace(/\s*\[?\s*MeSH\s*\]?\s*$/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function buildUrl(path: string, params: Record<string, string | number | undefined>, apiKey?: string) {
  const url = new URL(`${EUTILS}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('tool', TOOL);
  url.searchParams.set('email', EMAIL);
  if (apiKey?.trim()) url.searchParams.set('api_key', apiKey.trim());
  return url.toString();
}

async function eutilsJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new AppError(502, 'pubmed_error', `NCBI E-utilities failed (${response.status}): ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(502, 'pubmed_parse_error', 'NCBI E-utilities returned non-JSON');
  }
}

async function esearchMesh(term: string, apiKey?: string, retmax = 5): Promise<string[]> {
  const url = buildUrl(
    'esearch.fcgi',
    {
      db: 'mesh',
      term,
      retmax,
      retmode: 'json',
      sort: 'relevance',
    },
    apiKey,
  );
  const data = (await eutilsJson(url)) as {
    esearchresult?: { idlist?: string[]; ERROR?: string };
  };
  if (data.esearchresult?.ERROR) {
    throw new AppError(502, 'pubmed_error', String(data.esearchresult.ERROR));
  }
  return Array.isArray(data.esearchresult?.idlist) ? data.esearchresult!.idlist! : [];
}

async function esummaryMesh(ids: string[], apiKey?: string): Promise<MeshCandidate[]> {
  if (!ids.length) return [];
  const url = buildUrl(
    'esummary.fcgi',
    {
      db: 'mesh',
      id: ids.join(','),
      retmode: 'json',
    },
    apiKey,
  );
  const data = (await eutilsJson(url)) as {
    result?: Record<string, unknown> & { uids?: string[] };
  };
  const result = data.result || {};
  const uids = Array.isArray(result.uids) ? result.uids : ids;
  const out: MeshCandidate[] = [];
  for (const uid of uids) {
    const row = result[uid] as
      | {
          ds_meshterms?: string[];
          ds_meshui?: string;
          ds_recordtype?: string;
        }
      | undefined;
    if (!row || typeof row !== 'object') continue;
    if (row.ds_recordtype && row.ds_recordtype !== 'descriptor') continue;
    const preferredTerm = Array.isArray(row.ds_meshterms) ? String(row.ds_meshterms[0] || '').trim() : '';
    const meshUi = String(row.ds_meshui || '').trim();
    if (!preferredTerm) continue;
    out.push({ preferredTerm, meshUi, uid: String(uid) });
  }
  return out;
}

/** Resolve one free-text query against the official MeSH vocabulary. */
export async function resolveMeshQuery(query: string, apiKey?: string): Promise<MeshResolveHit> {
  const cleaned = normalizeQuery(query);
  if (!cleaned) {
    return { query: String(query || ''), matched: false, candidates: [] };
  }

  let ids = await esearchMesh(`"${cleaned}"[MeSH Terms]`, apiKey, 5);
  if (!ids.length) {
    await sleep(apiKey ? 120 : 350);
    ids = await esearchMesh(cleaned, apiKey, 5);
  }
  if (!ids.length) {
    return { query: cleaned, matched: false, candidates: [] };
  }

  await sleep(apiKey ? 120 : 350);
  const candidates = await esummaryMesh(ids, apiKey);
  const preferred = candidates[0];
  return {
    query: cleaned,
    matched: Boolean(preferred),
    preferredTerm: preferred?.preferredTerm,
    meshUi: preferred?.meshUi,
    candidates,
  };
}

export async function resolveMeshQueries(
  queries: string[],
  apiKey?: string,
): Promise<MeshResolveHit[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const q of queries) {
    const cleaned = normalizeQuery(q);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }

  const hits: MeshResolveHit[] = [];
  for (const query of unique) {
    hits.push(await resolveMeshQuery(query, apiKey));
    await sleep(apiKey ? 120 : 350);
  }
  return hits;
}

export function formatMeshLabel(preferredTerm: string): string {
  const term = String(preferredTerm || '').trim();
  if (!term) return '';
  return /\[MeSH\]/i.test(term) ? term : `${term} [MeSH]`;
}
