import { escapeHtml, matchesQuery, parseCitationFile, toCsv, highlightEvidenceHtml, findEvidenceNeedle } from './core.js';
import { modelSupportsThinking } from '@qiuzheng/shared';
import { buildAssistantPanel, assistantFocusId } from './assistant-panel.js';
import { createPages } from './pages.js';
import { buildModal } from './modals.js';
import {
  AuthApi,
  AuditApi,
  CitationApi,
  CredentialApi,
  ExtractionApi,
  JobApi,
  LlmApi,
  ProjectApi,
  ProtocolApi,
  RiskOfBiasApi,
  MetaApi,
  SynthesisApi,
  ScreeningApi,
  MeshApi,
  SearchStrategyApi,
  TeamApi,
  clearSession,
  getAccessToken,
  setAccessToken,
  setSessionExpiredHandler,
} from './src/api.js';

const UI_PREFS_KEY = 'qiuzheng.ui.prefs.v1';
const PROJECT_KEY = 'qiuzheng.activeProjectId';

const icon = (name, size = 18) => {
  const paths = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1.1-1.5 2"/><path d="M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/>',
    report: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H10v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    spark: '<path d="m12 3-1.1 3.3a4 4 0 0 1-2.6 2.6L5 10l3.3 1.1a4 4 0 0 1 2.6 2.6L12 17l1.1-3.3a4 4 0 0 1 2.6-2.6L19 10l-3.3-1.1a4 4 0 0 1-2.6-2.6L12 3Z"/><path d="m5 3 .5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    x: '<path d="m18 6-12 12M6 6l12 12"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    command: '<path d="M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    grip: '<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    brain: '<path d="M9.5 4A2.5 2.5 0 0 0 7 6.5v.4a3 3 0 0 0-2 4.8A3.2 3.2 0 0 0 7 17.5 2.5 2.5 0 0 0 12 17V7a3 3 0 0 0-2.5-3Z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 6.5v.4a3 3 0 0 1 2 4.8 3.2 3.2 0 0 1-2 5.8 2.5 2.5 0 0 1-5-.5V7a3 3 0 0 1 2.5-3Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
};

const modules = [
  { id: 'dashboard', label: '项目总览', icon: 'home' },
  { id: 'protocol', label: '研究问题与方案', icon: 'question' },
  { id: 'search', label: '检索策略', icon: 'search' },
  { id: 'library', label: '文献管理', icon: 'library' },
  { id: 'screening', label: '题目摘要初筛', icon: 'layers' },
  { id: 'adjudication', label: '冲突裁决', icon: 'users' },
  { id: 'fulltext', label: '全文筛选', icon: 'file' },
  { id: 'extraction', label: '数据提取', icon: 'table' },
  { id: 'rob', label: '偏倚风险', icon: 'shield' },
  { id: 'meta', label: 'Meta 分析', icon: 'chart' },
  { id: 'synthesis', label: '证据综合与报告', icon: 'report' },
  { id: 'audit', label: '审计记录', icon: 'history' },
];

let state;
let inputRenderTimer;

const emptyCriteria = [];
const defaultConcepts = [];

function freshState() {
  return {
    boot: 'loading',
    authMode: 'login',
    authError: '',
    captchaId: '',
    captchaImage: '',
    captchaLoading: false,
    user: null,
    teams: [],
    projects: [],
    projectId: localStorage.getItem(PROJECT_KEY) || '',
    credentials: [],
    llmPresets: {},
    screeningQueue: [],
    active: location.hash.slice(1) && modules.some(module => module.id === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard',
    aiTab: 'decision', aiOpen: true, sidebarOpen: true, screenMode: 'single', screeningIndex: 0,
    decision: null, db: 'PubMed', extractionView: 'data', extractionFocus: { citationId: '', fieldId: '' },
    modal: null, modalPayload: null, searchQuery: '', libraryQuery: '',
    librarySource: '全部来源', libraryFullText: '全部全文状态', auditQuery: '', auditActor: '全部操作者', auditModule: '全部模块',
    projectName: '未命名项目', projectDescription: '', question: '', llmResponseLanguage: 'zh',
    hasPubmedApiKey: false, pubmedApiKeyLast4: '',
    criteria: [], concepts: structuredClone(defaultConcepts),
    citations: [], citationsTotal: 0, audits: [], screeningDecisions: {}, screeningCompleted: 0, batchDecisions: {}, selectedBatch: [], selectedLibrary: [],
    adjudicationIndex: 0, fulltextIndex: 0, fulltextViewMode: 'auto', fulltextListView: 'auto', fulltextEvidenceQuery: '', fulltextEvidenceCriterionId: '', projectMembers: [], protocolVersion: null, protocolVersions: [],
    lastAiQuestion: '', lastAiAnswer: '', role: 'viewer', credentialId: '',
    embeddingCredentialId: '', embeddingModel: '', rankedEvidence: [],
    assistantBusy: false, assistantResult: null, adjudicationSuggestion: null,
    pendingProtocolSuggestion: null, pendingProtocolCriteria: null, pendingQuestionDraft: null, pendingSearchTerms: null, pendingSearchStrategy: null, searchConceptId: '',
    searchStrategyBasis: 'both', pendingMeshMap: null, searchStrategyDirty: false, searchStrategyUpdatedAt: null,
    pico: { p: '', i: '', c: '', o: '' },
    assistantJob: null, notificationsRead: true,
    extractionFields: [], extractionValues: [], robDomains: [], robCitations: [], robJudgements: [], robCitationId: '', robQuestionKey: 'D1.1', robEvidenceSpans: [], robPendingSelection: '', robBusy: false,
    metaAnalyses: [], metaAnalysisId: '', metaDetail: null, metaBusy: false, metaComputability: null,
    synthesisQueries: ['protocol', 'screening', 'extraction', 'rob', 'meta'],
    synthesisKnowledge: null, synthesisComposes: [], synthesisBusy: false, synthesisUseLlm: false,
  };
}

function loadUiPrefs() {
  try {
    return JSON.parse(localStorage.getItem(UI_PREFS_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function persistState() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      screenMode: state.screenMode,
      extractionView: state.extractionView,
      db: state.db,
      searchStrategyBasis: state.searchStrategyBasis,
    }));
    if (state.projectId) localStorage.setItem(PROJECT_KEY, state.projectId);
  } catch {
    return false;
  }
  return true;
}

function auditEvent(action, detail, module = titleMap[state.active] || 'System', version = 'Workspace v1') {
  const time = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date()).replaceAll('/', '-');
  state.audits.unshift({ actor: state.user?.name || '你', action, detail, time, version, module });
}

state = { ...freshState(), ...loadUiPrefs() };

const titleMap = Object.fromEntries(modules.map(m => [m.id, m.label]));

function mapCriteriaFromProtocol(version) {
  if (!version?.criteria?.length) return [];
  return version.criteria.map((c) => ({
    id: c.code,
    title: c.title,
    en: c.titleEn || '',
    include: String(c.includeText || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    exclude: String(c.excludeText || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
  }));
}

function mapPicoFromProtocol(version) {
  return {
    p: version?.picoP || '',
    i: version?.picoI || '',
    c: version?.picoC || '',
    o: version?.picoO || '',
  };
}

function picoPayload(pico = state.pico) {
  return {
    picoP: pico?.p || '',
    picoI: pico?.i || '',
    picoC: pico?.c || '',
    picoO: pico?.o || '',
  };
}

function criteriaApiPayload(list = state.criteria) {
  return (list || []).map((c, i) => ({
    code: c.id,
    title: c.title,
    titleEn: c.en || undefined,
    includeText: (c.include || []).join('\n'),
    excludeText: (c.exclude || []).join('\n'),
    sortOrder: i + 1,
  }));
}

function markSearchStrategyDirty() {
  state.searchStrategyDirty = true;
}

function normalizeLoadedConcepts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => ({
    id: String(item?.id || `concept-${index + 1}`),
    index: String(item?.index || `Concept ${index + 1}`),
    title: String(item?.title || `Concept ${index + 1}`),
    controlled: Array.isArray(item?.controlled) ? item.controlled.map(String).filter(Boolean) : [],
    free: Array.isArray(item?.free) ? item.free.map(String).filter(Boolean) : [],
  }));
}

async function loadSearchStrategy({ force = false } = {}) {
  if (!state.projectId) return;
  if (state.searchStrategyDirty && !force) return;
  try {
    const res = await SearchStrategyApi.get(state.projectId);
    const concepts = normalizeLoadedConcepts(res.strategy?.concepts);
    state.concepts = concepts;
    if (!concepts.some((c) => c.id === state.searchConceptId)) {
      state.searchConceptId = concepts[0]?.id || '';
    }
    state.searchStrategyUpdatedAt = res.strategy?.updatedAt || null;
    state.searchStrategyDirty = false;
  } catch (err) {
    if (force) toast(err.message || '加载检索策略失败');
  }
}

async function saveSearchStrategy() {
  if (!state.projectId) return;
  try {
    const payload = {
      concepts: state.concepts.map((item, index) => ({
        id: item.id || `concept-${index + 1}`,
        index: item.index || `Concept ${index + 1}`,
        title: item.title || `Concept ${index + 1}`,
        controlled: item.controlled || [],
        free: item.free || [],
      })),
    };
    const res = await SearchStrategyApi.save(state.projectId, payload);
    state.concepts = normalizeLoadedConcepts(res.strategy?.concepts);
    state.searchConceptId = state.concepts.some((c) => c.id === state.searchConceptId)
      ? state.searchConceptId
      : (state.concepts[0]?.id || '');
    state.searchStrategyUpdatedAt = res.strategy?.updatedAt || null;
    state.searchStrategyDirty = false;
    await AuditApi.list(state.projectId, { take: '100' })
      .then((auditRes) => { state.audits = mapAudits(auditRes.events || []); })
      .catch(() => null);
    app();
    toast('检索策略已保存到服务端');
  } catch (err) {
    toast(err.message || '检索策略保存失败');
  }
}

function hasAnyPico(pico = state.pico) {
  return Boolean(pico?.p || pico?.i || pico?.c || pico?.o);
}

function searchStrategyBasisOptions() {
  const hasQuestion = Boolean(state.question?.trim());
  const hasPico = hasAnyPico();
  return [
    { id: 'question', label: '研究问题', available: hasQuestion },
    { id: 'pico', label: 'PICO', available: hasPico },
    { id: 'both', label: '问题 + PICO', available: hasQuestion && hasPico },
  ];
}

function effectiveSearchStrategyBasis() {
  const options = searchStrategyBasisOptions();
  const preferred = state.searchStrategyBasis || 'both';
  if (options.some((item) => item.id === preferred && item.available)) return preferred;
  const fallback = options.find((item) => item.available);
  return fallback?.id || preferred;
}

function formatPicoForPrompt(pico = state.pico) {
  return [
    `P (Population): ${pico?.p || '(empty)'}`,
    `I (Intervention): ${pico?.i || '(empty)'}`,
    `C (Comparator): ${pico?.c || '(empty)'}`,
    `O (Outcome): ${pico?.o || '(empty)'}`,
  ].join('\n');
}

function buildSearchStrategyPrompt(basis = effectiveSearchStrategyBasis()) {
  const lines = ['You are a systematic review information specialist.'];
  if (basis === 'question' || basis === 'both') {
    lines.push('Research question: ' + String(state.question || '').trim());
  }
  if (basis === 'pico' || basis === 'both') {
    lines.push('PICO framework:');
    lines.push(formatPicoForPrompt());
  }
  if (basis === 'both') {
    lines.push('Use PICO as the primary concept skeleton. Use the research question only for scope, nuance, study design, or boundaries that PICO omitted. Do not create duplicate blocks for the same idea.');
  } else if (basis === 'pico') {
    lines.push('Build concept blocks from non-empty PICO elements only. Omit empty elements. Do not invent a comparator block if C is empty.');
  } else {
    lines.push('Derive concept blocks from the research question.');
  }
  lines.push(
    'Propose a Boolean search strategy as 3 to 4 concept blocks.',
    'Output ONLY plain text in this exact format (English terms preferred):',
    'CONCEPT: <short concept name>',
    'MESH: <candidate MeSH heading 1>; <candidate MeSH heading 2>',
    '- free-text synonym one',
    '- free-text synonym two',
    'CONCEPT: <next concept>',
    'MESH: <candidate>',
    '- term',
    'Rules:',
    '- MESH line lists candidate controlled vocabulary headings only (no [MeSH] suffix needed).',
    '- Free-text lines are synonyms/entry terms, not MeSH headings.',
    '- No numbering, no markdown fences, no extra commentary.',
  );
  return lines.join('\n');
}

function parsePicoDraft(text) {
  const result = { p: '', i: '', c: '', o: '' };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(P|I|C|O)\s*[:：]\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    result[key] = String(match[2] || '').trim();
  }
  return result;
}

function parseCriteriaDraft(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const codeMatch = line.match(/^(?:CODE|code|代码)\s*[:：]\s*(.+)$/i);
    if (codeMatch) {
      current = { id: codeMatch[1].trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'X', title: '', en: '', include: [], exclude: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const titleMatch = line.match(/^(?:TITLE|标题|title)\s*[:：]\s*(.+)$/i);
    if (titleMatch) { current.title = titleMatch[1].trim(); continue; }
    const includeMatch = line.match(/^(?:INCLUDE|纳入|include)\s*[:：]\s*(.*)$/i);
    if (includeMatch) {
      const value = includeMatch[1].trim();
      if (value) current.include.push(value);
      continue;
    }
    const excludeMatch = line.match(/^(?:EXCLUDE|排除|exclude)\s*[:：]\s*(.*)$/i);
    if (excludeMatch) {
      const value = excludeMatch[1].trim();
      if (value) current.exclude.push(value);
      continue;
    }
  }
  return blocks.filter((b) => b.title && (b.include.length || b.exclude.length));
}

function mapCitations(rows) {
  return (rows || []).map((c) => ({
    id: c.id,
    title: c.title,
    authors: `${c.authors || 'Unknown'}${c.year ? ` · ${c.year}` : ''}`,
    source: c.sources?.[0]?.databaseName || 'Import',
    hits: c.sources?.length || 1,
    fullText: c.fullTextStatus || 'Missing',
    hasPdf: Boolean(c.pdfFileId),
    hasMd: Boolean(c.mdFileId || String(c.fullTextMarkdown || '').trim()),
    fullTextMarkdown: c.fullTextMarkdown || '',
    completeness: c.completeness || 0,
    doi: c.doi || '',
    abstract: c.abstract || '',
    raw: c,
  }));
}

function mapAudits(rows) {
  return (rows || []).map((e) => ({
    actor: e.actorName,
    action: e.action,
    detail: e.detail,
    time: new Date(e.createdAt).toLocaleString('zh-CN', { hour12: false }),
    version: e.version || '',
    module: e.module,
  }));
}

function screeningConflicts() {
  const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
  return queue.map((item) => buildScreeningConflict(item)).filter(Boolean);
}

function buildScreeningConflict(item) {
  const human = latestActorDecision(item, 'human');
  const humanB = latestActorDecision(item, 'human_b');
  const ai = latestActorDecision(item, 'ai');
  const adj = latestAdjudicationFinal(item);
  if (!human || adj) return null;
  if (humanB && human.decision !== humanB.decision) {
    return {
      citation: item,
      kind: 'human_human_b',
      human,
      humanB,
      ai,
      left: human,
      right: humanB,
    };
  }
  if (!humanB && ai && human.decision !== ai.decision) {
    return {
      citation: item,
      kind: 'human_ai',
      human,
      humanB: null,
      ai,
      left: human,
      right: ai,
    };
  }
  return null;
}

function isFulltextFinalDecision(decision) {
  const rationale = String(decision?.rationale || '');
  return /\[fulltext\]/i.test(rationale) || /^Full-text eligibility/i.test(rationale);
}

function isAdjudicationFinalDecision(decision) {
  const rationale = String(decision?.rationale || '');
  return /\[adjudication\]/i.test(rationale) || /^Adjudication of/i.test(rationale);
}

function screeningDecisions(item) {
  return item?.raw?.decisions || [];
}

function latestActorDecision(item, actor) {
  const rows = screeningDecisions(item).filter((d) => d.actor === actor);
  return rows.length ? rows[rows.length - 1] : null;
}

function latestFulltextFinal(item) {
  const rows = screeningDecisions(item).filter((d) => d.actor === 'final' && isFulltextFinalDecision(d));
  return rows.length ? rows[rows.length - 1] : null;
}

function latestAdjudicationFinal(item) {
  const rows = screeningDecisions(item).filter((d) => d.actor === 'final' && isAdjudicationFinalDecision(d));
  return rows.length ? rows[rows.length - 1] : null;
}

/** Title/abstract stage Include (after adjudication if any). */
function titleAbstractIncluded(item) {
  const adj = latestAdjudicationFinal(item);
  if (adj) return adj.decision === 'Include';
  const human = latestActorDecision(item, 'human');
  const humanB = latestActorDecision(item, 'human_b');
  if (humanB) {
    if (!human || human.decision !== humanB.decision) return false;
    return human.decision === 'Include';
  }
  return human?.decision === 'Include';
}

/** Title/abstract Includes still awaiting full-text final decision. */
function includedForFulltext() {
  const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
  return queue.filter((item) => titleAbstractIncluded(item) && !latestFulltextFinal(item));
}

/** Studies with full-text final Include — eligible for extraction / RoB. */
function includedAfterFulltext() {
  const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
  return queue.filter((item) => latestFulltextFinal(item)?.decision === 'Include');
}

/** Studies that already have a full-text final decision (Include or Exclude). */
function decidedFulltext() {
  const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
  return queue.filter((item) => latestFulltextFinal(item));
}

function recomputeDerivedCounts() {
  const conflicts = screeningConflicts();
  state.adjudicationRemaining = conflicts.length;
  state.fulltextRemaining = includedForFulltext().filter((item) => item.fullText !== 'Full text' && !item.hasMd).length;
  if (!state.adjudicationIndex || state.adjudicationIndex >= conflicts.length) state.adjudicationIndex = 0;
}

function currentScreenCase() {
  const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
  const item = queue[state.screeningIndex % Math.max(queue.length, 1)];
  if (!item) {
    return {
      id: null,
      title: '暂无待筛选文献',
      authors: '',
      journal: '',
      abstract: '请先导入文献，或使用“重置演练数据”写入服务端样本。',
      ai: '',
      confidence: '',
      reason: '',
      criterion: '',
      evidence: '',
    };
  }
  const human = item.raw?.decisions?.find((d) => d.actor === 'human');
  const ai = item.raw?.decisions?.find((d) => d.actor === 'ai');
  return {
    id: item.id,
    title: item.title,
    authors: item.authors,
    journal: item.raw?.journal || item.source || '',
    abstract: item.abstract || item.raw?.abstract || '',
    ai: ai?.decision || '—',
    confidence: ai?.confidence || '—',
    reason: ai?.rationale || '',
    criterion: (ai?.criterionIds || []).join(' · '),
    evidence: ai?.evidence || '',
    humanDecision: human?.decision || null,
  };
}

function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function navigate(page) {
  if (!titleMap[page]) page = 'dashboard';
  state.active = page;
  if (window.matchMedia('(max-width: 740px)').matches) state.sidebarOpen = false;
  state.decision = null;
  state.modal = null;
  state.modalPayload = null;
  if (page !== 'fulltext') {
    state.fulltextEvidenceQuery = '';
    state.fulltextEvidenceCriterionId = '';
  }
  if (location.hash !== `#${page}`) history.pushState(null, '', `#${page}`);
  window.scrollTo(0, 0);
  app();
}

function moduleCount(id, fallback) {
  if (id === 'screening') return Math.max(0, (state.citations.length || 0) - (state.screeningCompleted || 0));
  if (id === 'fulltext') {
    const pending = includedForFulltext().length;
    return pending > 0 ? pending : decidedFulltext().length;
  }
  if (id === 'extraction' || id === 'rob') return includedAfterFulltext().length;
  if (id === 'adjudication') return state.adjudicationRemaining;
  if (id === 'library') return state.citations.length;
  return fallback ?? 0;
}

function searchableRecords() {
  const citations = state.citations.map(item => ({ type: '文献', title: item.title, meta: `${item.authors} · ${item.source}`, nav: 'library' }));
  const criteria = state.criteria.flatMap(item => [
    ...item.include.map((text, index) => ({ type: '纳入标准', title: `${item.id}${index + 1} · ${text}`, meta: item.title, nav: 'protocol' })),
    ...item.exclude.map((text, index) => ({ type: '排除标准', title: `${item.id}${item.include.length + index + 1} · ${text}`, meta: item.title, nav: 'protocol' })),
  ]);
  const audits = state.audits.map(item => ({ type: '审计记录', title: `${item.actor} · ${item.action}`, meta: item.detail, nav: 'audit' }));
  return [...citations, ...criteria, ...audits];
}

function sidebar() {
  return `<aside class="sidebar ${state.sidebarOpen ? 'open' : ''}">
    <div class="brand"><div class="brand-mark">证</div><div><div class="brand-name">求证</div><div class="brand-sub">Evidence Workspace</div></div></div>
    <button class="project-switcher" data-action="switch-project"><small>当前项目</small><strong><span>${escapeHtml(state.projectName)}</span><span>▾</span></strong></button>
    <div class="nav-section-label">工作流模块</div>
    <nav class="nav-list">${modules.slice(0,10).map(navItem).join('')}</nav>
    <div class="nav-section-label">项目管理</div>
    <nav class="nav-list">${modules.slice(10).map(navItem).join('')}<button class="nav-item" data-action="settings"><span class="nav-icon">${icon('settings')}</span><span>项目设置</span></button><button class="nav-item" data-action="logout"><span class="nav-icon">${icon('users')}</span><span>退出登录</span></button></nav>
    <div class="sidebar-footer"><div class="team-card"><div class="avatar">${escapeHtml((state.user?.name || '?').slice(0,2))}</div><div><strong>${escapeHtml(state.user?.name || '')}</strong><small>${escapeHtml(state.role || '')}</small></div></div></div>
  </aside>${state.sidebarOpen ? '<button class="sidebar-scrim" data-action="menu" aria-label="关闭导航"></button>' : ''}`;
}

function navItem(m) {
  const count = moduleCount(m.id, m.count);
  return `<button class="nav-item ${state.active === m.id ? 'active' : ''}" data-nav="${m.id}" ${state.active === m.id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(m.icon)}</span><span>${m.label}</span>${count ? `<span class="count">${count}</span>` : ''}</button>`;
}

function topbar() {
  return `<header class="topbar">
      <button class="icon-button mobile-menu" data-action="menu" aria-label="${state.sidebarOpen ? '收起导航' : '打开导航'}" aria-expanded="${state.sidebarOpen ? 'true' : 'false'}">${icon('menu')}</button>
      <div class="crumb"><small>${escapeHtml(state.projectName)} / 当前阶段</small><h1>${titleMap[state.active]}</h1></div>
    <div class="topbar-actions">
      <button class="search-trigger" data-action="global-search" type="button" title="搜索项目内容（⌘K）" aria-label="搜索项目内容">
        ${icon('search')}<span>搜索</span><kbd>⌘K</kbd>
      </button>
      <button class="icon-button notification-button" data-action="notification" aria-label="通知">${icon('bell')}${state.notificationsRead ? '' : '<span class="notification-dot"></span>'}</button>
      <button class="ghost-button" data-action="team">${icon('users')} 团队</button>
      <button class="primary-button" data-action="ai-toggle">${icon('spark')} AI 协作</button>
    </div>
  </header>`;
}

function renderLanding() {
  const art = `<svg viewBox="0 0 360 360" fill="none" aria-hidden="true">
    <circle cx="180" cy="180" r="118" stroke="rgba(156,214,204,0.22)" stroke-width="1"/>
    <circle cx="180" cy="180" r="78" stroke="rgba(156,214,204,0.28)" stroke-width="1"/>
    <path d="M96 210 L148 132 L214 168 L268 104" stroke="rgba(127,212,198,0.75)" stroke-width="1.4"/>
    <path d="M118 250 L180 188 L246 236" stroke="rgba(184,220,134,0.55)" stroke-width="1.2"/>
    <circle cx="96" cy="210" r="5" fill="#7fd4c6"/><circle cx="148" cy="132" r="5" fill="#b8dc86"/>
    <circle cx="214" cy="168" r="6" fill="#9cd6cc"/><circle cx="268" cy="104" r="5" fill="#7fd4c6"/>
    <circle cx="118" cy="250" r="4" fill="#9cd6cc"/><circle cx="180" cy="188" r="7" fill="#b8dc86"/>
    <circle cx="246" cy="236" r="4" fill="#7fd4c6"/><circle cx="180" cy="180" r="3" fill="#f3fffc"/>
  </svg>`;
  return `<div class="landing-page">
    <header class="landing-nav">
      <button type="button" class="landing-brand" data-action="show-landing"><span class="brand-mark">证</span><strong>求证</strong></button>
      <nav class="landing-nav-links" aria-label="落地页导航">
        <a href="#top">主页</a>
        <a href="#flow">综述流程</a>
        <button type="button" data-action="show-auth" data-auth-mode="login">登录</button>
        <button type="button" class="landing-nav-cta primary" data-action="show-auth" data-auth-mode="register">注册</button>
      </nav>
    </header>
    <section class="landing-hero" id="top">
      <div class="landing-hero-copy">
        <p class="landing-kicker">Evidence Workspace</p>
        <h1 class="landing-title">求证</h1>
        <p class="landing-subtitle">系统综述人机协作工作台</p>
        <p class="landing-lead">Intelligent Support for Evidence Synthesis — 把检索、筛选、提取、偏倚评估与 Meta 综合，收成一条可追踪的证据旅程。</p>
        <div class="landing-actions">
          <button type="button" class="primary-button" data-action="show-auth" data-auth-mode="login">登录后开始使用</button>
          <button type="button" class="ghost-button" data-action="landing-scroll-flow">了解综述流程</button>
        </div>
      </div>
      <div class="landing-hero-art">${art}</div>
    </section>
    <section class="landing-section" id="flow">
      <h2>从问题到证据综合</h2>
      <p>登录后进入项目工作区。每一步判断可审计、可回溯，AI 辅助但不替代人工决策。</p>
      <div class="landing-flow">
        <article><em>01</em><strong>方案与 PICO</strong><span>凝练研究问题与纳入排除标准</span></article>
        <article><em>02</em><strong>检索策略</strong><span>概念块、MeSH 与多库查询式</span></article>
        <article><em>03</em><strong>筛选裁决</strong><span>人机盲筛、冲突 Diff 与终裁</span></article>
        <article><em>04</em><strong>提取与 RoB</strong><span>字段提取与偏倚原文绑定</span></article>
        <article><em>05</em><strong>Meta 与综合</strong><span>统计配方、森林图与证据综合稿</span></article>
      </div>
    </section>
  </div>`;
}

function renderAuth() {
  const isRegister = state.authMode === 'register';
  return `<div class="auth-shell"><div class="auth-card">
    <button type="button" class="auth-back" data-action="show-landing">${icon('chevron')} 返回介绍页</button>
    <div class="brand-mark">证</div>
    <h1>${isRegister ? '创建账户' : '登录求证'}</h1>
    ${state.authError ? `<div class="form-error">${escapeHtml(state.authError)}</div>` : ''}
    <form class="form-grid" id="auth-form">
      ${isRegister ? `<div class="field full"><label for="auth-name">姓名</label><input id="auth-name" name="name" required /></div>` : ''}
      <div class="field full"><label for="auth-email">邮箱</label><input id="auth-email" name="email" type="email" required autocomplete="username" /></div>
      <div class="field full"><label for="auth-password">密码</label><input id="auth-password" name="password" type="password" minlength="8" required autocomplete="${isRegister ? 'new-password' : 'current-password'}" /></div>
      <div class="field full"><label for="auth-captcha">验证码</label><div class="captcha-row"><input id="auth-captcha" name="captchaCode" required maxlength="8" autocomplete="off" spellcheck="false" placeholder="输入图中字符" aria-label="验证码" /><input type="hidden" name="captchaId" value="${escapeHtml(state.captchaId || '')}" /><button type="button" class="captcha-image-button" data-action="refresh-captcha" title="点击刷新验证码" aria-label="刷新验证码">${state.captchaImage ? `<img src="${escapeHtml(state.captchaImage)}" alt="验证码" width="140" height="44" />` : `<span class="muted">${state.captchaLoading ? '加载中…' : '点击获取'}</span>`}</button></div></div>
      <div class="field full"><button class="primary-button" style="width:100%" type="submit">${isRegister ? '注册并进入' : '登录'}</button></div>
    </form>
    <button class="link-button" data-action="toggle-auth">${isRegister ? '已有账户？登录' : '没有账户？注册'}</button>
  </div></div>`;
}

function renderProjectPicker() {
  const canReturn = Boolean(state.projectId && state.projects.some((p) => p.id === state.projectId));
  const projectCards = state.projects.map((p) => `<button class="project-row" data-action="open-project" data-id="${p.id}" type="button"><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.team?.name || '')} · ${p._count?.citations || 0} 篇文献</small>${p.description ? `<small class="project-desc">${escapeHtml(p.description)}</small>` : ''}</button>`).join('')
    || '<div class="empty-state compact"><p>还没有项目，先在下方创建一个</p></div>';
  return `<div class="auth-shell"><div class="auth-card wide picker-card"><div class="brand-mark">证</div><h1>选择项目</h1><p class="muted">你好，${escapeHtml(state.user?.name || '')}</p>
    <section class="picker-section">
      <div class="picker-section-head"><strong>打开已有项目</strong><p class="muted">上下滑动浏览，点击进入工作区</p></div>
      <div class="project-list">${projectCards}</div>
    </section>
    <section class="picker-section">
      <div class="picker-section-head"><strong>新建项目</strong><p class="muted">填写名称后即可开始</p></div>
      <form class="form-grid" id="create-project-form">
        <div class="field full"><label for="new-project-name">项目名称</label><input id="new-project-name" name="name" required placeholder="项目名称" /></div>
        <div class="field full"><label for="new-project-description">项目说明</label><textarea id="new-project-description" name="description" rows="2" placeholder="可选"></textarea></div>
        <div class="field full"><button class="primary-button" type="submit">创建项目</button></div>
      </form>
    </section>
    ${canReturn ? '<div class="compose-actions picker-footer"><button class="ghost-button" data-action="return-project" type="button">返回项目</button></div>' : ''}
  </div></div>`;
}

/** Scroll containers that must survive full app() re-renders. */
const SCROLL_PRESERVE_SELECTORS = [
  'main.workspace',
  '.sidebar',
  '.ai-content',
  '.table-wrap',
  '.rob-question-list',
  '.pdf-viewer',
  '.screening-protocol-tips .panel-body',
  '.search-results',
  '.project-list',
  '.forest-wrap',
  '.synthesis-markdown',
  '.extract-trace-body',
  '.assistant-pre',
  '.code-box',
  '.modal-body',
  '.modal-backdrop',
  '.meta-analysis-list',
  '[data-scroll-preserve]',
];

function captureScrollPositions() {
  const nodes = {};
  for (const selector of SCROLL_PRESERVE_SELECTORS) {
    document.querySelectorAll(selector).forEach((el, index) => {
      if (!(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) return;
      nodes[`${selector}::${index}`] = {
        top: el.scrollTop,
        left: el.scrollLeft,
      };
    });
  }
  return {
    windowY: window.scrollY,
    windowX: window.scrollX,
    nodes,
  };
}

function restoreScrollPositions(positions) {
  if (!positions) return;
  const apply = () => {
    if (positions.windowY != null || positions.windowX != null) {
      window.scrollTo(positions.windowX || 0, positions.windowY || 0);
    }
    Object.entries(positions.nodes || {}).forEach(([key, value]) => {
      const splitAt = key.lastIndexOf('::');
      if (splitAt < 0 || !value) return;
      const selector = key.slice(0, splitAt);
      const index = Number(key.slice(splitAt + 2));
      const el = document.querySelectorAll(selector)[index];
      if (!el) return;
      el.scrollTop = value.top;
      el.scrollLeft = value.left || 0;
    });
  };
  apply();
  requestAnimationFrame(apply);
}

function app() {
  if (state.boot === 'loading') {
    document.getElementById('app').innerHTML = `<div class="auth-shell"><div class="auth-card"><p>正在加载…</p></div></div>`;
    return;
  }
  if (state.boot === 'landing') {
    document.getElementById('app').innerHTML = renderLanding();
    document.title = '求证 · 系统综述人机协作工作台';
    document.querySelectorAll('[data-action="show-landing"]').forEach((el) => {
      el.addEventListener('click', () => {
        state.boot = 'landing';
        state.authError = '';
        app();
      });
    });
    document.querySelectorAll('[data-action="show-auth"]').forEach((el) => {
      el.addEventListener('click', async () => {
        state.authMode = el.dataset.authMode === 'register' ? 'register' : 'login';
        state.authError = '';
        state.boot = 'auth';
        app();
        await refreshAuthCaptcha();
        if (state.boot === 'auth') app();
      });
    });
    document.querySelector('[data-action="landing-scroll-flow"]')?.addEventListener('click', () => {
      document.getElementById('flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }
  if (state.boot === 'auth') {
    document.getElementById('app').innerHTML = renderAuth();
    document.title = `${state.authMode === 'register' ? '注册' : '登录'} · 求证`;
    document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
    document.querySelector('[data-action="show-landing"]')?.addEventListener('click', () => {
      state.boot = 'landing';
      state.authError = '';
      app();
    });
    document.querySelector('[data-action="toggle-auth"]')?.addEventListener('click', async () => {
      state.authMode = state.authMode === 'login' ? 'register' : 'login';
      state.authError = '';
      await refreshAuthCaptcha();
      app();
    });
    document.querySelector('[data-action="refresh-captcha"]')?.addEventListener('click', async () => {
      await refreshAuthCaptcha();
      app();
      document.getElementById('auth-captcha')?.focus();
    });
    if (!state.captchaId && !state.captchaLoading) {
      refreshAuthCaptcha().then(() => {
        if (state.boot === 'auth') app();
      });
    }
    return;
  }
  if (state.boot === 'picker') {
    const scrollPositions = captureScrollPositions();
    document.getElementById('app').innerHTML = renderProjectPicker();
    document.title = '选择项目 · 求证';
    document.getElementById('create-project-form')?.addEventListener('submit', handleCreateProject);
    document.querySelectorAll('[data-action="open-project"]').forEach((el) => el.addEventListener('click', () => openProject(el.dataset.id)));
    document.querySelector('[data-action="return-project"]')?.addEventListener('click', () => {
      if (state.projectId && state.projects.some((p) => p.id === state.projectId)) {
        state.boot = 'workspace';
        app();
      }
    });
    restoreScrollPositions(scrollPositions);
    return;
  }
  const scrollPositions = captureScrollPositions();
  document.getElementById('app').innerHTML = `<div class="app-shell ${state.sidebarOpen ? 'nav-open' : ''} ${state.aiOpen ? 'ai-open' : ''}">${sidebar()}<main class="workspace">${topbar()}${renderPage()}</main>${aiPanel()}</div>${modal()}`;
  document.title = `${titleMap[state.active]} · 求证`;
  bindEvents();
  restoreScrollPositions(scrollPositions);
  requestAnimationFrame(() => {
    if (state.modal) document.querySelector('[autofocus]')?.focus();
    if (state.modal === 'extraction-value') {
      document.getElementById('extract-evidence-anchor')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (state.pendingScrollToEvidence) {
      state.pendingScrollToEvidence = false;
      const anchor = document.getElementById('fulltext-evidence-anchor')
        || document.getElementById('fulltext-text-panel');
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (state.pendingEvidenceToast) {
        toast(state.pendingEvidenceToast);
        state.pendingEvidenceToast = '';
      }
    }
  });
}

function header(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-header"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${subtitle}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
}

function renderPage() {
  const pages = {
    dashboard,
    protocol,
    search: searchPage,
    library,
    screening,
    fulltext,
    extraction,
    rob,
    meta,
    adjudication,
    synthesis,
    audit,
  };
  return `<section class="page">${(pages[state.active] || dashboard)()}</section>`;
}


function extractionValue(citationId, fieldId) {
  return state.extractionValues.find((item) => item.citationId === citationId && item.fieldId === fieldId);
}

function robQuestionContext() {
  const domain = state.robDomains.find((item) => item.questions.some((question) => question.key === state.robQuestionKey)) || state.robDomains[0];
  const question = domain?.questions.find((item) => item.key === state.robQuestionKey) || domain?.questions?.[0];
  return { domain, question };
}

function robJudgement(questionKey, actor) {
  return state.robJudgements.find((item) => item.questionKey === questionKey && item.actor === actor);
}

function sourceSentences(text) {
  return (String(text || '').match(/[^.!?。！？]+[.!?。！？]?/g) || []).map((sentence) => sentence.trim()).filter(Boolean);
}

const pagesApi = createPages({
  state: new Proxy({}, {
    get(_t, prop) { return state[prop]; },
    set(_t, prop, value) { state[prop] = value; return true; },
  }),
  icon,
  escapeHtml,
  header,
  titleMap,
  matchesQuery,
  currentScreenCase,
  includedForFulltext,
  includedAfterFulltext,
  decidedFulltext,
  latestFulltextFinal,
  screeningConflicts,
  recomputeDerivedCounts,
  moduleCount,
  robJudgement,
  robQuestionContext,
  sourceSentences,
  extractionValue,
});
const dashboard = (...args) => pagesApi.dashboard(...args);
const protocol = (...args) => pagesApi.protocol(...args);
const searchPage = (...args) => pagesApi.searchPage(...args);
const library = (...args) => pagesApi.library(...args);
const screening = (...args) => pagesApi.screening(...args);
const fulltext = (...args) => pagesApi.fulltext(...args);
const extraction = (...args) => pagesApi.extraction(...args);
const rob = (...args) => pagesApi.rob(...args);
const meta = (...args) => pagesApi.meta(...args);
const adjudication = (...args) => pagesApi.adjudication(...args);
const synthesis = (...args) => pagesApi.synthesis(...args);
const audit = (...args) => pagesApi.audit(...args);
const reviewer = (...args) => pagesApi.reviewer(...args);

function aiPanel() {
  return buildAssistantPanel({
    state,
    icon,
    escapeHtml,
    titleMap,
    currentScreenCase,
    includedForFulltext,
    screeningConflicts,
    robJudgement,
    recomputeDerivedCounts,
  });
}

function modal() {
  return buildModal({
    state: new Proxy({}, {
      get(_t, prop) { return state[prop]; },
      set(_t, prop, value) { state[prop] = value; return true; },
    }),
    icon,
    escapeHtml,
    searchableRecords,
    matchesQuery,
    extractionValue,
    highlightEvidenceHtml,
  });
}

function toast(message) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = icon('check');
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);
  root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function parseSearchStrategyDraft(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const conceptMatch = line.match(/^(?:CONCEPT|概念)\s*[:：]\s*(.+)$/i);
    if (conceptMatch) {
      current = { title: conceptMatch[1].trim(), controlled: [], meshCandidates: [], free: [] };
      blocks.push(current);
      continue;
    }
    if (!current) continue;
    const meshMatch = line.match(/^(?:MESH|MeSH|受控词)\s*[:：]\s*(.+)$/i);
    if (meshMatch) {
      const parts = meshMatch[1].split(/[;|,]/).map((t) => t.trim()).filter(Boolean);
      current.meshCandidates.push(...parts);
      continue;
    }
    const term = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (term) current.free.push(term);
  }
  return blocks.filter((b) => b.title && (b.free.length || b.meshCandidates.length));
}

async function constrainStrategyWithMesh(blocks) {
  const queries = [];
  for (const block of blocks || []) {
    for (const candidate of block.meshCandidates || []) queries.push(candidate);
    if (block.title) queries.push(block.title);
  }
  if (!queries.length) {
    return (blocks || []).map((b) => ({ ...b, controlled: [] }));
  }
  const res = await MeshApi.resolve(state.projectId, { queries });
  const byQuery = new Map();
  for (const hit of res.results || []) {
    byQuery.set(String(hit.query || '').toLowerCase(), hit);
  }
  let matched = 0;
  let attempted = 0;
  const next = (blocks || []).map((block) => {
    const labels = [];
    const seen = new Set();
    const tryAdd = (query) => {
      const cleaned = String(query || '').replace(/\s*\[?\s*MeSH\s*\]?\s*$/i, '').trim();
      if (!cleaned) return;
      attempted += 1;
      const hit = byQuery.get(cleaned.toLowerCase());
      if (!hit?.matched || !hit.label) return;
      const key = hit.label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      labels.push(hit.label);
      matched += 1;
    };
    for (const candidate of block.meshCandidates || []) tryAdd(candidate);
    if (!labels.length) tryAdd(block.title);
    return {
      title: block.title,
      free: block.free || [],
      controlled: labels.slice(0, 4),
    };
  });
  return { blocks: next, matched, attempted, usedApiKey: Boolean(res.usedApiKey) };
}

function meshQueriesForConcept(concept) {
  const queries = [];
  const seen = new Set();
  const push = (value) => {
    const cleaned = String(value || '')
      .replace(/\s*\[?\s*MeSH\s*\]?\s*$/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(cleaned);
  };
  push(concept?.title);
  for (const term of concept?.free || []) push(term);
  return queries.slice(0, 8);
}

function controlledLabelsFromMeshHits(queries, results) {
  const byQuery = new Map();
  for (const hit of results || []) {
    byQuery.set(String(hit.query || '').toLowerCase(), hit);
  }
  const labels = [];
  const seen = new Set();
  let matched = 0;
  let attempted = 0;
  for (const query of queries || []) {
    const cleaned = String(query || '').trim();
    if (!cleaned) continue;
    attempted += 1;
    const hit = byQuery.get(cleaned.toLowerCase());
    if (!hit?.matched || !hit.label) continue;
    const key = String(hit.label).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(hit.label);
    matched += 1;
  }
  return { controlled: labels.slice(0, 4), matched, attempted };
}

async function mapConceptsMeshFromFreeTerms(concepts) {
  const items = [];
  let matched = 0;
  let attempted = 0;
  let usedApiKey = false;
  for (const concept of concepts || []) {
    const queries = meshQueriesForConcept(concept);
    if (!queries.length) {
      items.push({
        conceptId: concept.id,
        title: concept.title || '',
        previous: [...(concept.controlled || [])],
        proposed: [],
      });
      continue;
    }
    const res = await MeshApi.resolve(state.projectId, { queries });
    usedApiKey = usedApiKey || Boolean(res.usedApiKey);
    const mapped = controlledLabelsFromMeshHits(queries, res.results || []);
    matched += mapped.matched;
    attempted += mapped.attempted;
    items.push({
      conceptId: concept.id,
      title: concept.title || '',
      previous: [...(concept.controlled || [])],
      proposed: mapped.controlled,
    });
  }
  return { items, matched, attempted, usedApiKey };
}

let assistantJobPollTimer = null;

function stopAssistantJobPoll() {
  if (assistantJobPollTimer) {
    clearTimeout(assistantJobPollTimer);
    assistantJobPollTimer = null;
  }
}

function assistantJobStatusLabel(status) {
  return ({ queued: '排队中', active: '进行中', completed: '已完成', failed: '失败', partial: '部分完成' })[status] || status;
}

function formatAssistantJobError(raw) {
  if (!raw) return '';
  const text = String(raw);
  if (/overloaded|503|Service Unavailable/i.test(text)) {
    return '模型服务暂时过载，请稍后重试';
  }
  if (/rate.?limit|429|too many requests/i.test(text)) {
    return '模型服务限流，请稍后重试';
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      if (parsed.message) {
        const code = parsed.code || parsed.type || '';
        if (/overloaded|unavailable/i.test(String(parsed.message)) || String(code) === '503') {
          return '模型服务暂时过载，请稍后重试';
        }
        return code ? `${parsed.message}（${code}）` : String(parsed.message);
      }
      if (parsed.error?.message) return String(parsed.error.message);
    }
  } catch {
    /* plain text */
  }
  const match = text.match(/"message"\s*:\s*"([^"]+)"/);
  if (match) {
    if (/overloaded|unavailable/i.test(match[1])) return '模型服务暂时过载，请稍后重试';
    return match[1];
  }
  return text.slice(0, 240);
}

function formatUserFacingError(err) {
  const raw = err?.message || err?.data?.error?.message || '';
  if (err?.code === 'session_expired' || /missing access token|invalid access token|missing refresh token|登录已过期/i.test(raw)) {
    return '登录已过期，请重新登录';
  }
  return formatAssistantJobError(raw) || String(raw || '请求失败');
}

function syncAssistantJobResult() {
  const job = state.assistantJob;
  if (!job) return;
  const kind = job.kind || 'screening';
  const kindLabel = kind === 'extraction' ? '批量数据提取' : '批量初筛 AI';
  const doneNoun = kind === 'extraction' ? '条文献提取' : '条 AI 初筛判断';
  const total = Math.max(0, Number(job.total) || 0);
  const done = Math.max(0, Number(job.done) || 0);
  const succeeded = Math.max(0, Number(job.succeeded) || 0);
  const failed = Math.max(0, Number(job.failed) || (job.failures?.length || 0));
  const remaining = Array.isArray(job.remaining) ? job.remaining : [];
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : (job.status === 'completed' ? 100 : 0);
  const displayStatus = job.status === 'completed' && failed > 0 ? 'partial' : job.status;
  let summary = `进度 ${done}/${total}（成功 ${succeeded}，失败 ${failed}）`;
  if (job.status === 'queued') summary = `已入队，共 ${total} 条，等待 worker 开始…`;
  if (job.status === 'active') summary = `正在处理：已完成 ${done}/${total}（成功 ${succeeded}，失败 ${failed}）`;
  if (job.status === 'completed' && failed === 0) summary = `已全部完成：${succeeded}/${total} ${doneNoun}`;
  if (job.status === 'completed' && failed > 0) {
    summary = `部分完成：成功 ${succeeded}，失败 ${failed}` + (remaining.length ? `，未跑 ${remaining.length}` : '') + '。可重试失败项或续跑剩余。';
  }
  if (job.status === 'failed') {
    const tip = formatAssistantJobError(job.error);
    summary = tip
      ? `任务失败：${tip}。已成功 ${succeeded}/${total}。可重试失败项或续跑剩余。`
      : `任务失败。已成功 ${succeeded}/${total}。可重试失败项或续跑剩余。`;
  }
  state.assistantResult = {
    title: kindLabel,
    badge: assistantJobStatusLabel(displayStatus),
    summary,
    progress: { done, total, percent, status: displayStatus, succeeded, failed },
    jobActions: {
      retryFailed: (job.failures || []).map((f) => f.citationId).filter(Boolean),
      resumeRemaining: remaining.filter(Boolean),
      canRetry: ['completed', 'failed'].includes(job.status) && ((job.failures || []).length > 0 || remaining.length > 0),
    },
  };
}

function patchAssistantPanelDom() {
  const current = document.querySelector('.ai-panel');
  if (!current || state.boot !== 'workspace') {
    app();
    return;
  }
  const scrollTop = current.querySelector('.ai-content')?.scrollTop ?? 0;
  const wrap = document.createElement('div');
  wrap.innerHTML = aiPanel();
  const next = wrap.firstElementChild;
  if (!next) {
    app();
    return;
  }
  current.replaceWith(next);
  const content = next.querySelector('.ai-content');
  if (content) content.scrollTop = scrollTop;
  next.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (event) => handleAction(el.dataset.action, event));
  });
  next.querySelector('[data-action="send"]')?.closest('.compose-box')?.querySelector('textarea')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAction('send', event);
    }
  });
}

function startAssistantJobPoll(jobId, total, kind = 'screening') {
  stopAssistantJobPoll();
  state.assistantJob = {
    id: jobId,
    kind,
    total: total || 0,
    done: 0,
    succeeded: 0,
    failed: 0,
    status: 'queued',
    error: null,
    failures: [],
    remaining: [],
  };
  syncAssistantJobResult();
  const tick = async () => {
    if (!state.assistantJob?.id || state.assistantJob.id !== jobId) return;
    try {
      const { job } = await JobApi.get(jobId);
      const result = (job && job.result) || {};
      const payload = (job && job.payload) || {};
      const nextTotal = Number(result.total) || (Array.isArray(payload.citationIds) ? payload.citationIds.length : 0) || state.assistantJob.total || 0;
      const nextDone = Number(result.done);
      const done = Number.isFinite(nextDone)
        ? nextDone
        : (Array.isArray(result.results) ? result.results.length : state.assistantJob.done || 0);
      const results = Array.isArray(result.results) ? result.results : [];
      const failures = Array.isArray(result.failures) ? result.failures : [];
      const remaining = Array.isArray(result.remaining)
        ? result.remaining
        : (Array.isArray(payload.citationIds)
          ? payload.citationIds.filter((id) => !results.some((r) => r.citationId === id) && !failures.some((f) => f.citationId === id))
          : []);
      const succeeded = Number.isFinite(Number(result.succeeded)) ? Number(result.succeeded) : results.length;
      const failedCount = Number.isFinite(Number(result.failed)) ? Number(result.failed) : failures.length;
      state.assistantJob = {
        id: jobId,
        kind: state.assistantJob.kind || kind,
        total: nextTotal,
        done,
        succeeded,
        failed: failedCount,
        status: job.status,
        error: job.errorMessage || (failures[0]?.error || null),
        failures,
        remaining,
      };
      syncAssistantJobResult();
      if (job.status === 'completed' || job.status === 'failed') {
        stopAssistantJobPoll();
        try { await refreshScreeningQueue(); } catch { /* ignore */ }
        try { await refreshExtractionData(); } catch { /* ignore */ }
        try { await refreshProjectData(); } catch { /* ignore */ }
        app();
        if (job.status === 'completed' && failedCount === 0) {
          toast(`批量 AI 完成：${succeeded}/${nextTotal}`);
        } else if (job.status === 'completed') {
          toast(`批量 AI 部分完成：成功 ${succeeded}，失败 ${failedCount}`);
        } else {
          toast(`批量 AI 中断：${formatAssistantJobError(job.errorMessage) || '可重试剩余条目'}`);
        }
        return;
      }
      // Avoid full-page re-render while polling so table checkboxes/selects stay untouched.
      patchAssistantPanelDom();
      assistantJobPollTimer = setTimeout(tick, 1500);
    } catch (err) {
      assistantJobPollTimer = setTimeout(tick, 2500);
    }
  };
  assistantJobPollTimer = setTimeout(tick, 800);
}

async function relaunchBatchAi(citationIds, modeLabel) {
  if (!state.credentialId) { toast('请先配置模型凭据'); return; }
  await refreshProjectData().catch(() => null);
  const known = new Set(state.citations.map((c) => String(c.id)));
  const ids = [...new Set((citationIds || []).map(String).filter((id) => known.has(id)))];
  const dropped = [...new Set((citationIds || []).map(String).filter(Boolean))].length - ids.length;
  if (!ids.length) {
    toast(dropped > 0
      ? '所选文献已失效（可能刚重置过演练数据），请刷新后重新勾选'
      : '没有可重试的文献');
    return;
  }
  if (state.assistantJob && !['completed', 'failed'].includes(state.assistantJob.status)) {
    toast('已有批量任务进行中，请稍候');
    return;
  }
  const kind = state.assistantJob?.kind || (state.active === 'extraction' ? 'extraction' : 'screening');
  state.selectedBatch = ids;
  const job = kind === 'extraction'
    ? await ExtractionApi.batchAi(state.projectId, {
      citationIds: ids,
      credentialId: state.credentialId,
    })
    : await ScreeningApi.batchAi(state.projectId, {
      citationIds: ids,
      credentialId: state.credentialId,
    });
  startAssistantJobPoll(job.jobId, ids.length, kind);
  state.aiOpen = true;
  app();
  toast(`${modeLabel}：已重新入队 ${ids.length} 条${dropped > 0 ? `（已跳过 ${dropped} 条失效 ID）` : ''}`);
}

function bindFieldManagerDrag() {
  const list = document.querySelector('.field-manager-list');
  if (!list) return;
  const rows = [...list.querySelectorAll('.field-manager-row[data-field-id]')];
  if (rows.length < 2) return;

  let dragId = '';
  const clearMarkers = () => {
    list.querySelectorAll('.drag-over, .drag-over-after').forEach((el) => {
      el.classList.remove('drag-over', 'drag-over-after');
      delete el.dataset.dropPos;
    });
  };

  rows.forEach((row) => {
    row.draggable = false;
    const handle = row.querySelector('[data-drag-handle]');
    if (handle) {
      handle.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        row.draggable = true;
        const release = () => {
          if (!dragId) row.draggable = false;
          window.removeEventListener('pointerup', release);
          window.removeEventListener('pointercancel', release);
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
      });
    }
    row.addEventListener('dragstart', (event) => {
      if (!row.draggable) {
        event.preventDefault();
        return;
      }
      dragId = row.dataset.fieldId || '';
      row.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      try { event.dataTransfer.setData('text/plain', dragId); } catch { /* ignore */ }
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      row.draggable = false;
      clearMarkers();
      dragId = '';
    });
    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const target = event.currentTarget;
      if (!dragId || target.dataset.fieldId === dragId) return;
      const rect = target.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      clearMarkers();
      target.classList.add(before ? 'drag-over' : 'drag-over-after');
      target.dataset.dropPos = before ? 'before' : 'after';
    });
    row.addEventListener('dragleave', (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        event.currentTarget.classList.remove('drag-over', 'drag-over-after');
        delete event.currentTarget.dataset.dropPos;
      }
    });
    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      const target = event.currentTarget;
      const dropPos = target.dataset.dropPos || 'before';
      clearMarkers();
      const fromId = dragId || event.dataTransfer.getData('text/plain');
      const toId = target.dataset.fieldId;
      row.draggable = false;
      if (!fromId || !toId || fromId === toId) return;

      const ordered = [...state.extractionFields]
        .sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      const fromIndex = ordered.findIndex((item) => item.id === fromId);
      if (fromIndex < 0) return;
      const [moved] = ordered.splice(fromIndex, 1);
      let insertIndex = ordered.findIndex((item) => item.id === toId);
      if (insertIndex < 0) return;
      if (dropPos === 'after') insertIndex += 1;
      ordered.splice(insertIndex, 0, moved);
      const fieldIds = ordered.map((item) => item.id);
      state.extractionFields = ordered.map((item, index) => ({ ...item, sortOrder: index * 10 }));
      app();
      try {
        const result = await ExtractionApi.reorderFields(state.projectId, fieldIds);
        if (result.fields) state.extractionFields = result.fields;
        toast('字段顺序已保存');
        app();
      } catch (err) {
        toast(err.message || '保存字段顺序失败');
        try { await refreshExtractionData(); } catch { /* ignore */ }
        app();
      }
    });
  });
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => navigate(el.dataset.nav)));
  document.querySelectorAll('[data-db]').forEach(el => el.addEventListener('click', () => { state.db = el.dataset.db; persistState(); app(); }));
  document.querySelectorAll('[data-search-basis]').forEach(el => el.addEventListener('click', () => {
    state.searchStrategyBasis = el.dataset.searchBasis;
    persistState();
    app();
  }));
  document.querySelectorAll('[data-select-concept]').forEach(el => el.addEventListener('click', (event) => {
    if (event.target.closest('[data-action]')) return;
    state.searchConceptId = el.dataset.selectConcept;
    app();
  }));
  document.querySelectorAll('[data-extraction-view]').forEach(el => el.addEventListener('click', () => { state.extractionView = el.dataset.extractionView; persistState(); app(); }));
  document.querySelectorAll('[data-fulltext-list-view]').forEach(el => el.addEventListener('click', () => {
    state.fulltextListView = el.dataset.fulltextListView;
    persistState();
    app();
  }));
  bindFieldManagerDrag();
  document.querySelectorAll('[data-screen-mode]').forEach(el => el.addEventListener('click', () => { state.screenMode = el.dataset.screenMode; persistState(); app(); }));
  document.querySelectorAll('[data-decision]').forEach(el => el.addEventListener('click', () => submitScreenDecision(el.dataset.decision)));
  document.querySelectorAll('[data-resolution]').forEach(el => el.addEventListener('click', async () => {
    if (state.adjudicationResolution) return;
    const conflicts = screeningConflicts();
    const current = conflicts[state.adjudicationIndex || 0];
    if (!current?.citation?.id) { toast('没有可裁决的冲突'); return; }
    const resolution = el.dataset.resolution;
    try {
      await ScreeningApi.submitFinal(state.projectId, current.citation.id, {
        decision: resolution,
        criterionIds: [],
        rationale: `[adjudication] ${current.kind === 'human_human_b' ? 'human' : 'human'}=${current.left.decision} vs ${current.kind === 'human_human_b' ? 'human_b' : 'ai'}=${current.right.decision}`,
        evidence: current.left.evidence || current.right.evidence || '',
      });
      state.adjudicationResolution = resolution;
      await refreshProjectData();
      app();
      toast('最终裁决已写入服务端：' + resolution);
      setTimeout(() => {
        state.adjudicationResolution = null;
        const nextConflicts = screeningConflicts();
        state.adjudicationIndex = nextConflicts.length ? Math.min(state.adjudicationIndex || 0, nextConflicts.length - 1) : 0;
        app();
      }, 800);
    } catch (err) {
      toast(err.message || '裁决保存失败');
    }
  }));
  document.querySelectorAll('[data-cell]').forEach(el => el.addEventListener('click', () => { state.aiOpen = true; app(); setTimeout(() => toast('Located evidence for ' + el.dataset.cell + ' (source ' + el.dataset.source + ')'), 50); }));
  document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', event => handleAction(el.dataset.action, event)));
  document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
    const mapping = { 'library-query':'libraryQuery', 'library-source':'librarySource', 'library-fulltext':'libraryFullText', 'audit-query':'auditQuery', 'audit-actor':'auditActor', 'audit-module':'auditModule' };
    state[mapping[el.dataset.filter]] = el.value;
    persistState();
    const selector = `[data-filter="${el.dataset.filter}"]`;
    const render = () => { app(); requestAnimationFrame(() => { const input = document.querySelector(selector); input?.focus(); if (input?.setSelectionRange) input.setSelectionRange(input.value.length,input.value.length); }); };
    if (el.tagName === 'INPUT') { clearTimeout(inputRenderTimer); inputRenderTimer=setTimeout(render,120); } else render();
  }));
  document.querySelectorAll('[data-batch-select]').forEach(el => el.addEventListener('change', () => {
    state.selectedBatch = el.checked ? [...new Set([...state.selectedBatch, el.dataset.batchSelect])] : state.selectedBatch.filter(id => id !== el.dataset.batchSelect);
    app();
  }));
  document.querySelector('[data-batch-all]')?.addEventListener('change', event => {
    const ids = (state.screeningQueue.length ? state.screeningQueue : state.citations).map((item) => String(item.id));
    state.selectedBatch = event.currentTarget.checked ? ids : [];
    app();
  });
  const batchAll = document.querySelector('[data-batch-all]');
  if (batchAll) batchAll.indeterminate = batchAll.dataset.indeterminate === 'true';
  document.querySelectorAll('[data-library-select]').forEach((el) => el.addEventListener('change', () => {
    const id = String(el.dataset.librarySelect || '');
    if (!id) return;
    state.selectedLibrary = el.checked
      ? [...new Set([...(state.selectedLibrary || []), id])]
      : (state.selectedLibrary || []).filter((item) => item !== id);
    app();
  }));
  document.querySelector('[data-library-all]')?.addEventListener('change', (event) => {
    const visibleIds = state.citations
      .filter((c) => matchesQuery([c.title, c.authors, c.doi, c.abstract], state.libraryQuery))
      .filter((c) => state.librarySource === '全部来源' || c.source === state.librarySource)
      .filter((c) => state.libraryFullText === '全部全文状态' || (state.libraryFullText === '已获取' ? c.fullText === 'Full text' : c.fullText !== 'Full text'))
      .map((c) => String(c.id));
    if (event.currentTarget.checked) {
      state.selectedLibrary = [...new Set([...(state.selectedLibrary || []), ...visibleIds])];
    } else {
      const hide = new Set(visibleIds);
      state.selectedLibrary = (state.selectedLibrary || []).filter((id) => !hide.has(id));
    }
    app();
  });
  const libraryAll = document.querySelector('[data-library-all]');
  if (libraryAll) libraryAll.indeterminate = libraryAll.dataset.indeterminate === 'true';
  document.querySelectorAll('[data-batch-decision]').forEach(el => {
    const stop = (event) => event.stopPropagation();
    el.addEventListener('click', stop);
    el.addEventListener('mousedown', stop);
    el.addEventListener('change', (event) => {
      event.stopPropagation();
      const id = String(el.dataset.batchDecision || '');
      if (!id) return;
      if (el.value) {
        state.batchDecisions[id] = el.value;
        if (!(state.selectedBatch || []).includes(id)) {
          state.selectedBatch = [...(state.selectedBatch || []), id];
        }
      } else {
        delete state.batchDecisions[id];
        state.selectedBatch = (state.selectedBatch || []).filter((item) => item !== id);
      }
      app();
    });
  });
  document.querySelector('[data-search-input]')?.addEventListener('input', event => {
    state.searchQuery = event.currentTarget.value;
    clearTimeout(inputRenderTimer);
    inputRenderTimer=setTimeout(() => { app(); requestAnimationFrame(() => { const input = document.querySelector('[data-search-input]'); input?.focus(); input?.setSelectionRange(input.value.length,input.value.length); }); },120);
  });
  document.getElementById('import-file')?.addEventListener('change', handleImportFile);
  document.getElementById('diff-import-file')?.addEventListener('change', handleDiffImportFile);
  document.getElementById('fulltext-file')?.addEventListener('change', handleFulltextFile);
  document.querySelector('[data-rob-citation]')?.addEventListener('change', (event) => refreshRobData(event.currentTarget.value).catch((err) => toast(err.message || '加载偏倚评价失败')));
  document.getElementById('modal-form')?.addEventListener('submit', event => { event.preventDefault(); saveModal(); });
  bindSettingsThinkingControls();
  bindPdfViewer();
  bindRobSelectionMenu();
  document.onkeydown = keyboardHandler;
}

function bindRobSelectionMenu() {
  const root = document.getElementById('rob-source-selectable');
  const menu = document.getElementById('rob-selection-menu');
  if (!root || !menu) return;
  const hide = () => {
    menu.hidden = true;
    state.robPendingSelection = '';
  };
  menu.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  root.addEventListener('mouseup', (event) => {
    const selection = window.getSelection();
    const text = String(selection?.toString() || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 4) {
      hide();
      return;
    }
    const anchor = selection?.anchorNode;
    if (!anchor || !root.contains(anchor.nodeType === 1 ? anchor : anchor.parentElement)) {
      hide();
      return;
    }
    state.robPendingSelection = text;
    const pad = 8;
    const x = Math.min(window.innerWidth - 140, Math.max(8, event.clientX + pad));
    const y = Math.min(window.innerHeight - 48, Math.max(8, event.clientY + pad));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.hidden = false;
  });
}

function bindSettingsThinkingControls() {
  const field = document.getElementById('thinking-field');
  const checkbox = document.getElementById('cred-thinking');
  const credSelect = document.querySelector('[data-settings-credential]');
  const modelInput = document.querySelector('[data-settings-model]');
  const providerSelect = document.querySelector('[data-settings-provider]');
  if (!field || !checkbox) return;

  const sync = () => {
    const selected = credSelect?.selectedOptions?.[0];
    const selectedModel = selected?.dataset?.model || '';
    const selectedProvider = selected?.dataset?.provider || '';
    const draftModel = modelInput?.value?.trim() || '';
    const draftProvider = providerSelect?.value || '';
    const supports = modelSupportsThinking(draftModel || selectedModel, draftProvider || selectedProvider)
      || modelSupportsThinking(selectedModel, selectedProvider);
    field.hidden = !supports;
    if (selected && selected.dataset.thinking != null && !draftModel) {
      checkbox.checked = selected.dataset.thinking === '1';
    }
  };

  credSelect?.addEventListener('change', sync);
  modelInput?.addEventListener('input', sync);
  providerSelect?.addEventListener('change', sync);
  sync();
}

function keyboardHandler(e) {
  const editing = e.target instanceof HTMLElement && (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable);
  if (!editing && !state.modal && !state.decision && state.active === 'screening' && state.screenMode === 'single' && ['1','2','3'].includes(e.key)) {
    submitScreenDecision({'1':'Include','2':'Exclude','3':'Uncertain'}[e.key]);
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); state.modal='search'; app(); }
  if (e.key === 'Escape') {
    if (state.modal) { state.modal = null; state.modalPayload = null; app(); }
    else if (state.aiOpen || state.sidebarOpen) { state.aiOpen = false; state.sidebarOpen = false; app(); }
  }
}

async function submitScreenDecision(decision) {
  if (state.decision) return;
  const index = state.screeningIndex;
  const item = currentScreenCase();
  if (!item.id) {
    toast('没有可筛选的文献');
    return;
  }
  try {
    await ScreeningApi.submitHuman(state.projectId, item.id, { decision, criterionIds: [] });
    let aiDecision = item.ai;
    if (state.credentialId) {
      try {
        const ai = await ScreeningApi.runAi(state.projectId, item.id, { credentialId: state.credentialId });
        aiDecision = ai.decision?.decision || ai.result?.decision || item.ai;
      } catch (err) {
        toast('人工已保存；AI 调用失败：' + (err.message || ''));
      }
    }
    await refreshScreeningQueue();
    state.decision = decision;
    state.aiOpen = true;
    state.screeningDecisions[item.id] = decision;
    auditEvent('初筛记录为 ' + decision, '人工判断；AI=' + aiDecision, 'Screening', 'Protocol');
    app();
    const revealed = currentScreenCase();
    toast(decision === (revealed.ai || aiDecision) ? '已提交，与 AI 判断一致；请核对下方理由' : '已提交，请核对下方 AI 理由与证据');
    setTimeout(async () => {
      if (state.active !== 'screening' || state.screenMode !== 'single') return;
      await refreshScreeningQueue();
      state.screeningIndex = (index + 1) % Math.max(state.screeningQueue.length || state.citations.length || 1, 1);
      state.decision = null;
      persistState();
      app();
    }, 4500);
  } catch (err) {
    toast(err.message || '提交失败');
  }
}

async function handleImportFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const form = document.getElementById('modal-form');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const format = ({ ris:'RIS', bib:'BibTeX', bibtex:'BibTeX', csv:'CSV', xml:'PubMed XML', nbib:'PubMed NBIB' })[extension] || form.elements.format.value;
  const source = form.elements.source.value.trim() || (extension === 'nbib' ? 'PubMed' : file.name);
  // Keep File in memory: re-rendering the modal recreates the input and clears files.
  const payload = { fileName: file.name, source, format, file, citations: null, error: '' };
  try {
    const citations = parseCitationFile(await file.text(), format, source);
    if (!citations.length) {
      payload.error = '本地预览未识别到文献记录；仍可上传，由服务端解析。';
    } else {
      payload.citations = citations;
    }
  } catch (error) {
    payload.error = `${error.message || '本地预览失败'}；仍可上传，由服务端解析。`;
  }
  state.modalPayload = payload;
  if (form?.elements?.format) form.elements.format.value = format;
  if (form?.elements?.source && !form.elements.source.value.trim()) form.elements.source.value = source;
  app();
}

async function handleDiffImportFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  const payload = { ...(state.modalPayload || {}), fileName: file.name, file, error: '', result: null, parsed: null };
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.decisions)) {
      throw new Error('JSON 需包含 decisions 数组');
    }
    payload.parsed = parsed;
  } catch (error) {
    payload.error = error.message || '无法解析 Diff JSON';
  }
  state.modalPayload = payload;
  app();
}

async function handleFulltextFile(event) {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  // Keep File in memory across modal re-renders.
  state.modalPayload = { ...(state.modalPayload || {}), fileName: file.name, file, error: '' };
  app();
}

function bindPdfViewer() {
  const frame = document.querySelector('[data-pdf-frame]');
  if (!frame || !state.projectId) return;
  const included = includedForFulltext();
  const citation = included[state.fulltextIndex || 0] || included[0];
  if (!citation?.hasPdf) return;
  CitationApi.getPdfBlob(state.projectId, citation.id)
    .then((blob) => {
      if (frame.dataset.blobUrl) URL.revokeObjectURL(frame.dataset.blobUrl);
      const url = URL.createObjectURL(blob);
      frame.dataset.blobUrl = url;
      frame.src = url;
    })
    .catch((err) => toast(err.message || 'PDF 加载失败'));
}

async function saveModal() {
  const form = document.getElementById('modal-form');
  if (!form?.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form));
  const modalType = state.modal;
  if (modalType === 'criterion') {
    const id = data.id.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{0,3}$/.test(id)) { toast('标准 ID 需以字母开头，最多 4 位'); return; }
    const duplicate = state.criteria.some(item => item.id === id && item.id !== state.modalPayload?.id);
    if (duplicate) { toast('标准 ID 已存在'); return; }
    const item = { id, title: data.title.trim(), en: data.en.trim(), include: data.include.split(/\r?\n/).map(value=>value.trim()).filter(Boolean), exclude: data.exclude.split(/\r?\n/).map(value=>value.trim()).filter(Boolean) };
    const nextCriteria = [...state.criteria];
    const index = nextCriteria.findIndex(entry => entry.id === state.modalPayload?.id);
    if (index >= 0) nextCriteria[index] = item; else nextCriteria.push(item);
    try {
      await ProtocolApi.create(state.projectId, {
        question: state.question,
        notes: data.reason.trim() || 'Updated eligibility criteria',
        ...picoPayload(),
        criteria: criteriaApiPayload(nextCriteria),
      });
      await refreshProjectData();
      state.modal = null; state.modalPayload = null; app();
      toast(index >= 0 ? '方案标准已更新并保存' : '方案标准已添加并保存');
    } catch (err) { toast(err.message || '方案保存失败'); }
    return;
  } else if (modalType === 'question') {
    try {
      await ProtocolApi.create(state.projectId, {
        question: data.question.trim(),
        notes: data.reason.trim() || 'Updated research question',
        ...picoPayload(),
        criteria: criteriaApiPayload(state.criteria),
      });
      await refreshProjectData();
      state.modal = null; state.modalPayload = null; app();
      toast('研究问题已保存到服务端');
    } catch (err) { toast(err.message || '研究问题保存失败'); }
    return;
  } else if (modalType === 'pico') {
    try {
      const pico = {
        p: String(data.picoP || '').trim(),
        i: String(data.picoI || '').trim(),
        c: String(data.picoC || '').trim(),
        o: String(data.picoO || '').trim(),
      };
      await ProtocolApi.create(state.projectId, {
        question: state.question,
        notes: data.reason.trim() || 'Updated PICO manually',
        ...picoPayload(pico),
        criteria: criteriaApiPayload(state.criteria),
      });
      await refreshProjectData();
      state.modal = null; state.modalPayload = null; app();
      toast('PICO 已更新并保存');
    } catch (err) { toast(err.message || 'PICO 保存失败'); }
    return;
  } else if (modalType === 'concept') {
    const number = state.concepts.length + 1;
    state.concepts.push({ id: `concept-${Date.now()}`, index: `Concept ${number}`, title: data.title.trim(), controlled: [], free: [] });
    state.searchConceptId = state.concepts[state.concepts.length - 1].id;
    markSearchStrategyDirty();
    auditEvent('添加检索概念 ' + data.title.trim(), '检索概念图已更新。', 'Search', 'Search draft');
  } else if (modalType === 'term') {
    const concept = state.concepts.find(item => item.id === state.modalPayload?.id);
    if (concept && !concept.free.some(term => term.toLowerCase() === data.value.trim().toLowerCase())) concept.free.push(data.value.trim());
    markSearchStrategyDirty();
    auditEvent('添加检索词 ' + data.value.trim(), '已加入 ' + (concept?.title || '检索策略') + '。', 'Search', 'Search draft');
  } else if (modalType === 'import') {
    const fileInput = document.getElementById('import-file');
    const file = state.modalPayload?.file || fileInput?.files?.[0];
    if (!file) { toast('请选择文件'); return; }
    const format = data.format || state.modalPayload?.format || 'CSV';
    const source = data.source.trim() || state.modalPayload?.source || file.name;
    try {
      await CitationApi.importFile(state.projectId, file, format, source);
      toast('已上传，正在服务端解析');
      state.modal = null;
      state.modalPayload = null;
      await refreshProjectData();
      app();
    } catch (err) {
      state.modalPayload = {
        ...(state.modalPayload || {}),
        file,
        fileName: file.name,
        format,
        source,
        error: err.message || '导入失败',
      };
      app();
      toast(err.message || '导入失败');
    }
    return;
  } else if (modalType === 'import-screening-diff') {
    const parsed = state.modalPayload?.parsed;
    if (!parsed?.decisions?.length) {
      toast(state.modalPayload?.error || '请先选择有效的 Diff JSON');
      return;
    }
    try {
      const result = await ScreeningApi.importDiff(state.projectId, parsed);
      state.modalPayload = { ...(state.modalPayload || {}), result, error: '' };
      await refreshProjectData();
      app();
      toast(`已写入 ${result.written || 0} 条 · 冲突 ${result.conflicts || 0}`);
      if (result.conflicts > 0) {
        setTimeout(() => {
          state.modal = null;
          state.modalPayload = null;
          state.active = 'adjudication';
          location.hash = 'adjudication';
          app();
        }, 600);
      }
    } catch (err) {
      state.modalPayload = { ...(state.modalPayload || {}), error: err.message || '导入失败' };
      app();
      toast(err.message || 'Diff 导入失败');
    }
    return;
  } else if (modalType === 'upload-fulltext') {
    const fileInput = document.getElementById('fulltext-file');
    const file = state.modalPayload?.file || fileInput?.files?.[0];
    const citationId = state.modalPayload?.citationId;
    if (!citationId) { toast('未指定文献'); return; }
    if (!file) { toast('请选择 PDF 或 Markdown 文件'); return; }
    try {
      const result = await CitationApi.uploadFulltext(state.projectId, citationId, file);
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      if (isPdf && result.conversion?.ok) toast('PDF 已上传，并自动生成 Markdown');
      else if (isPdf) toast(result.conversion?.note || 'PDF 已上传；未能自动生成可用 Markdown');
      else toast('Markdown 全文已上传');
      state.modal = null;
      state.modalPayload = null;
      await refreshProjectData();
      app();
    } catch (err) {
      state.modalPayload = { ...(state.modalPayload || {}), file, fileName: file.name, error: err.message || '上传失败' };
      app();
      toast(err.message || '上传失败');
    }
    return;
  } else if (modalType === 'delete-fulltext') {
    const citationId = state.modalPayload?.citationId;
    if (!citationId) { toast('未指定文献'); return; }
    try {
      await CitationApi.deleteFulltext(state.projectId, citationId, 'all');
      state.modal = null;
      state.modalPayload = null;
      state.fulltextEvidenceQuery = '';
      state.fulltextViewMode = 'auto';
      await refreshProjectData();
      app();
      toast('全文已删除');
    } catch (err) {
      toast(err.message || '删除全文失败');
    }
    return;
  } else if (modalType === 'delete-citations') {
    const citationIds = state.modalPayload?.citationIds || [];
    if (!citationIds.length) { toast('未选择文献'); return; }
    try {
      const result = await CitationApi.deleteMany(
        state.projectId,
        citationIds,
        Boolean(state.modalPayload?.confirmDownstream),
      );
      state.modal = null;
      state.modalPayload = null;
      state.selectedLibrary = [];
      await refreshProjectData();
      app();
      toast(`已删除 ${result.deleted} 条文献`
        + (result.riskyCount ? `（含 ${result.riskyCount} 条有下游数据）` : ''));
    } catch (err) {
      toast(err.message || '删除文献失败');
    }
    return;
  } else if (modalType === 'extraction-field') {
    const editingField = Boolean(state.modalPayload?.fieldId);
    const body = {
      label: data.label.trim(),
      key: data.key.trim().toLowerCase(),
      dataType: data.dataType,
      description: data.description.trim(),
      options: data.options.split(/\r?\n/).map((value)=>value.trim()).filter(Boolean),
      required: data.required === 'on',
    };
    try {
      if (editingField) await ExtractionApi.updateField(state.projectId, state.modalPayload.fieldId, body);
      else await ExtractionApi.createField(state.projectId, body);
      await refreshExtractionData();
      state.modal = null; state.modalPayload = null; state.extractionView = 'fields'; persistState(); app();
      toast(editingField ? '字段已更新并保存' : '字段已创建并保存');
    } catch (err) { toast(err.message || '字段保存失败'); }
    return;
  } else if (modalType === 'extraction-value') {
    try {
      await ExtractionApi.saveValue(state.projectId, state.modalPayload.citationId, state.modalPayload.fieldId, {
        value: data.value || '',
        evidenceText: data.evidenceText?.trim() || undefined,
        sourceLocation: data.sourceLocation?.trim() || undefined,
        confidence: data.confidence || undefined,
        verified: data.verified === 'on',
      });
      await refreshExtractionData();
      state.modal = null; state.modalPayload = null; app(); toast('提取值和原文证据已保存');
    } catch (err) { toast(err.message || '提取值保存失败'); }
    return;
  } else if (modalType === 'delete-extraction-field') {
    try {
      const result = await ExtractionApi.removeField(state.projectId, state.modalPayload.fieldId);
      await refreshExtractionData();
      state.modal = null; state.modalPayload = null; app();
      const deletedValues = Number(result?.deletedValues || 0);
      toast(deletedValues
        ? `字段已删除（同时清除 ${deletedValues} 条提取值）`
        : '字段已删除');
    } catch (err) { toast(err.message || '字段删除失败'); }
    return;
  } else if (modalType === 'settings') {
    saveSettings(data);
    return;
  } else if (modalType === 'delete-project') {
    const step = Number(state.modalPayload?.step || 1);
    if (step <= 1) {
      state.modalPayload = { step: 2 };
      app();
      return;
    }
    const confirmName = String(data.confirmName || '').trim();
    const understood = data.understood === 'on';
    if (!understood) { toast('请勾选确认项'); return; }
    if (confirmName !== String(state.projectName || '').trim()) {
      toast('项目名称不一致，请重新输入');
      return;
    }
    try {
      const deletedId = state.projectId;
      await ProjectApi.remove(deletedId, { confirmName });
      state.modal = null;
      state.modalPayload = null;
      state.projects = (state.projects || []).filter((p) => p.id !== deletedId);
      const next = state.projects[0];
      if (next) {
        await openProject(next.id);
        toast(`项目已删除，已切换到「${next.name}」`);
      } else {
        state.projectId = '';
        persistState();
        state.boot = 'picker';
        app();
        toast('项目已删除');
      }
    } catch (err) {
      toast(err.message || '删除项目失败');
    }
    return;
  } else if (modalType === 'exclusion') {
    const reason = String(data.reason || '').trim() || '未填写排除原因';
    state.fulltextDecision = `Exclude · ${reason}`;
    state.modal = null;
    state.modalPayload = null;
    persistState();
    app();
    await submitFulltextDecision();
    return;
  }
  state.modal = null;
  state.modalPayload = null;
  persistState();
  app();
  toast(modalType === 'import' ? '文献已导入并完成去重' : '修改已保存，并创建新的审计记录');
}

async function runAssistantAction(action) {
  const citationId = assistantFocusId(state, { currentScreenCase, includedForFulltext, screeningConflicts });
  const needCred = () => {
    if (!state.credentialId) { toast('请先配置模型凭据'); return false; }
    return true;
  };
  const setBusy = (v) => { state.assistantBusy = v; app(); };

  try {
    if (action === 'assistant-clear-suggestion') {
      state.pendingProtocolSuggestion = null;
      state.pendingProtocolCriteria = null;
      state.pendingQuestionDraft = null;
      state.pendingSearchTerms = null;
      state.pendingSearchStrategy = null;
      state.pendingMeshMap = null;
      state.assistantResult = null;
      app();
      return;
    }
    if (action === 'assistant-apply-question-draft') {
      const draft = String(state.pendingQuestionDraft || '').trim();
      if (!draft) return;
      try {
        await ProtocolApi.create(state.projectId, {
          question: draft,
          notes: 'Adopted AI-optimized research question',
          ...picoPayload(),
          criteria: criteriaApiPayload(state.criteria),
        });
        state.pendingQuestionDraft = null;
        await refreshProjectData();
        state.assistantResult = {
          title: '研究问题已更新',
          summary: draft,
        };
        app();
        toast('研究问题已写入方案');
      } catch (err) {
        toast(err.message || '采纳失败');
      }
      return;
    }
    if (action === 'assistant-apply-protocol-criteria') {
      if (!state.pendingProtocolCriteria?.length) return;
      try {
        await ProtocolApi.create(state.projectId, {
          question: state.question,
          notes: 'Adopted AI eligibility criteria draft from PICO',
          ...picoPayload(),
          criteria: criteriaApiPayload(state.pendingProtocolCriteria),
        });
        state.pendingProtocolCriteria = null;
        state.pendingProtocolSuggestion = null;
        await refreshProjectData();
        state.assistantResult = {
          title: '纳入排除标准已采纳',
          summary: '已写入 ' + state.criteria.length + ' 条标准到新方案版本。',
        };
        app();
        toast('标准已写入方案');
      } catch (err) {
        toast(err.message || '采纳失败');
      }
      return;
    }
    if (action === 'assistant-apply-search-terms') {
      const concept = state.concepts.find((c) => c.id === state.searchConceptId) || state.concepts[0];
      if (!concept || !state.pendingSearchTerms?.length) return;
      for (const term of state.pendingSearchTerms) {
        if (!concept.free.some((t) => t.toLowerCase() === term.toLowerCase())) concept.free.push(term);
      }
      state.pendingSearchTerms = null;
      markSearchStrategyDirty();
      state.assistantResult = { title: '已加入检索概念', summary: '已写入 ' + concept.title };
      app();
      toast('检索词已加入当前概念（本地草稿，记得保存）');
      return;
    }
    if (action === 'assistant-apply-search-strategy') {
      if (!state.pendingSearchStrategy?.length) return;
      state.concepts = state.pendingSearchStrategy.map((item, index) => ({
        id: 'concept-' + Date.now() + '-' + index,
        index: 'Concept ' + (index + 1),
        title: item.title,
        controlled: item.controlled || [],
        free: item.free || [],
      }));
      state.searchConceptId = state.concepts[0]?.id || '';
      state.pendingSearchStrategy = null;
      markSearchStrategyDirty();
      state.assistantResult = {
        title: '检索策略已采纳',
        summary: '已写入 ' + state.concepts.length + ' 个概念块，右侧已生成可复制检索式。请点击「保存检索策略」写入服务端。',
      };
      auditEvent('Adopted AI search strategy draft', 'Replaced local concept blocks from assistant suggestion.', 'Search', 'Search draft');
      app();
      toast('已生成概念块；请保存检索策略以免刷新丢失');
      return;
    }
    if (action === 'assistant-apply-mesh-map') {
      const draft = state.pendingMeshMap;
      if (!draft?.items?.length) return;
      let updated = 0;
      for (const item of draft.items) {
        const concept = state.concepts.find((c) => c.id === item.conceptId);
        if (!concept) continue;
        concept.controlled = [...(item.proposed || [])];
        updated += 1;
      }
      state.pendingMeshMap = null;
      markSearchStrategyDirty();
      state.assistantResult = {
        title: 'MeSH 受控词已更新',
        summary: '已写入 ' + updated + ' 个概念块的受控词（本地草稿，记得保存）。',
      };
      auditEvent('Updated MeSH from free terms', `Updated controlled vocabulary on ${updated} concept block(s).`, 'Search', 'Search draft');
      app();
      toast(updated ? 'MeSH 已写入概念块（请保存）' : '没有可更新的概念块');
      return;
    }
    if (action === 'assistant-adopt-adjudication') {
      const suggestion = state.adjudicationSuggestion;
      if (!suggestion || !citationId) return;
      await ScreeningApi.submitFinal(state.projectId, citationId, {
        decision: suggestion.decision,
        criterionIds: [],
        rationale: `[adjudication] ${suggestion.rationale || 'Adopted AI adjudication suggestion'}`,
        evidence: suggestion.evidence,
        confidence: suggestion.confidence,
      });
      state.adjudicationSuggestion = null;
      await refreshProjectData();
      app();
      toast('裁决建议已采纳并写入终裁');
      return;
    }
    if (action === 'assistant-library-gaps') {
      const missingAbstract = state.citations.filter((c) => !c.abstract).length;
      const missingFull = state.citations.filter((c) => c.fullText === 'Missing').length;
      state.assistantResult = {
        title: '文献库缺口',
        summary: '共 ' + state.citations.length + ' 条：缺摘要 ' + missingAbstract + '，缺全文 ' + missingFull + '。',
      };
      app();
      return;
    }
    if (action === 'assistant-run-rob-find') {
      await runRobFindEvidence();
      return;
    }
    if (action === 'assistant-run-rob-ai') {
      await runRobAi();
      return;
    }

    if (action === 'assistant-map-mesh-current' || action === 'assistant-map-mesh-all') {
      if (!state.concepts.length) throw new Error('请先添加概念块');
      const scopeAll = action === 'assistant-map-mesh-all';
      const targets = scopeAll
        ? state.concepts
        : [state.concepts.find((c) => c.id === state.searchConceptId) || state.concepts[0]].filter(Boolean);
      if (!targets.length) throw new Error('请先选择一个概念块');
      const mappable = targets.filter((c) => meshQueriesForConcept(c).length);
      if (!mappable.length) throw new Error('所选概念缺少名称或自由词，无法映射 MeSH');
      setBusy(true);
      const mapped = await mapConceptsMeshFromFreeTerms(mappable);
      state.pendingMeshMap = {
        scope: scopeAll ? 'all' : 'current',
        items: mapped.items,
      };
      state.pendingSearchTerms = null;
      state.pendingSearchStrategy = null;
      state.assistantResult = {
        title: scopeAll ? '全部概念 MeSH 映射' : '当前概念 MeSH 映射',
        badge: `${mapped.matched}/${mapped.attempted} MeSH`,
        summary: mapped.matched
          ? `已根据概念名与自由词查询 NCBI MeSH（匹配 ${mapped.matched}/${mapped.attempted}）${mapped.usedApiKey ? '；已使用项目 PubMed API Key' : '；未配置 PubMed API Key，建议在设置中填写以提高限额'}。确认后将替换各概念的受控词。`
          : '未匹配到官方 MeSH 词。可补充更规范的自由词后重试，或检查 PubMed API Key / 网络。',
      };
      return;
    }

    if (!needCred()) return;
    setBusy(true);

    if (action === 'assistant-priority-summary') {
      const prompt = '请根据当前项目任务，用中文列出今日优先事项（不超过5条）。待筛选 ' + Math.max(0, state.citations.length - state.screeningCompleted) + '，冲突 ' + state.adjudicationRemaining + '，文献 ' + state.citations.length + '。';
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'dashboard' },
        messages: [{ role: 'user', content: prompt }],
      });
      state.assistantResult = { title: '今日优先事项', summary: res.content || '', badge: '摘要' };
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
    } else if (action === 'assistant-optimize-question') {
      if (!state.question?.trim()) throw new Error('请先填写研究问题');
      const prompt = [
        'You are a systematic review methodologist.',
        'Improve the clarity of this research question for a systematic review protocol.',
        'Keep the scientific intent. Prefer a clear PICO-style sentence in Chinese.',
        'Do not invent populations, interventions, comparators, or outcomes that are not implied.',
        'If the original is already clear, make only light edits.',
        'Output ONLY the improved research question text. No labels, no quotes, no commentary.',
        'Original question:',
        state.question,
      ].join('\n');
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'protocol' },
        messages: [{ role: 'user', content: prompt }],
      });
      const draft = String(res.content || '')
        .replace(/^```[\s\S]*?\n/, '')
        .replace(/```$/, '')
        .replace(/^["「]|["」]$/g, '')
        .trim();
      if (!draft) throw new Error('模型未返回可用的研究问题');
      state.pendingQuestionDraft = draft;
      state.pendingProtocolCriteria = null;
      state.pendingProtocolSuggestion = null;
      state.assistantResult = null;
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
    } else if (action === 'assistant-extract-pico') {
      if (!state.question?.trim()) throw new Error('请先填写研究问题');
      const prompt = [
        'You are a systematic review methodologist.',
        'Research question:',
        state.question,
        'Extract PICO elements from the question.',
        'Rules: only extract what is explicitly supported; leave a field empty if uncertain or absent.',
        'Comparator (C) may be usual care / placebo / none — use empty if not stated.',
        'Output ONLY plain text in this exact format (Chinese preferred for clinical phrasing):',
        'P: <population or empty>',
        'I: <intervention or empty>',
        'C: <comparator or empty>',
        'O: <outcome or empty>',
        'No numbering, no markdown, no commentary.',
      ].join('\n');
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'protocol' },
        messages: [{ role: 'user', content: prompt }],
      });
      const pico = parsePicoDraft(res.content || '');
      await ProtocolApi.create(state.projectId, {
        question: state.question,
        notes: 'AI extracted PICO from research question',
        ...picoPayload(pico),
        criteria: criteriaApiPayload(state.criteria),
      });
      await refreshProjectData();
      state.pendingProtocolSuggestion = null;
      state.pendingProtocolCriteria = null;
      state.assistantResult = {
        title: 'PICO 已抽取',
        badge: [pico.p && 'P', pico.i && 'I', pico.c && 'C', pico.o && 'O'].filter(Boolean).join('') || '空',
        summary: ['P: ' + (pico.p || '（空）'), 'I: ' + (pico.i || '（空）'), 'C: ' + (pico.c || '（空）'), 'O: ' + (pico.o || '（空）')].join('\n'),
      };
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
      toast('PICO 已写入方案');
    } else if (action === 'assistant-suggest-criteria') {
      if (!state.question?.trim()) throw new Error('请先填写研究问题');
      if (!hasAnyPico()) throw new Error('请先抽取 PICO（至少一项非空）');
      const prompt = [
        'You are a systematic review methodologist.',
        'Research question:',
        state.question,
        'PICO:',
        'P: ' + (state.pico.p || '(empty)'),
        'I: ' + (state.pico.i || '(empty)'),
        'C: ' + (state.pico.c || '(empty)'),
        'O: ' + (state.pico.o || '(empty)'),
        'Generate 4 to 6 eligibility criteria grounded in the PICO above.',
        'Prefer one criterion family per PICO element when that element is non-empty; add study-design if helpful.',
        'Output ONLY plain text blocks in this exact format:',
        'CODE: P',
        'TITLE: <short Chinese title>',
        'INCLUDE: <inclusion statement>',
        'EXCLUDE: <exclusion statement>',
        'CODE: I',
        'TITLE: ...',
        'INCLUDE: ...',
        'EXCLUDE: ...',
        'No markdown fences, no commentary.',
      ].join('\n');
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'protocol' },
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = parseCriteriaDraft(res.content || '');
      state.pendingProtocolCriteria = parsed;
      state.pendingProtocolSuggestion = parsed.length ? null : (res.content || '');
      state.assistantResult = null;
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
      if (!parsed.length) toast('未能解析标准草稿，请重试');
    } else if (action === 'assistant-suggest-terms') {
      const concept = state.concepts.find((c) => c.id === state.searchConceptId) || state.concepts[0];
      if (!concept) throw new Error('请先添加或选择一个概念块');
      const prompt = '检索概念「' + (concept?.title || '') + '」现有自由词：' + ((concept?.free || []).join(', ')) + '\n请再建议 5-8 个英文同义词/自由词，每行一个，不要编号。';
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'search' },
        messages: [{ role: 'user', content: prompt }],
      });
      state.pendingSearchTerms = String(res.content || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 12);
      state.pendingSearchStrategy = null;
      state.pendingMeshMap = null;
      state.assistantResult = null;
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
    } else if (action === 'assistant-generate-strategy') {
      const basis = effectiveSearchStrategyBasis();
      const options = searchStrategyBasisOptions();
      const selected = options.find((item) => item.id === basis);
      if (!selected?.available) {
        if (!state.question?.trim() && !hasAnyPico()) throw new Error('请先填写研究问题或抽取 PICO');
        if (basis === 'question') throw new Error('请先填写研究问题');
        if (basis === 'pico') throw new Error('请先抽取或填写 PICO');
        throw new Error('当前依据不可用：请同时具备研究问题与 PICO，或切换依据');
      }
      state.searchStrategyBasis = basis;
      const prompt = buildSearchStrategyPrompt(basis);
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'search', searchStrategyBasis: basis },
        messages: [{ role: 'user', content: prompt }],
      });
      const draft = parseSearchStrategyDraft(res.content || '');
      state.pendingSearchTerms = null;
      state.pendingMeshMap = null;
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
      const basisLabel = ({ question: '研究问题', pico: 'PICO', both: '问题 + PICO' })[basis] || basis;
      if (!draft.length) {
        state.pendingSearchStrategy = [];
        state.assistantResult = { title: '未能解析策略草稿', summary: res.content || '模型未返回可用概念块，请重试或手动添加概念。' };
        toast('未能从模型输出解析出概念块');
      } else {
        try {
          const constrained = await constrainStrategyWithMesh(draft);
          state.pendingSearchStrategy = constrained.blocks;
          state.assistantResult = {
            title: '检索策略草稿（已 MeSH 校验）',
            badge: `${constrained.matched}/${constrained.attempted} MeSH`,
            summary: `依据：${basisLabel}。` + (constrained.matched
              ? `已用 NCBI MeSH 词表约束受控词（匹配 ${constrained.matched}/${constrained.attempted}）${constrained.usedApiKey ? '；已使用项目 PubMed API Key' : '；未配置 PubMed API Key，建议在设置中填写以提高限额'}。可采纳后继续编辑。`
              : '未能匹配到官方 MeSH 词；已保留自由词。可采纳后手动补充受控词，或检查 PubMed API Key / 候选词。'),
          };
        } catch (meshErr) {
          state.pendingSearchStrategy = draft.map((b) => ({
            title: b.title,
            free: b.free || [],
            controlled: [],
          }));
          state.assistantResult = {
            title: '检索策略草稿（MeSH 校验失败）',
            summary: `依据：${basisLabel}。概念块已生成，但 MeSH 校验失败：${formatUserFacingError(meshErr)}。受控词暂为空，可稍后重试。`,
          };
          toast('MeSH 校验失败，已保留自由词草稿');
        }
      }
    } else if (action === 'assistant-run-screen-ai') {
      if (!citationId) throw new Error('没有焦点文献');
      const ai = await ScreeningApi.runAi(state.projectId, citationId, { credentialId: state.credentialId });
      const decision = ai.decision || {};
      const result = ai.result || {};
      state.assistantResult = {
        title: '初筛 AI',
        badge: decision.decision || result.decision || '',
        summary: decision.rationale || result.rationale || '',
        evidence: decision.evidence || (result.evidenceSpans || []).join(' | ') || '',
      };
      await refreshScreeningQueue();
    } else if (action === 'assistant-batch-ai') {
      if (!state.selectedBatch?.length) throw new Error('请先勾选文献');
      if (state.assistantJob && !['completed', 'failed'].includes(state.assistantJob.status)) {
        throw new Error('已有批量任务进行中，请稍候');
      }
      await refreshProjectData();
      const known = new Set(state.citations.map((c) => String(c.id)));
      const ids = state.selectedBatch.map(String).filter((id) => known.has(id));
      if (!ids.length) throw new Error('勾选的文献已失效，请刷新页面后重新勾选');
      state.selectedBatch = ids;
      const total = ids.length;
      const job = await ScreeningApi.batchAi(state.projectId, {
        citationIds: ids,
        credentialId: state.credentialId,
      });
      startAssistantJobPoll(job.jobId, total, 'screening');
      state.aiOpen = true;
    } else if (action === 'assistant-fulltext-ai' || action === 'run-fulltext-ai') {
      if (!citationId) throw new Error('没有已纳入文献');
      const res = await ScreeningApi.fulltextAi(state.projectId, citationId, { credentialId: state.credentialId });
      state.assistantResult = {
        title: '全文资格 AI',
        badge: res.decision?.decision || res.result?.decision || '',
        summary: res.result?.rationale || res.decision?.rationale || '',
        evidence: res.result?.evidenceSpans?.join(' | ') || res.decision?.evidence || '',
      };
      await refreshScreeningQueue();
    } else if (action === 'assistant-extract-row') {
      if (!citationId) throw new Error('没有可提取文献');
      const res = await ExtractionApi.runAi(state.projectId, citationId, { credentialId: state.credentialId });
      await refreshExtractionData();
      state.assistantResult = {
        title: '提取预填完成',
        badge: String(res.count || 0) + ' 格',
        summary: '已写入 ' + (res.count || 0) + ' 个字段；跳过 ' + ((res.skipped || []).length) + ' 项（证据不可校验或空值）。',
      };
    } else if (action === 'assistant-extract-all' || action === 'run-extract-all') {
      if (state.assistantJob && !['completed', 'failed'].includes(state.assistantJob.status)) {
        throw new Error('已有批量任务进行中，请稍候');
      }
      await refreshProjectData();
      const ids = includedAfterFulltext().map((c) => String(c.id)).filter(Boolean);
      if (!ids.length) throw new Error('没有全文已纳入的研究可提取');
      if (!state.extractionFields.length) throw new Error('请先配置提取字段');
      const total = ids.length;
      const job = await ExtractionApi.batchAi(state.projectId, {
        citationIds: ids,
        credentialId: state.credentialId,
      });
      startAssistantJobPoll(job.jobId, total, 'extraction');
      state.aiOpen = true;
    } else if (action === 'assistant-extract-cell') {
      const fieldId = state.extractionFocus?.fieldId || state.modalPayload?.fieldId;
      const cid = state.extractionFocus?.citationId || state.modalPayload?.citationId || citationId;
      if (!cid || !fieldId) throw new Error('请先选中某个提取单元格');
      const res = await ExtractionApi.runAi(state.projectId, cid, { credentialId: state.credentialId, fieldIds: [fieldId] });
      await refreshExtractionData();
      state.assistantResult = {
        title: '单元格预填',
        badge: String(res.count || 0),
        summary: res.count ? '已根据可校验证据写入当前字段。' : '未能写入（证据不足或不匹配）。',
      };
    } else if (action === 'assistant-adjudication-suggest') {
      if (!citationId) throw new Error('没有冲突记录');
      const conflict = screeningConflicts().find((c) => c.citation?.id === citationId)
        || screeningConflicts()[state.adjudicationIndex || 0];
      if (conflict?.kind === 'human_human_b') {
        throw new Error('双人 Diff 冲突请直接人工终裁');
      }
      const res = await ScreeningApi.adjudicationSuggest(state.projectId, citationId, { credentialId: state.credentialId });
      state.adjudicationSuggestion = res.suggestion;
      state.assistantResult = null;
    } else if (action === 'assistant-report-draft') {
      const prompt = '请用中文写一段系统综述项目状态草稿（约150字）。文献 ' + state.citations.length + '，已筛 ' + state.screeningCompleted + '，冲突 ' + state.adjudicationRemaining + '，提取已填 ' + state.extractionValues.filter((v) => v.value).length + '，RoB 人工 ' + state.robJudgements.filter((j) => j.actor === 'human').length + '。';
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'synthesis' },
        messages: [{ role: 'user', content: prompt }],
      });
      state.assistantResult = { title: '报告草稿段落', summary: res.content || '', badge: '草稿' };
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
    } else if (action === 'assistant-explain-audit') {
      const ev = state.audits[0];
      const prompt = '请解释这条审计事件的方法学含义与后续建议：' + (ev?.actor || '') + ' · ' + (ev?.action || '') + ' · ' + (ev?.detail || '');
      const res = await LlmApi.chat({
        credentialId: state.credentialId,
        projectId: state.projectId,
        context: { module: 'audit' },
        messages: [{ role: 'user', content: prompt }],
      });
      state.assistantResult = { title: '审计解释', summary: res.content || '' };
      state.lastAiQuestion = prompt;
      state.lastAiAnswer = res.content || '';
    } else if (action === 'assistant-meta-validate') {
      if (!state.metaAnalysisId) throw new Error('请先选择 Meta 分析');
      const res = await MetaApi.validate(state.projectId, state.metaAnalysisId);
      state.metaComputability = res.report;
      const lines = (res.report?.assessments || []).map((a) => {
        const head = (a.label || a.citationId || '?') + (a.ok ? ' · 可计算' : ' · 不可计算');
        const issues = (a.issues || []).map((i) => i.message).join('；');
        const hints = (a.hints || []).join('；');
        return head + (issues ? '\n  问题：' + issues : '') + (hints ? '\n  建议：' + hints : '');
      });
      state.assistantResult = {
        title: '可计算性检查',
        badge: `${res.report?.computable || 0}/${res.report?.total || 0} 可算`,
        summary: `效应量 ${res.measure}：可计算 ${res.report?.computable || 0}，不可计算 ${res.report?.notComputable || 0}，${res.report?.canRun ? '可以运行' : '尚不可运行'}。\n\n` + lines.join('\n\n'),
      };
      state.aiOpen = true;
    } else if (action === 'assistant-meta-tools') {
      const res = await MetaApi.listTools(state.projectId);
      state.assistantResult = {
        title: 'Meta 转换工具目录',
        badge: `${(res.tools || []).length} 个`,
        summary: (res.tools || []).map((t) => `${t.name}\n  ${t.description}`).join('\n\n'),
      };
      state.aiOpen = true;
    } else if (action === 'assistant-meta-convert-rate') {
      const rateRaw = window.prompt('Rate / proportion / percent (e.g. 0.125 or 12.5)');
      if (rateRaw == null) return;
      const nRaw = window.prompt('Sample size n');
      if (nRaw == null) return;
      const rate = Number(rateRaw);
      const n = Number(nRaw);
      const rateIsPercent = rate > 1 || String(rateRaw).includes('%');
      const res = await MetaApi.callTool(state.projectId, 'rate_to_events', { rate, n, rateIsPercent });
      const r = res.result;
      state.assistantResult = {
        title: '率 → 事件数',
        summary: r?.ok
          ? `events=${r.events} (rounded ${r.eventsRounded}), n=${r.n}, rateUsed=${r.rateUsed}\n${r.note || ''}`
          : (r?.issues || []).map((i) => i.message).join('\n') || '转换失败',
      };
      state.aiOpen = true;
    } else if (action === 'assistant-meta-convert-or-ci' || action === 'assistant-meta-convert-rr-ci' || action === 'assistant-meta-convert-md-ci') {
      const isMd = action === 'assistant-meta-convert-md-ci';
      const isRr = action === 'assistant-meta-convert-rr-ci';
      const estLabel = isMd ? 'Mean difference (MD)' : (isRr ? 'Risk ratio (RR)' : 'Odds ratio (OR)');
      const estRaw = window.prompt(estLabel);
      if (estRaw == null) return;
      const loRaw = window.prompt('95% CI low');
      if (loRaw == null) return;
      const hiRaw = window.prompt('95% CI high');
      if (hiRaw == null) return;
      const tool = isMd ? 'md_ci_to_yi_sei' : (isRr ? 'rr_ci_to_yi_sei' : 'or_ci_to_yi_sei');
      const key = isMd ? 'md' : (isRr ? 'rr' : 'or');
      const res = await MetaApi.callTool(state.projectId, tool, {
        [key]: Number(estRaw),
        ciLow: Number(loRaw),
        ciHigh: Number(hiRaw),
      });
      const r = res.result;
      let summary = r?.ok
        ? `yi=${r.yi}\nsei=${r.sei}\nscale=${r.measureScale}\n填入效应表的 yi / sei 字段即可参与合并。`
        : (r?.issues || []).map((i) => i.message).join('\n') || '转换失败';
      if (r?.ok && state.metaAnalysisId && state.metaDetail?.rows?.length) {
        const cite = window.prompt('Optional: citationId to write yi/sei into (Cancel to skip)');
        if (cite) {
          const rows = (state.metaDetail.rows || []).map((row) => ({ ...row }));
          const idx = rows.findIndex((row) => row.citationId === cite);
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], yi: r.yi, sei: r.sei, ciLow: Number(loRaw), ciHigh: Number(hiRaw) };
            await MetaApi.saveRows(state.projectId, state.metaAnalysisId, rows.map((row) => ({
              citationId: row.citationId,
              label: row.label,
              eventsT: row.eventsT,
              nT: row.nT,
              eventsC: row.eventsC,
              nC: row.nC,
              meanT: row.meanT,
              sdT: row.sdT,
              meanC: row.meanC,
              sdC: row.sdC,
              yi: row.yi,
              sei: row.sei,
              ciLow: row.ciLow,
              ciHigh: row.ciHigh,
              subgroup: row.subgroup,
              source: row.source,
            })));
            await refreshMetaData(state.metaAnalysisId);
            summary += `\n已写入 citationId=${cite}`;
          } else {
            summary += `\n未找到 citationId=${cite}，未写入`;
          }
        }
      }
      state.assistantResult = { title: tool, summary };
      state.aiOpen = true;
    } else {
      toast('未知助手动作');
    }
  } catch (err) {
    toast(formatUserFacingError(err) || '助手动作失败');
  } finally {
    state.assistantBusy = false;
    app();
  }
}

async function submitFulltextDecision() {
  if (!state.fulltextDecision) {
    toast('请先选择纳入或排除');
    return;
  }
  const included = includedForFulltext();
  const citation = included[state.fulltextIndex || 0] || included[0];
  if (!citation?.id) {
    toast('没有可提交的全文记录');
    return;
  }
  const decision = state.fulltextDecision.startsWith('Exclude') ? 'Exclude' : state.fulltextDecision;
  const rationale = state.fulltextDecision.startsWith('Exclude')
    ? `[fulltext] ${state.fulltextDecision}`
    : '[fulltext] Full-text eligibility check against current protocol criteria';
  try {
    await ScreeningApi.submitFinal(state.projectId, citation.id, {
      decision,
      criterionIds: [],
      rationale,
      evidence: citation.abstract || citation.fullTextMarkdown || '',
    });
    state.fulltextDecision = null;
    await refreshProjectData();
    const next = includedForFulltext();
    state.fulltextIndex = next.length ? Math.min(state.fulltextIndex || 0, next.length - 1) : 0;
    app();
    toast(decision === 'Include' ? '已纳入并写入服务端' : '已排除并写入服务端');
  } catch (err) {
    toast(err.message || '全文判断保存失败');
  }
}

async function handleAction(action, event) {
  if (action === 'menu') { state.sidebarOpen = !state.sidebarOpen; app(); return; }
  if (action === 'ai-toggle') { state.aiOpen = !state.aiOpen; app(); return; }
  if (action === 'ai-close') { state.aiOpen = false; app(); return; }
  if (action === 'global-search') { state.searchQuery = ''; state.modal = 'search'; app(); return; }
  if (action === 'settings' || action === 'project') { state.modal = 'settings'; state.modalPayload = null; app(); return; }
  if (action === 'delete-project-start') {
    state.modal = 'delete-project';
    state.modalPayload = { step: 1 };
    app();
    return;
  }
  if (action === 'schema') { state.extractionView = 'fields'; persistState(); app(); return; }
  if (action === 'add-extraction-field') { state.modal = 'extraction-field'; state.modalPayload = {}; app(); return; }
  if (action === 'edit-extraction-field') { state.modal = 'extraction-field'; state.modalPayload = { fieldId: event.currentTarget.dataset.id }; app(); return; }
  if (action === 'delete-extraction-field') { state.modal = 'delete-extraction-field'; state.modalPayload = { fieldId: event.currentTarget.dataset.id }; app(); return; }
  if (action === 'select-extraction-row') {
    const citationId = event.currentTarget.dataset.citationId || '';
    state.extractionFocus = {
      citationId,
      fieldId: state.extractionFocus?.citationId === citationId ? (state.extractionFocus.fieldId || '') : '',
    };
    app();
    return;
  }
  if (action === 'edit-extraction-value') {
    const citationId = event.currentTarget.dataset.citationId;
    const fieldId = event.currentTarget.dataset.fieldId;
    state.extractionFocus = { citationId, fieldId };
    state.modal = 'extraction-value';
    state.modalPayload = { citationId, fieldId };
    app();
    return;
  }
  if (action === 'import' || action === 'import-search') { state.modal = 'import'; state.modalPayload = {}; app(); return; }
  if (action === 'import-screening-diff') { state.modal = 'import-screening-diff'; state.modalPayload = {}; app(); return; }
  if (action === 'export-screening-diff') {
    try {
      const payload = await ScreeningApi.exportDiff(state.projectId);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(
        `qiuzheng-screening-diff-${stamp}.json`,
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
      );
      toast(`已导出 ${(payload.decisions || []).length} 条初筛判断`);
    } catch (err) {
      toast(err.message || '导出 Diff 失败');
    }
    return;
  }
  if (action === 'edit-criterion') { state.modal = 'criterion'; state.modalPayload = { id: event.currentTarget.dataset.id }; app(); return; }
  if (action === 'add-criterion') { state.modal = 'criterion'; state.modalPayload = {}; app(); return; }
  if (action === 'edit-question') { state.modal = 'question'; state.modalPayload = {}; app(); return; }
  if (action === 'edit-pico') { state.modal = 'pico'; state.modalPayload = {}; app(); return; }
  if (action === 'add-concept') { state.modal = 'concept'; state.modalPayload = {}; app(); return; }
  if (action === 'add-term') { state.modal = 'term'; state.modalPayload = { id: event.currentTarget.dataset.id }; app(); return; }
  if (action === 'modal-backdrop' && event.target !== event.currentTarget) return;
  if (action === 'modal-close' || action === 'modal-backdrop') { state.modal = null; state.modalPayload = null; app(); return; }
  if (action === 'modal-save') { saveModal(); return; }
  if (action === 'copy-query') {
    const text = document.querySelector('.code-box')?.textContent || '';
    navigator.clipboard?.writeText(text).then(() => toast('当前数据库检索式已复制')).catch(() => toast('无法访问剪贴板，请手动复制'));
    return;
  }
  if (action === 'remove-term') {
    const concept = state.concepts.find((item) => item.id === event.currentTarget.dataset.id);
    concept?.free.splice(Number(event.currentTarget.dataset.index), 1);
    markSearchStrategyDirty();
    auditEvent('移除检索词', '检索策略草稿已更新。', 'Search', 'Search draft');
    app();
    toast('术语已移除');
    return;
  }
  if (action === 'remove-controlled') {
    const concept = state.concepts.find((item) => item.id === event.currentTarget.dataset.id);
    if (!concept?.controlled) return;
    const index = Number(event.currentTarget.dataset.index);
    const removed = concept.controlled[index];
    concept.controlled.splice(index, 1);
    markSearchStrategyDirty();
    auditEvent('移除 MeSH 受控词', removed ? `Removed: ${removed}` : 'Controlled vocabulary updated.', 'Search', 'Search draft');
    app();
    toast('MeSH 受控词已移除');
    return;
  }
  if (action === 'remove-concept') {
    const id = event.currentTarget.dataset.id;
    const concept = state.concepts.find((item) => item.id === id);
    if (!concept) return;
    state.concepts = state.concepts.filter((item) => item.id !== id);
    if (state.searchConceptId === id) {
      state.searchConceptId = state.concepts[0]?.id || '';
    }
    markSearchStrategyDirty();
    auditEvent('删除检索概念 ' + (concept.title || ''), '检索概念图已更新。', 'Search', 'Search draft');
    persistState();
    app();
    toast('概念块已删除');
    return;
  }
  if (action === 'save-search-strategy') {
    saveSearchStrategy();
    return;
  }
  if (action === 'send') {
    const ta = event.currentTarget.closest('.compose-box').querySelector('textarea');
    if (!ta.value.trim()) return;
    state.lastAiQuestion = ta.value.trim();
    if (!state.credentialId) {
      state.lastAiAnswer = '请先在项目设置中配置模型凭据（支持 NVIDIA / OpenAI / DeepSeek / 自定义）。';
      app();
      return;
    }
    const citationId = assistantFocusId(state, { currentScreenCase, includedForFulltext, screeningConflicts });
    state.assistantBusy = true;
    app();
    LlmApi.chat({
      credentialId: state.credentialId,
      projectId: state.projectId,
      context: { module: state.active, citationId: citationId || undefined },
      messages: [{ role: 'user', content: state.lastAiQuestion }],
    }).then((res) => {
      state.lastAiAnswer = res.content || '';
      state.assistantBusy = false;
      app();
      toast('已基于任务上下文生成回答');
    }).catch((err) => {
      state.assistantBusy = false;
      app();
      toast(err.message || '模型调用失败');
    });
    return;
  }
  if (action.startsWith('assistant-') || action === 'run-fulltext-ai' || action === 'run-extract-all') {
    if (action === 'assistant-retry-failed-batch') {
      const ids = state.assistantResult?.jobActions?.retryFailed || state.assistantJob?.failures?.map((f) => f.citationId) || [];
      relaunchBatchAi(ids, '重试失败项').catch((err) => toast(err.message || '重试失败'));
      return;
    }
    if (action === 'assistant-resume-batch') {
      const failedIds = state.assistantResult?.jobActions?.retryFailed || state.assistantJob?.failures?.map((f) => f.citationId) || [];
      const remaining = state.assistantResult?.jobActions?.resumeRemaining || state.assistantJob?.remaining || [];
      relaunchBatchAi([...failedIds, ...remaining], '续跑未完成').catch((err) => toast(err.message || '续跑失败'));
      return;
    }
    const mapped = action === 'run-fulltext-ai'
      ? 'assistant-fulltext-ai'
      : action === 'run-extract-all'
        ? 'assistant-extract-all'
        : action;
    runAssistantAction(mapped);
    return;
  }
  if (action === 'next-conflict' || action === 'skip') {
    const conflicts = screeningConflicts();
    state.adjudicationResolution = null;
    state.adjudicationIndex = conflicts.length ? ((state.adjudicationIndex || 0) + 1) % conflicts.length : 0;
    app();
    return;
  }
  if (action === 'prev-fulltext') {
    const included = includedForFulltext();
    state.fulltextDecision = null;
    state.fulltextEvidenceQuery = '';
    state.fulltextEvidenceCriterionId = '';
    state.fulltextViewMode = 'auto';
    const len = included.length;
    state.fulltextIndex = len ? ((state.fulltextIndex || 0) - 1 + len) % len : 0;
    app();
    return;
  }
  if (action === 'next-fulltext') {
    const included = includedForFulltext();
    state.fulltextDecision = null;
    state.fulltextEvidenceQuery = '';
    state.fulltextEvidenceCriterionId = '';
    state.fulltextViewMode = 'auto';
    state.fulltextIndex = included.length ? ((state.fulltextIndex || 0) + 1) % included.length : 0;
    app();
    return;
  }
  if (action === 'set-fulltext-view') {
    const view = event.currentTarget.dataset.view;
    if (view === 'pdf' || view === 'text') {
      state.fulltextViewMode = view;
      persistState();
      app();
    }
    return;
  }
  if (action === 'create-meta-analysis') {
    const name = window.prompt('结局分析名称', 'Primary outcome');
    if (!name?.trim()) return;
    try {
      const measure = window.prompt('效应量类型 OR / RR / MD / SMD', 'OR') || 'OR';
      const res = await MetaApi.createAnalysis(state.projectId, {
        name: name.trim(),
        measure: ['OR', 'RR', 'MD', 'SMD'].includes(measure.trim().toUpperCase()) ? measure.trim().toUpperCase() : 'OR',
        modelPref: 'random',
      });
      await refreshMetaData(res.analysis.id);
      app();
      toast('已创建 Meta 分析');
    } catch (err) {
      toast(err.message || '创建失败');
    }
    return;
  }
  if (action === 'delete-meta-analysis') {
    const analysisId = event.currentTarget.dataset.id || state.metaAnalysisId;
    if (!analysisId) { toast('请先选择要删除的分析'); return; }
    const target = (state.metaAnalyses || []).find((a) => a.id === analysisId);
    const label = target?.name || '该分析';
    if (!window.confirm(`删除「${label}」？将同时删除其效应行与历史运行，不可撤销。`)) return;
    try {
      await MetaApi.removeAnalysis(state.projectId, analysisId);
      if (state.metaAnalysisId === analysisId) {
        state.metaAnalysisId = '';
        state.metaDetail = null;
      }
      await refreshMetaData();
      app();
      toast('分析已删除');
    } catch (err) {
      toast(err.message || '删除失败');
    }
    return;
  }
  if (action === 'select-meta-analysis') {
    try {
      await refreshMetaData(event.currentTarget.dataset.id);
      app();
    } catch (err) {
      toast(err.message || '加载分析失败');
    }
    return;
  }
  if (action === 'meta-seed-demo-rows') {
    if (!state.metaAnalysisId) return;
    const studies = includedAfterFulltext().slice(0, 4);
    if (studies.length < 2) {
      toast('需要至少 2 篇全文纳入研究才能写入演示效应行');
      return;
    }
    const armPairs = [
      ['DrugA', 'Placebo'],
      ['DrugB', 'Placebo'],
      ['DrugA', 'DrugB'],
      ['DrugA', 'Placebo'],
    ];
    const subgroups = ['adult', 'adult', 'elderly', 'elderly'];
    const demo = studies.map((c, i) => ({
      citationId: c.id,
      label: c.title,
      eventsT: 8 + i * 3,
      nT: 80 + i * 20,
      eventsC: 15 + i * 2,
      nC: 80 + i * 18,
      subgroup: subgroups[i] || 'adult',
      armT: armPairs[i]?.[0] || 'Treatment',
      armC: armPairs[i]?.[1] || 'Control',
      source: 'demo_seed',
    }));
    try {
      await MetaApi.saveRows(state.projectId, state.metaAnalysisId, demo);
      await refreshMetaData(state.metaAnalysisId);
      app();
      toast(`已写入 ${demo.length} 条演示效应行（含亚组与多臂标签）`);
    } catch (err) {
      toast(err.message || '写入失败');
    }
    return;
  }
  if (action === 'meta-map-extraction') {
    if (!state.metaAnalysisId) return;
    state.metaBusy = true;
    app();
    try {
      const res = await MetaApi.mapExtraction(state.projectId, state.metaAnalysisId, { replace: true });
      await refreshMetaData(state.metaAnalysisId);
      toast(res.mapped ? `已映射 ${res.mapped} 行（需提取字段含 events_t/n_t/events_c/n_c 等）` : '未映射到可用行：请在提取中配置效应量相关字段');
      app();
    } catch (err) {
      toast(err.message || '映射失败');
    } finally {
      state.metaBusy = false;
      app();
    }
    return;
  }
  if (action === 'run-meta-analysis' || action === 'run-meta-recipe') {
    if (!state.metaAnalysisId) return;
    const recipe = event.currentTarget.dataset.recipe || 'fixed_random';
    state.metaBusy = true;
    app();
    try {
      const res = await MetaApi.run(state.projectId, state.metaAnalysisId, {
        model: state.metaDetail?.modelPref || 'random',
        recipe,
      });
      state.metaComputability = res.computability || null;
      await refreshMetaData(state.metaAnalysisId);
      const s = res.run?.resultJson?.summary;
      const skipped = res.computability?.notComputable || 0;
      toast(s
        ? `${recipe} 完成${s.yiDisplay != null ? `：pooled=${Number(s.yiDisplay).toFixed(3)}` : ''} I2=${Number(s.i2 || 0).toFixed(1)}%${skipped ? `（跳过 ${skipped} 行）` : ''}`
        : `${recipe} 运行完成`);
      app();
    } catch (err) {
      if (err.code === 'not_computable' && err.data?.computability) {
        state.metaComputability = err.data.computability;
        state.assistantResult = {
          title: '不可计算，已拦截运行',
          badge: '可计算性',
          summary: (err.data.computability.assessments || [])
            .filter((a) => !a.ok)
            .map((a) => `${a.label || a.citationId}: ${(a.issues || []).map((i) => i.message).join('；')}`)
            .join('\n') || err.message,
        };
        state.aiOpen = true;
      }
      toast(err.message || 'Meta 运行失败');
      app();
    } finally {
      state.metaBusy = false;
      app();
    }
    return;
  }
  if (action === 'toggle-synthesis-query') {
    const q = event.currentTarget.dataset.query;
    const set = new Set(state.synthesisQueries || []);
    if (set.has(q)) set.delete(q);
    else set.add(q);
    state.synthesisQueries = [...set];
    app();
    return;
  }
  if (action === 'toggle-synthesis-llm') {
    state.synthesisUseLlm = Boolean(event.currentTarget.checked);
    return;
  }
  if (action === 'synthesis-recall') {
    state.synthesisBusy = true;
    app();
    try {
      const res = await SynthesisApi.knowledge(state.projectId, state.synthesisQueries || []);
      state.synthesisKnowledge = res.knowledge;
      toast('知识已召回');
      app();
    } catch (err) {
      toast(err.message || '召回失败');
    } finally {
      state.synthesisBusy = false;
      app();
    }
    return;
  }
  if (action === 'synthesis-compose') {
    state.synthesisBusy = true;
    app();
    try {
      const res = await SynthesisApi.compose(state.projectId, {
        queries: state.synthesisQueries?.length ? state.synthesisQueries : ['protocol', 'meta'],
        useLlm: Boolean(state.synthesisUseLlm),
        credentialId: state.credentialId || undefined,
        title: `${state.projectName} · 证据综合`,
      });
      state.synthesisKnowledge = res.knowledge;
      await refreshSynthesisList();
      toast('综合稿已生成');
      app();
    } catch (err) {
      toast(err.message || '生成失败');
    } finally {
      state.synthesisBusy = false;
      app();
    }
    return;
  }
  if (action === 'download-synthesis-compose') {
    const latest = (state.synthesisComposes || [])[0];
    if (!latest?.markdown) { toast('没有可下载的综合稿'); return; }
    downloadFile('qiuzheng-evidence-synthesis.md', latest.markdown, 'text/markdown;charset=utf-8');
    return;
  }
  if (action === 'generate-draft') {
    recomputeDerivedCounts();
    const markdown = '# ' + state.projectName + '\n\n> Generated ' + new Date().toISOString() + '\n\n## Live project status\n\n- Citations: ' + state.citations.length + '\n- Screened: ' + state.screeningCompleted + '\n- Conflicts: ' + state.adjudicationRemaining + '\n- Extraction cells filled: ' + state.extractionValues.filter((v) => v.value).length + '\n- RoB human judgements: ' + state.robJudgements.filter((j) => j.actor === 'human').length + '\n- Audit events: ' + state.audits.length + '\n';
    downloadFile('qiuzheng-report-draft.md', markdown, 'text/markdown;charset=utf-8');
    auditEvent('Generated report draft', 'Draft built from live server-backed counts.', 'Synthesis', 'Report draft');
    toast('报告草稿已下载');
    return;
  }
  if (action === 'validate-search' || action === 'fix-search' || action === 'recheck' || action === 'workflow-detail' || action === 'replace-pdf') {
    toast('该操作已改为真实数据模式：请直接编辑检索概念、导入文献或配置模型。');
    return;
  }
  if (action === 'seed-demo') {
    ProjectApi.seedDemo(state.projectId).then(async () => {
      await refreshProjectData();
      app();
      toast('演练数据已写入服务端（可真实筛选/提取）');
    }).catch((err) => toast(err.message));
    return;
  }
  if (action === 'logout') { handleLogout(); return; }
  if (action === 'switch-project') { state.boot = 'picker'; app(); return; }
  if (action === 'batch-clear-selection') {
    state.selectedBatch = [];
    app();
    toast('已取消全选');
    return;
  }
  if (action === 'batch-confirm') {
    const unresolved = state.selectedBatch.filter((id) => !state.batchDecisions[id]);
    if (unresolved.length) { toast('还有 ' + unresolved.length + ' 条未选择人工判断'); return; }
    Promise.all(state.selectedBatch.map((id) => ScreeningApi.submitHuman(state.projectId, id, {
      decision: state.batchDecisions[id],
      criterionIds: [],
    }))).then(async () => {
      state.selectedBatch = [];
      await refreshProjectData();
      app();
      toast('批量人工判断已写入服务端');
    }).catch((err) => toast(err.message || '批量保存失败'));
    return;
  }
  if (action === 'full-include') {
    state.fulltextDecision = 'Include';
    persistState();
    app();
    await submitFulltextDecision();
    return;
  }
  if (action === 'full-exclude') { state.modal = 'exclusion'; state.modalPayload = {}; app(); return; }
  if (action === 'fulltext-decision') {
    await submitFulltextDecision();
    return;
  }
  if (action === 'jump-evidence') {
    const criterionId = event.currentTarget.dataset.id || '';
    const criterion = state.criteria.find((item) => item.id === criterionId);
    const included = includedForFulltext();
    const citation = included[state.fulltextIndex || 0] || included[0];
    const sourceText = citation?.fullTextMarkdown || citation?.raw?.fullTextMarkdown || citation?.abstract || citation?.raw?.abstract || '';
    state.fulltextEvidenceCriterionId = criterionId;
    state.fulltextViewMode = 'text';
    if (!citation?.id) {
      toast('没有可定位的全文记录');
      return;
    }
    if (!sourceText.trim()) {
      state.fulltextEvidenceQuery = '';
      state.pendingScrollToEvidence = true;
      state.pendingEvidenceToast = '当前没有可定位的原文（请上传 MD 或确认有摘要）';
      app();
      return;
    }
    toast('正在用 Embedding + LLM 定位原文…');
    ScreeningApi.locateCriterion(state.projectId, citation.id, {
      criterionId,
      criterionTitle: criterion?.title || criterionId,
      includeTexts: criterion?.include || [],
      excludeTexts: criterion?.exclude || [],
      credentialId: state.credentialId || undefined,
    }).then((res) => {
      const quote = String(res.quote || (res.quotes && res.quotes[0]) || '').trim();
      state.fulltextEvidenceQuery = quote;
      state.rankedEvidence = res.rankedEvidence || state.rankedEvidence || [];
      state.pendingScrollToEvidence = true;
      if (quote) {
        const methodLabel = res.method === 'literal'
          ? '字面匹配'
          : (res.usedLlm ? 'Embedding + LLM' : 'Embedding');
        state.pendingEvidenceToast = `已定位原文（${methodLabel}${res.cacheHit ? ' · 缓存命中' : ''}）`;
      } else if (res.method === 'embedding-miss' || res.usedEmbeddings) {
        state.pendingEvidenceToast = 'Embedding 未召回足够相关片段，已定位到正文区域';
      } else {
        state.pendingEvidenceToast = state.credentialId
          ? '未能定位相关原文，已定位到正文区域'
          : '未配置模型凭据，仅做字面匹配失败；已定位到正文区域';
      }
      app();
    }).catch((err) => {
      state.fulltextEvidenceQuery = '';
      state.pendingScrollToEvidence = true;
      state.pendingEvidenceToast = formatUserFacingError(err) || '原文定位失败';
      app();
    });
    app();
    return;
  }
  if (action === 'select-rob-question') {
    state.robQuestionKey = event.currentTarget.dataset.question;
    const human = robJudgement(state.robQuestionKey, 'human');
    const ai = robJudgement(state.robQuestionKey, 'ai');
    state.robEvidenceSpans = spansFromRobJudgement(human).length
      ? spansFromRobJudgement(human)
      : spansFromRobJudgement(ai);
    app();
    rankRobEvidenceForCurrentQuestion().catch(() => null);
    return;
  }
  if (action === 'rob-add-selection') {
    addRobEvidenceSpan(state.robPendingSelection);
    state.robPendingSelection = '';
    const menu = document.getElementById('rob-selection-menu');
    if (menu) menu.hidden = true;
    window.getSelection()?.removeAllRanges();
    return;
  }
  if (action === 'rob-remove-evidence') {
    const index = Number(event.currentTarget.dataset.index);
    state.robEvidenceSpans = (state.robEvidenceSpans || []).filter((_, i) => i !== index);
    app();
    toast('已删除证据片段');
    return;
  }
  if (action === 'rob-use-evidence') {
    addRobEvidenceSpan(event.currentTarget.dataset.evidence || '');
    return;
  }
  if (action === 'show-ai-rob-evidence') {
    const ai = robJudgement(state.robQuestionKey, 'ai');
    state.robEvidenceSpans = spansFromRobJudgement(ai);
    app();
    return;
  }
  if (action === 'save-rob') { saveRobJudgement(); return; }
  if (action === 'run-rob-find') { runRobFindEvidence(); return; }
  if (action === 'run-rob-ai') { runRobAi(); return; }
  if (action === 'next-study') {
    const currentIndex = Math.max(0, state.robCitations.findIndex((item) => item.id === state.robCitationId));
    const next = state.robCitations[(currentIndex + 1) % Math.max(state.robCitations.length, 1)];
    if (next) refreshRobData(next.id).catch((err) => toast(err.message || '加载失败'));
    return;
  }
  if (action === 'dedupe') {
    const seen = new Set();
    const before = state.citations.length;
    state.citations = state.citations.filter((item) => {
      const key = (item.doi || item.title).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    auditEvent('运行文献去重', '检查 ' + before + ' 条记录，合并 ' + (before - state.citations.length) + ' 条重复项。', 'Library', 'Dedupe v1');
    app();
    toast('去重完成：合并 ' + (before - state.citations.length) + ' 条');
    return;
  }
  if (action === 'export-library') {
    downloadFile('qiuzheng-citations.csv', toCsv(state.citations, [{ key: 'title', label: 'Title' }, { key: 'authors', label: 'Authors' }, { key: 'source', label: 'Source' }, { key: 'doi', label: 'DOI' }, { key: 'fullText', label: 'Full text' }]), 'text/csv;charset=utf-8');
    toast('文献库 CSV 已导出');
    return;
  }
  if (action === 'export-audit') {
    downloadFile('qiuzheng-audit.csv', toCsv(state.audits, [{ key: 'time', label: 'Time' }, { key: 'actor', label: 'Actor' }, { key: 'module', label: 'Module' }, { key: 'action', label: 'Action' }, { key: 'detail', label: 'Detail' }, { key: 'version', label: 'Version' }]), 'text/csv;charset=utf-8');
    toast('审计日志已导出');
    return;
  }
  if (action === 'export-csv') {
    const rows = state.citations.map((citation) => Object.fromEntries([['study', citation.title], ...state.extractionFields.map((field) => [field.key, extractionValue(citation.id, field.id)?.value || ''])]));
    const columns = [{ key: 'study', label: 'Study' }, ...state.extractionFields.map((field) => ({ key: field.key, label: field.label }))];
    downloadFile('qiuzheng-extraction.csv', toCsv(rows, columns), 'text/csv;charset=utf-8');
    toast('已按当前字段方案导出数据提取 CSV');
    return;
  }
  if (action === 'export') {
    recomputeDerivedCounts();
    downloadFile('qiuzheng-project-status.json', JSON.stringify({ project: state.projectName, exportedAt: new Date().toISOString(), screeningRemaining: moduleCount('screening'), adjudicationRemaining: state.adjudicationRemaining, citations: state.citations.length }, null, 2), 'application/json');
    toast('项目状态已导出');
    return;
  }
  if (action === 'report-card') {
    const reports = [
      ['PRISMA 草稿', '基于当前导入与筛选计数'],
      ['检索策略附录', '导出当前概念编辑结果'],
      ['研究特征表', '来自提取字段与已填值'],
      ['偏倚风险结果', '来自已保存的 RoB 判断'],
      ['筛选汇总', '人工/AI 决策计数'],
      ['人机冲突清单', '当前分歧队列'],
    ];
    const report = reports[Number(event.currentTarget.dataset.report)] || reports[0];
    state.modal = 'report';
    state.modalPayload = { title: report[0], description: report[1] };
    app();
    return;
  }
  if (action === 'citation-more') {
    const id = event.currentTarget.dataset.id;
    const citation = state.citations.find((item) => item.id === id)
      || state.screeningQueue.find((item) => item.id === id)
      || null;
    state.modal = 'citation';
    state.modalPayload = citation || { id, title: '文献详情', abstract: '' };
    app();
    return;
  }
  if (action === 'library-clear-selection') {
    state.selectedLibrary = [];
    app();
    return;
  }
  if (action === 'library-delete-one') {
    openLibraryDeleteModal([event.currentTarget.dataset.id].filter(Boolean));
    return;
  }
  if (action === 'library-delete-selected') {
    openLibraryDeleteModal(state.selectedLibrary || []);
    return;
  }
  if (action === 'upload-fulltext') {
    const citationId = event.currentTarget.dataset.id;
    const citation = state.citations.find((item) => item.id === citationId)
      || includedForFulltext().find((item) => item.id === citationId);
    state.modal = 'upload-fulltext';
    state.modalPayload = { citationId, title: citation?.title || '' };
    app();
    return;
  }
  if (action === 'delete-fulltext') {
    const citationId = event.currentTarget.dataset.id;
    const citation = state.citations.find((item) => item.id === citationId)
      || includedForFulltext().find((item) => item.id === citationId);
    if (!citation?.hasPdf && !citation?.hasMd && !(citation?.fullTextMarkdown || '').trim()) {
      toast('当前没有可删除的全文');
      return;
    }
    state.modal = 'delete-fulltext';
    state.modalPayload = {
      citationId,
      title: citation?.title || '',
      hasPdf: Boolean(citation?.hasPdf),
      hasMd: Boolean(citation?.hasMd || (citation?.fullTextMarkdown || '').trim()),
    };
    app();
    return;
  }
  if (action === 'notification') { state.notificationsRead = true; persistState(); state.modal = 'notifications'; app(); return; }
  if (action === 'team') { state.modal = 'team'; app(); return; }
  if (action === 'history') { state.modal = 'history'; app(); return; }
  const messages = {
    'rob-guide': '当前评价使用 RoB 2 适配工作流；每条判断必须绑定原文证据。',
    'concept-more': '概念词表已保存在工作区',
  };
  toast(messages[action] || '操作已记录');
}

async function openLibraryDeleteModal(citationIds) {
  const ids = [...new Set((citationIds || []).map(String).filter(Boolean))];
  if (!ids.length) {
    toast('请先勾选要删除的文献');
    return;
  }
  try {
    toast(ids.length > 200 ? `正在检查 ${ids.length} 条文献…` : '正在检查删除影响…');
    const preview = await CitationApi.deletePreview(state.projectId, ids);
    if (!preview.items?.length) {
      toast('没有可删除的文献');
      return;
    }
    // Keep a short sample for the modal list; all ids are still deleted on confirm.
    const riskyItems = preview.items.filter((item) => item.hasDownstream);
    const sampleItems = (riskyItems.length ? riskyItems : preview.items).slice(0, 12);
    state.modal = 'delete-citations';
    state.modalPayload = {
      citationIds: preview.items.map((item) => item.id),
      items: sampleItems,
      totalCount: preview.items.length,
      riskyCount: preview.riskyCount || 0,
      safeCount: preview.safeCount || 0,
      confirmDownstream: Boolean(preview.riskyCount),
    };
    app();
  } catch (err) {
    toast(err.message || '无法预览删除影响');
  }
}

async function refreshAuthCaptcha() {
  state.captchaLoading = true;
  state.captchaImage = '';
  state.captchaId = '';
  try {
    const captcha = await AuthApi.captcha();
    state.captchaId = captcha.captchaId || '';
    state.captchaImage = captcha.image || '';
  } catch (err) {
    state.authError = err.message || '验证码加载失败';
  } finally {
    state.captchaLoading = false;
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.authError = '';
  const captchaId = String(data.captchaId || state.captchaId || '').trim();
  const captchaCode = String(data.captchaCode || '').trim();
  if (!captchaId || !captchaCode) {
    state.authError = '请填写验证码';
    app();
    return;
  }
  try {
    const payload = {
      email: data.email,
      password: data.password,
      captchaId,
      captchaCode,
    };
    const result = state.authMode === 'register'
      ? await AuthApi.register({ ...payload, name: data.name })
      : await AuthApi.login(payload);
    setAccessToken(result.accessToken);
    state.user = result.user;
    state.captchaId = '';
    state.captchaImage = '';
    await loadTeamsAndProjects();
    state.boot = 'picker';
    app();
  } catch (err) {
    state.authError = err.message || '认证失败';
    await refreshAuthCaptcha();
    app();
  }
}

async function handleCreateProject(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    let teamId = state.teams[0]?.id;
    if (!teamId) {
      const created = await TeamApi.create({ name: `${state.user.name}'s Team` });
      teamId = created.team.id;
      state.teams = [created.team];
    }
    const { project } = await ProjectApi.create({
      teamId,
      name: data.name.trim(),
      description: String(data.description || '').trim(),
    });
    await openProject(project.id);
  } catch (err) {
    toast(err.message || '创建失败');
  }
}

async function handleLogout() {
  try { await AuthApi.logout(); } catch { /* ignore */ }
  clearSession();
  state = { ...freshState(), boot: 'landing' };
  app();
}

async function loadTeamsAndProjects() {
  const [teamsRes, projectsRes, credRes, presetsRes] = await Promise.all([
    TeamApi.list(),
    ProjectApi.list(),
    CredentialApi.list(),
    CredentialApi.presets(),
  ]);
  state.teams = teamsRes.teams || [];
  state.projects = projectsRes.projects || [];
  state.credentials = credRes.credentials || [];
  state.llmPresets = presetsRes.presets || {};
}

async function openProject(projectId) {
  state.projectId = projectId;
  persistState();
  state.concepts = [];
  state.searchConceptId = '';
  state.searchStrategyDirty = false;
  state.searchStrategyUpdatedAt = null;
  state.pendingSearchStrategy = null;
  state.pendingSearchTerms = null;
  state.pendingMeshMap = null;
  state.pendingProtocolSuggestion = null;
  state.pendingProtocolCriteria = null;
  state.pendingQuestionDraft = null;
  state.assistantResult = null;
  state.lastAiQuestion = '';
  state.lastAiAnswer = '';
  await refreshProjectData();
  state.boot = 'workspace';
  if (!location.hash) history.replaceState(null, '', '#dashboard');
  app();
}

async function refreshScreeningQueue() {
  if (!state.projectId) return;
  const queue = await ScreeningApi.queueAll(state.projectId);
  state.screeningQueue = mapCitations(queue.citations || []);
  state.citationsTotal = Number(queue.total) || state.screeningQueue.length;
  state.screeningCompleted = (queue.citations || []).filter((c) =>
    (c.decisions || []).some((d) => d.actor === 'human'),
  ).length;
}

async function refreshExtractionData() {
  if (!state.projectId) return;
  const [fieldsRes, valuesRes] = await Promise.all([
    ExtractionApi.fields(state.projectId),
    ExtractionApi.values(state.projectId),
  ]);
  state.extractionFields = fieldsRes.fields || [];
  state.extractionValues = valuesRes.values || [];
}

async function rankRobEvidenceForCurrentQuestion() {
  const { domain, question } = robQuestionContext();
  if (!state.projectId || !state.robCitationId || !question) return;
  try {
    const res = await RiskOfBiasApi.rankEvidence(state.projectId, state.robCitationId, {
      query: `${domain?.title || ''}. ${question.text}`,
      topK: 6,
    });
    state.rankedEvidence = res.rankedEvidence || [];
    app();
  } catch (err) {
    state.rankedEvidence = [];
    if (err?.code === 'missing_embedding_credential') {
      /* silent until settings configured */
    }
  }
}

function spansFromRobJudgement(judgement) {
  if (!judgement) return [];
  if (Array.isArray(judgement.evidenceSpans) && judgement.evidenceSpans.length) {
    return judgement.evidenceSpans
      .map((row) => (typeof row === 'string' ? row : row?.text))
      .map((text) => String(text || '').trim())
      .filter(Boolean);
  }
  const text = String(judgement.evidenceText || '').trim();
  if (!text) return [];
  return text.split(/\n---\n/).map((part) => part.trim()).filter(Boolean);
}

function addRobEvidenceSpan(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 4) {
    toast('请先划选至少几个字的原文');
    return;
  }
  const existing = state.robEvidenceSpans || [];
  if (existing.some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase())) {
    toast('该片段已绑定');
    return;
  }
  state.robEvidenceSpans = [...existing, text];
  app();
  toast('已加入评估证据');
}

async function refreshRobData(citationId = '') {
  if (!state.projectId) return;
  const result = await RiskOfBiasApi.get(state.projectId, citationId || undefined);
  state.robDomains = result.domains || [];
  state.robCitations = result.citations || [];
  state.robCitationId = result.citationId || '';
  state.robJudgements = result.judgements || [];
  const allQuestions = state.robDomains.flatMap((domain) => domain.questions);
  if (!allQuestions.some((question) => question.key === state.robQuestionKey)) state.robQuestionKey = allQuestions[0]?.key || '';
  const human = robJudgement(state.robQuestionKey, 'human');
  const ai = robJudgement(state.robQuestionKey, 'ai');
  state.robEvidenceSpans = spansFromRobJudgement(human).length
    ? spansFromRobJudgement(human)
    : spansFromRobJudgement(ai);
  app();
  rankRobEvidenceForCurrentQuestion().catch(() => null);
}

async function saveRobJudgement() {
  const { domain, question } = robQuestionContext();
  const spans = state.robEvidenceSpans || [];
  if (!state.robCitationId || !domain || !question || !spans.length) return;
  const answer = document.getElementById('rob-answer')?.value;
  const judgement = document.getElementById('rob-judgement')?.value;
  const rationale = document.getElementById('rob-rationale')?.value || '';
  try {
    await RiskOfBiasApi.saveHuman(state.projectId, state.robCitationId, {
      domainKey: domain.key,
      questionKey: question.key,
      answer,
      judgement,
      evidenceSpans: spans,
      sourceLocation: state.rankedEvidence?.length ? 'Embedding-ranked source' : 'Full text',
      rationale,
      confidence: 'High',
    });
    await refreshRobData(state.robCitationId);
    toast(question.key + ' 已保存（' + spans.length + ' 段证据）');
  } catch (err) {
    toast(err.message || '偏倚风险判断保存失败');
  }
}

async function runRobFindEvidence() {
  if (!state.credentialId) { toast('请先在项目设置中选择模型凭据'); return; }
  const { domain, question } = robQuestionContext();
  if (!state.robCitationId || !domain || !question || state.robBusy) return;
  state.robBusy = true;
  app();
  try {
    const res = await RiskOfBiasApi.findEvidence(state.projectId, state.robCitationId, {
      domainKey: domain.key,
      questionKey: question.key,
      credentialId: state.credentialId,
      useLlm: true,
    });
    state.rankedEvidence = res.rankedEvidence || [];
    const found = (res.evidenceSpans || [])
      .map((row) => (typeof row === 'string' ? row : row?.text))
      .map((text) => String(text || '').trim())
      .filter(Boolean);
    let added = 0;
    for (const text of found) {
      const exists = (state.robEvidenceSpans || []).some((item) => item.toLocaleLowerCase() === text.toLocaleLowerCase());
      if (exists) continue;
      state.robEvidenceSpans = [...(state.robEvidenceSpans || []), text];
      added += 1;
    }
    const rejected = Number(res.rejectedCount || 0);
    toast(
      (added ? `已加入 ${added} 段可校验原文` : '未找到新的可校验原文')
      + (rejected ? `（丢弃 ${rejected} 条未通过校验）` : '')
      + (res.cacheHit ? ' · embedding 缓存命中' : ''),
    );
  } catch (err) {
    toast(formatUserFacingError(err) || 'AI 找原文失败');
  } finally {
    state.robBusy = false;
    app();
  }
}

async function runRobAi() {
  if (!state.credentialId) { toast('请先在项目设置中选择模型凭据'); return; }
  const { domain, question } = robQuestionContext();
  if (!state.robCitationId || !domain || !question || state.robBusy) return;
  state.robBusy = true;
  app();
  try {
    const res = await RiskOfBiasApi.runAi(state.projectId, state.robCitationId, {
      domainKey: domain.key,
      questionKey: question.key,
      credentialId: state.credentialId,
      evidenceSpans: state.robEvidenceSpans || [],
    });
    state.rankedEvidence = res.rankedEvidence || [];
    await refreshRobData(state.robCitationId);
    const fromAi = spansFromRobJudgement(res.judgement);
    if (fromAi.length) state.robEvidenceSpans = fromAi;
    toast(res.usedEmbeddings
      ? `AI 评估已完成${res.cacheHit ? '（embedding 缓存命中）' : ''}`
      : 'AI 评估已完成（未使用 Embedding）');
  } catch (err) {
    toast(formatUserFacingError(err) || 'AI 偏倚风险判断失败');
  } finally {
    state.robBusy = false;
    app();
  }
}

async function refreshProjectData() {
  const [projectRes, citationsRes, auditRes, protocolsRes, fieldsRes, valuesRes, robRes] = await Promise.all([
    ProjectApi.get(state.projectId),
    CitationApi.listAll(state.projectId),
    AuditApi.list(state.projectId, { take: '100' }),
    ProtocolApi.list(state.projectId),
    ExtractionApi.fields(state.projectId),
    ExtractionApi.values(state.projectId),
    RiskOfBiasApi.get(state.projectId, state.robCitationId || undefined),
  ]);
  const project = projectRes.project;
  state.role = projectRes.role;
  state.projectName = project.name;
  state.projectDescription = project.description || '';
  state.question = project.question || project.protocolVersions?.[0]?.question || '';
  state.llmResponseLanguage = project.llmResponseLanguage === 'en' ? 'en' : 'zh';
  state.hasPubmedApiKey = Boolean(project.hasPubmedApiKey);
  state.pubmedApiKeyLast4 = project.pubmedApiKeyLast4 || '';
  state.credentialId = project.credentialId || '';
  state.embeddingCredentialId = project.embeddingCredentialId || '';
  state.embeddingModel = project.embeddingModel || '';
  state.criteria = mapCriteriaFromProtocol(project.protocolVersions?.[0] || protocolsRes.versions?.[0]);
  state.pico = mapPicoFromProtocol(project.protocolVersions?.[0] || protocolsRes.versions?.[0]);
  state.protocolVersions = protocolsRes.versions || project.protocolVersions || [];
  state.protocolVersion = state.protocolVersions[0]?.version || null;
  state.projectMembers = project.members || [];
  state.citations = mapCitations(citationsRes.citations || []);
  state.citationsTotal = Number(citationsRes.total) || state.citations.length;
  state.audits = mapAudits(auditRes.events || []);
  state.extractionFields = fieldsRes.fields || [];
  state.extractionValues = valuesRes.values || [];
  state.robDomains = robRes.domains || [];
  state.robCitations = robRes.citations || [];
  state.robCitationId = robRes.citationId || '';
  state.robJudgements = robRes.judgements || [];
  const firstRobQuestion = state.robDomains.flatMap((domain) => domain.questions)[0];
  if (!state.robDomains.some((domain) => domain.questions.some((question) => question.key === state.robQuestionKey))) state.robQuestionKey = firstRobQuestion?.key || '';
  const savedRobSpans = spansFromRobJudgement(robJudgement(state.robQuestionKey, 'human')).length
    ? spansFromRobJudgement(robJudgement(state.robQuestionKey, 'human'))
    : spansFromRobJudgement(robJudgement(state.robQuestionKey, 'ai'));
  state.robEvidenceSpans = savedRobSpans;
  await refreshScreeningQueue();
  await refreshMetaData().catch(() => null);
  await refreshSynthesisList().catch(() => null);
  await loadSearchStrategy();
  const credRes = await CredentialApi.list();
  state.credentials = credRes.credentials || [];
  recomputeDerivedCounts();
}

async function refreshMetaData(analysisId = '') {
  if (!state.projectId) return;
  const list = await MetaApi.listAnalyses(state.projectId);
  state.metaAnalyses = list.analyses || [];
  const preferred = analysisId || state.metaAnalysisId || state.metaAnalyses[0]?.id || '';
  state.metaAnalysisId = preferred;
  if (preferred) {
    const detail = await MetaApi.getAnalysis(state.projectId, preferred);
    state.metaDetail = detail.analysis || null;
  } else {
    state.metaDetail = null;
  }
}

async function refreshSynthesisList() {
  if (!state.projectId) return;
  const res = await SynthesisApi.listComposes(state.projectId);
  state.synthesisComposes = res.composes || [];
}

async function saveSettings(data) {
  try {
    const thinkingEnabled = data.thinkingEnabled === 'on';
    if (data.apiKey?.trim()) {
      const preset = state.llmPresets[data.provider];
      const created = await CredentialApi.create({
        name: data.credName?.trim() || `${data.provider} chat`,
        provider: data.provider,
        baseUrl: data.baseUrl?.trim() || undefined,
        apiKey: data.apiKey.trim(),
        defaultModel: data.defaultModel?.trim() || preset?.defaultModel || 'gpt-4o-mini',
        thinkingEnabled,
      });
      state.credentials = [...state.credentials, created.credential];
      data.credentialId = created.credential.id;
      toast('聊天 API Key 已加密保存');
    } else if (data.credentialId) {
      const updated = await CredentialApi.update(data.credentialId, { thinkingEnabled });
      state.credentials = state.credentials.map((c) => (c.id === updated.credential.id ? updated.credential : c));
    }

    let embeddingCredentialId = data.embeddingCredentialId || null;
    if (data.embApiKey?.trim()) {
      const embProvider = data.embProvider || 'openai';
      const embPreset = state.llmPresets[embProvider];
      const createdEmb = await CredentialApi.create({
        name: data.embName?.trim() || `${embProvider} embedding`,
        provider: embProvider,
        baseUrl: data.embBaseUrl?.trim() || embPreset?.baseUrl || undefined,
        apiKey: data.embApiKey.trim(),
        defaultModel: data.embeddingModel?.trim() || embPreset?.defaultEmbeddingModel || embPreset?.defaultModel || 'text-embedding-3-small',
        thinkingEnabled: false,
      });
      state.credentials = [...state.credentials, createdEmb.credential];
      embeddingCredentialId = createdEmb.credential.id;
      toast('Embedding API Key 已加密保存为独立凭据');
    }

    await ProjectApi.update(state.projectId, {
      name: data.name.trim(),
      description: String(data.description || '').trim(),
      llmResponseLanguage: data.llmResponseLanguage === 'en' ? 'en' : 'zh',
      credentialId: data.credentialId || null,
      embeddingCredentialId,
      embeddingModel: data.embeddingModel?.trim() || '',
      ...(data.clearPubmedApiKey === 'on'
        ? { clearPubmedApiKey: true }
        : (data.pubmedApiKey?.trim() ? { pubmedApiKey: data.pubmedApiKey.trim() } : {})),
    });
    state.projectName = data.name.trim();
    state.projectDescription = String(data.description || '').trim();
    state.llmResponseLanguage = data.llmResponseLanguage === 'en' ? 'en' : 'zh';
    state.credentialId = data.credentialId || '';
    state.embeddingCredentialId = embeddingCredentialId || '';
    state.embeddingModel = data.embeddingModel?.trim() || '';
    if (data.clearPubmedApiKey === 'on') {
      state.hasPubmedApiKey = false;
      state.pubmedApiKeyLast4 = '';
    } else if (data.pubmedApiKey?.trim()) {
      state.hasPubmedApiKey = true;
      state.pubmedApiKeyLast4 = data.pubmedApiKey.trim().slice(-4);
    }
    state.modal = null;
    state.modalPayload = null;
    await refreshProjectData();
    app();
    toast('项目设置已保存');
  } catch (err) {
    toast(err.message || '保存失败');
  }
}

async function boot() {
  app();
  if (!getAccessToken()) {
    state.boot = 'landing';
    app();
    return;
  }
  try {
    const me = await AuthApi.me();
    state.user = me.user;
    await loadTeamsAndProjects();
    if (state.projectId && state.projects.some((p) => p.id === state.projectId)) {
      await openProject(state.projectId);
    } else {
      state.boot = 'picker';
      app();
    }
  } catch {
    clearSession();
    state.boot = 'landing';
    app();
  }
}

window.onhashchange = () => {
  const page = location.hash.slice(1);
  if (titleMap[page] && page !== state.active) { state.active = page; state.modal = null; state.modalPayload = null; app(); }
};

setSessionExpiredHandler((message) => {
  if (state.boot === 'auth' || state.boot === 'landing') return;
  clearSession();
  state = { ...freshState(), boot: 'auth', authMode: 'login', authError: message || '登录已过期，请重新登录' };
  app();
});

boot();
