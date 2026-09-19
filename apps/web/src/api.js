const ACCESS_KEY = 'qiuzheng.accessToken';

/** External API prefix for nginx subpath (e.g. /qiuzheng-api). Empty uses same-origin /api via Vite proxy. */
const API_PREFIX = String(import.meta.env.VITE_API_PREFIX || '').replace(/\/$/, '');

function withApiPrefix(path) {
  if (!path.startsWith('/')) return path;
  return `${API_PREFIX}${path}`;
}

let accessToken = localStorage.getItem(ACCESS_KEY) || '';
let onSessionExpired = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token || '';
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  else localStorage.removeItem(ACCESS_KEY);
}

export function clearSession() {
  setAccessToken('');
}

/** Register a one-app handler to return the user to login when the session is gone. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = typeof handler === 'function' ? handler : null;
}

function notifySessionExpired(message) {
  try {
    onSessionExpired?.(message);
  } catch {
    /* ignore handler errors */
  }
}

async function refreshAccessToken() {
  const response = await fetch(withApiPrefix('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    clearSession();
    return null;
  }
  const data = await response.json();
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response = await fetch(withApiPrefix(path), {
    ...options,
    headers,
    credentials: 'include',
    body:
      options.body && !(options.body instanceof FormData) && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return api(path, { ...options, skipRefresh: true });
    }
    const message = '登录已过期，请重新登录';
    notifySessionExpired(message);
    const error = new Error(message);
    error.status = 401;
    error.code = 'session_expired';
    throw error;
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    let message = data?.error?.message || response.statusText || 'Request failed';
    if (response.status === 401 || /missing access token|invalid access token|missing refresh token/i.test(message)) {
      message = '登录已过期，请重新登录';
      if (!accessToken) notifySessionExpired(message);
    }
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.code;
    error.data = data;
    throw error;
  }
  return data;
}

export const AuthApi = {
  captcha: () => api('/api/auth/captcha'),
  register: (body) => api('/api/auth/register', { method: 'POST', body }),
  login: (body) => api('/api/auth/login', { method: 'POST', body }),
  logout: () => api('/api/auth/logout', { method: 'POST', body: {} }),
  me: () => api('/api/auth/me'),
};

export const ProjectApi = {
  list: () => api('/api/projects'),
  get: (id) => api(`/api/projects/${id}`),
  create: (body) => api('/api/projects', { method: 'POST', body }),
  update: (id, body) => api(`/api/projects/${id}`, { method: 'PATCH', body }),
  remove: (id, body) => api(`/api/projects/${id}`, { method: 'DELETE', body }),
  seedDemo: (id) => api(`/api/projects/${id}/seed-demo`, { method: 'POST', body: {} }),
};

export const TeamApi = {
  list: () => api('/api/teams'),
  create: (body) => api('/api/teams', { method: 'POST', body }),
};

export const ProtocolApi = {
  list: (projectId) => api(`/api/projects/${projectId}/protocols`),
  create: (projectId, body) => api(`/api/projects/${projectId}/protocols`, { method: 'POST', body }),
};

export const CitationApi = {
  list: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/api/projects/${projectId}/citations${qs ? `?${qs}` : ''}`);
  },
  listAll: async (projectId, params = {}) => {
    const pageSize = Math.min(Number(params.take || 500), 5000);
    const all = [];
    let skip = 0;
    let total = Infinity;
    while (skip < total) {
      const res = await CitationApi.list(projectId, { ...params, skip: String(skip), take: String(pageSize) });
      const rows = res.citations || [];
      total = Number(res.total ?? rows.length);
      all.push(...rows);
      if (!rows.length || all.length >= total) break;
      skip += pageSize;
    }
    return { citations: all, total: Number.isFinite(total) ? total : all.length, skip: 0, take: all.length };
  },
  importFile: (projectId, file, format, sourceLabel) => {
    const form = new FormData();
    form.append('file', file);
    form.append('format', format);
    form.append('sourceLabel', sourceLabel || format);
    return api(`/api/projects/${projectId}/imports`, { method: 'POST', body: form });
  },
  uploadFulltext: (projectId, citationId, file) => {
    const form = new FormData();
    form.append('file', file);
    return api(`/api/projects/${projectId}/citations/${citationId}/fulltext`, { method: 'POST', body: form });
  },
  deleteFulltext: (projectId, citationId, scope = 'all') =>
    api(`/api/projects/${projectId}/citations/${citationId}/fulltext?${new URLSearchParams({ scope })}`, {
      method: 'DELETE',
    }),
  rollback: (projectId, citationId, to) =>
    api(`/api/projects/${projectId}/citations/${citationId}/rollback`, {
      method: 'POST',
      body: { to },
    }),
  deletePreview: async (projectId, citationIds) => {
    const ids = [...new Set((citationIds || []).map(String).filter(Boolean))];
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
    const parts = [];
    for (const chunk of chunks) {
      parts.push(await api(`/api/projects/${projectId}/citations/delete-preview`, {
        method: 'POST',
        body: { citationIds: chunk },
      }));
    }
    const items = parts.flatMap((part) => part.items || []);
    const missingIds = parts.flatMap((part) => part.missingIds || []);
    return {
      items,
      missingIds,
      total: items.length,
      safeCount: items.filter((row) => !row.hasDownstream).length,
      riskyCount: items.filter((row) => row.hasDownstream).length,
    };
  },
  deleteMany: async (projectId, citationIds, confirmDownstream = false) => {
    const ids = [...new Set((citationIds || []).map(String).filter(Boolean))];
    const chunkSize = 2000;
    const chunks = [];
    for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));
    let deleted = 0;
    let filesRemoved = 0;
    let riskyCount = 0;
    let safeCount = 0;
    const items = [];
    for (const chunk of chunks) {
      const part = await api(`/api/projects/${projectId}/citations/delete`, {
        method: 'POST',
        body: { citationIds: chunk, confirmDownstream },
      });
      deleted += part.deleted || 0;
      filesRemoved += part.filesRemoved || 0;
      riskyCount += part.riskyCount || 0;
      safeCount += part.safeCount || 0;
      if (part.items?.length) items.push(...part.items);
    }
    return { deleted, filesRemoved, riskyCount, safeCount, items };
  },
  getPdfBlob: async (projectId, citationId) => {
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(
      withApiPrefix(`/api/projects/${projectId}/citations/${citationId}/fulltext/pdf`),
      {
        headers,
        credentials: 'include',
      },
    );
    if (!response.ok) {
      const message = (await response.json().catch(() => ({})))?.error?.message || response.statusText;
      throw new Error(message || 'PDF download failed');
    }
    return response.blob();
  },
};

export const ScreeningApi = {
  queue: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/api/projects/${projectId}/screening/queue${qs ? `?${qs}` : ''}`);
  },
  queueAll: async (projectId, params = {}) => {
    const pageSize = Math.min(Number(params.take || 500), 5000);
    const all = [];
    let skip = 0;
    let total = Infinity;
    while (skip < total) {
      const res = await ScreeningApi.queue(projectId, { ...params, skip: String(skip), take: String(pageSize) });
      const rows = res.citations || [];
      total = Number(res.total ?? rows.length);
      all.push(...rows);
      if (!rows.length || all.length >= total) break;
      skip += pageSize;
    }
    return { citations: all, total: Number.isFinite(total) ? total : all.length, skip: 0, take: all.length };
  },
  submitHuman: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/screening/${citationId}/human`, { method: 'POST', body }),
  submitFinal: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/screening/${citationId}/final`, { method: 'POST', body }),
  runAi: (projectId, citationId, body = {}) =>
    api(`/api/projects/${projectId}/screening/${citationId}/ai`, { method: 'POST', body }),
  batchAi: (projectId, body) =>
    api(`/api/projects/${projectId}/screening/batch-ai`, { method: 'POST', body }),
  fulltextAi: (projectId, citationId, body = {}) =>
    api(`/api/projects/${projectId}/screening/${citationId}/fulltext-ai`, { method: 'POST', body }),
  locateCriterion: (projectId, citationId, body = {}) =>
    api(`/api/projects/${projectId}/citations/${citationId}/criterion-locate`, { method: 'POST', body }),
  adjudicationSuggest: (projectId, citationId, body = {}) =>
    api(`/api/projects/${projectId}/screening/${citationId}/adjudication-suggest`, { method: 'POST', body }),
  exportDiff: (projectId) => api(`/api/projects/${projectId}/screening/diff/export`),
  importDiff: (projectId, body) =>
    api(`/api/projects/${projectId}/screening/diff/import`, { method: 'POST', body }),
};

export const ExtractionApi = {
  fields: (projectId) => api(`/api/projects/${projectId}/extraction/fields`),
  createField: (projectId, body) => api(`/api/projects/${projectId}/extraction/fields`, { method: 'POST', body }),
  updateField: (projectId, fieldId, body) => api(`/api/projects/${projectId}/extraction/fields/${fieldId}`, { method: 'PATCH', body }),
  removeField: (projectId, fieldId) => api(`/api/projects/${projectId}/extraction/fields/${fieldId}`, { method: 'DELETE' }),
  reorderFields: (projectId, fieldIds) =>
    api(`/api/projects/${projectId}/extraction/fields/reorder`, { method: 'PUT', body: { fieldIds } }),
  values: (projectId) => api(`/api/projects/${projectId}/extraction/values`),
  saveValue: (projectId, citationId, fieldId, body) =>
    api(`/api/projects/${projectId}/extraction/values/${citationId}/${fieldId}`, { method: 'PUT', body }),
  runAi: (projectId, citationId, body = {}) =>
    api(`/api/projects/${projectId}/extraction/${citationId}/ai`, { method: 'POST', body }),
  batchAi: (projectId, body) =>
    api(`/api/projects/${projectId}/extraction/batch-ai`, { method: 'POST', body }),
};

export const RiskOfBiasApi = {
  get: (projectId, citationId) => {
    const query = citationId ? `?${new URLSearchParams({ citationId })}` : '';
    return api(`/api/projects/${projectId}/risk-of-bias${query}`);
  },
  saveHuman: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/risk-of-bias/${citationId}/human`, { method: 'POST', body }),
  runAi: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/risk-of-bias/${citationId}/ai`, { method: 'POST', body }),
  findEvidence: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/risk-of-bias/${citationId}/evidence-find`, { method: 'POST', body }),
  rankEvidence: (projectId, citationId, body) =>
    api(`/api/projects/${projectId}/citations/${citationId}/evidence-rank`, { method: 'POST', body }),
};

export const MetaApi = {
  listAnalyses: (projectId) => api(`/api/projects/${projectId}/meta/analyses`),
  createAnalysis: (projectId, body) =>
    api(`/api/projects/${projectId}/meta/analyses`, { method: 'POST', body }),
  removeAnalysis: (projectId, analysisId) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}`, { method: 'DELETE' }),
  getAnalysis: (projectId, analysisId) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}`),
  saveRows: (projectId, analysisId, rows) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}/rows`, { method: 'PUT', body: { rows } }),
  mapExtraction: (projectId, analysisId, body = {}) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}/map-extraction`, { method: 'POST', body }),
  listTools: (projectId) => api(`/api/projects/${projectId}/meta/tools`),
  callTool: (projectId, toolName, body = {}) =>
    api(`/api/projects/${projectId}/meta/tools/${toolName}`, { method: 'POST', body }),
  validate: (projectId, analysisId) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}/validate`, { method: 'POST', body: {} }),
  run: (projectId, analysisId, body = {}) =>
    api(`/api/projects/${projectId}/meta/analyses/${analysisId}/run`, { method: 'POST', body }),
  getRun: (projectId, runId) => api(`/api/projects/${projectId}/meta/runs/${runId}`),
};

export const SynthesisApi = {
  knowledge: (projectId, queries = []) => {
    const qs = queries.length ? `?${new URLSearchParams({ queries: queries.join(',') })}` : '';
    return api(`/api/projects/${projectId}/synthesis/knowledge${qs}`);
  },
  listComposes: (projectId) => api(`/api/projects/${projectId}/synthesis/composes`),
  compose: (projectId, body) =>
    api(`/api/projects/${projectId}/synthesis/compose`, { method: 'POST', body }),
};

export const MeshApi = {
  resolve: (projectId, body) =>
    api(`/api/projects/${projectId}/mesh/resolve`, { method: 'POST', body }),
};

export const SearchStrategyApi = {
  get: (projectId) => api(`/api/projects/${projectId}/search-strategy`),
  save: (projectId, body) =>
    api(`/api/projects/${projectId}/search-strategy`, { method: 'PUT', body }),
};

export const AuditApi = {
  list: (projectId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api(`/api/projects/${projectId}/audit${qs ? `?${qs}` : ''}`);
  },
};

export const CredentialApi = {
  presets: () => api('/api/llm/presets'),
  list: () => api('/api/credentials'),
  create: (body) => api('/api/credentials', { method: 'POST', body }),
  update: (id, body) => api(`/api/credentials/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/credentials/${id}`, { method: 'DELETE' }),
  test: (id) => api(`/api/credentials/${id}/test`, { method: 'POST', body: {} }),
};

export const JobApi = {
  get: (id) => api(`/api/jobs/${id}`),
};

export const LlmApi = {
  chat: (body) => api('/api/llm/chat', { method: 'POST', body }),
};
