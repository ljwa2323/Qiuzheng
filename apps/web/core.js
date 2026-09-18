export const SUPPORTED_IMPORT_FORMATS = ['RIS', 'BibTeX', 'CSV', 'PubMed XML', 'PubMed NBIB'];

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function highlightEvidenceHtml(source = '', evidence = '', options = {}) {
  const text = String(source || '');
  const quotes = Array.isArray(evidence)
    ? evidence.map((q) => String(q || '').trim()).filter(Boolean)
    : (String(evidence || '').trim() ? [String(evidence).trim()] : []);
  const anchorId = options.anchorId || 'extract-evidence-anchor';
  if (!text.trim()) return '<span class="muted">无可用原文</span>';
  if (!quotes.length) {
    const preview = options.fullText ? text : (text.length > 1800 ? `${text.slice(0, 1800)}…` : text);
    return escapeHtml(preview);
  }

  const lower = text.toLowerCase();
  const ranges = [];
  for (const quote of quotes) {
    let from = 0;
    const needle = quote.toLowerCase();
    while (from < text.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      ranges.push({ start: idx, end: idx + quote.length });
      from = idx + Math.max(quote.length, 1);
      if (!options.markAll) break;
    }
  }
  if (!ranges.length) {
    const preview = options.fullText ? text : (text.length > 1200 ? `${text.slice(0, 1200)}…` : text);
    return `${escapeHtml(preview)}<p class="muted extract-trace-miss">未能在原文中定位该证据片段（可能已被编辑）。</p>`;
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  if (!options.fullText && merged.length === 1) {
    const { start: idx, end } = merged[0];
    const quoteLen = end - idx;
    const radius = 520;
    const start = Math.max(0, idx - radius);
    const stop = Math.min(text.length, end + radius);
    const before = `${start > 0 ? '…' : ''}${text.slice(start, idx)}`;
    const mid = text.slice(idx, end);
    const after = `${text.slice(end, stop)}${stop < text.length ? '…' : ''}`;
    return `${escapeHtml(before)}<mark class="evidence-highlight" id="${escapeHtml(anchorId)}">${escapeHtml(mid)}</mark>${escapeHtml(after)}`;
  }

  let html = '';
  let cursor = 0;
  merged.forEach((range, i) => {
    html += escapeHtml(text.slice(cursor, range.start));
    const idAttr = i === 0 ? ` id="${escapeHtml(anchorId)}"` : '';
    html += `<mark class="evidence-highlight"${idAttr}>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  });
  html += escapeHtml(text.slice(cursor));
  return html;
}

/** Find the first needle that appears in source (case-insensitive). */
export function findEvidenceNeedle(source = '', needles = []) {
  const text = String(source || '');
  const lower = text.toLowerCase();
  for (const raw of needles) {
    const needle = String(raw || '').trim();
    if (!needle || needle.length < 2) continue;
    if (lower.includes(needle.toLowerCase())) return needle;
  }
  return '';
}

export function normaliseText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

export function csvEscape(value = '') {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, columns) {
  const header = columns.map(({ label }) => csvEscape(label)).join(',');
  const body = rows.map(row => columns.map(({ key }) => csvEscape(row[key])).join(',')).join('\r\n');
  return `\uFEFF${header}${body ? `\r\n${body}` : ''}`;
}

export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ''));
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function first(record, names) {
  for (const name of names) {
    const value = record[name];
    if (value != null && normaliseText(value)) return normaliseText(value);
  }
  return '';
}

function makeCitation(record, index, source) {
  const title = first(record, ['title', 'ti', 't1', 'article title']) || `Untitled record ${index + 1}`;
  const author = first(record, ['authors', 'author', 'au', 'a1']) || 'Unknown author';
  const year = first(record, ['year', 'py', 'y1', 'date'])?.match(/\b(?:19|20)\d{2}\b/)?.[0] || 'n.d.';
  const doi = first(record, ['doi', 'do', 'l3']);
  const abstract = first(record, ['abstract', 'ab', 'n2']);
  return {
    id: `import-${Date.now()}-${index}`,
    title,
    authors: `${author} · ${year}`,
    source,
    hits: 1,
    fullText: 'Missing',
    completeness: abstract ? 72 : 45,
    doi,
    abstract,
  };
}

export function parseCsvCitations(text, source = 'CSV import') {
  const rows = parseDelimited(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => normaliseText(value).toLowerCase());
  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']));
    return makeCitation(record, index, source);
  });
}

export function parseRisCitations(text, source = 'RIS import') {
  const records = [];
  let current = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
    if (!match) continue;
    const [, rawTag, rawValue] = match;
    const tag = rawTag.toLowerCase();
    const value = normaliseText(rawValue);
    if (tag === 'ty' && Object.keys(current).length) current = {};
    if (tag === 'er') {
      if (Object.keys(current).length) records.push(current);
      current = {};
      continue;
    }
    if (tag === 'au' || tag === 'a1') {
      current.author = [current.author, value].filter(Boolean).join('; ');
    } else if (tag === 'ab' || tag === 'n2') {
      current.abstract = [current.abstract, value].filter(Boolean).join(' ');
    } else if (!current[tag]) {
      current[tag] = value;
    }
  }
  if (Object.keys(current).length) records.push(current);
  return records.map((record, index) => makeCitation(record, index, source));
}

/** PubMed Citation Manager .nbib / MEDLINE tagged format. */
export function parseNbibCitations(text, source = 'PubMed NBIB import') {
  const records = [];
  let current = {};
  let lastTag = '';

  const flush = () => {
    if (Object.keys(current).length) {
      if (!current.author && current.fau) current.author = current.fau;
      if (current.abstract) current.abstract = normaliseText(current.abstract);
      if (current.title) current.title = normaliseText(current.title);
      records.push(current);
    }
    current = {};
    lastTag = '';
  };

  const extractDoi = (value) => {
    const match = String(value || '').match(/10\.\d{4,}\/[^\s\[\]]+/i);
    return match ? match[0].replace(/\.+$/, '') : '';
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const tagged = rawLine.match(/^([A-Z][A-Z0-9]{0,3})\s*-\s?(.*)$/);
    if (tagged) {
      const tag = tagged[1].toUpperCase();
      const value = tagged[2] ?? '';
      if (tag === 'PMID' && Object.keys(current).length) flush();
      lastTag = tag;

      if (tag === 'AU') {
        const author = normaliseText(value);
        if (author) current.author = [current.author, author].filter(Boolean).join('; ');
      } else if (tag === 'FAU') {
        const author = normaliseText(value);
        if (author) current.fau = [current.fau, author].filter(Boolean).join('; ');
      } else if (tag === 'AB') {
        current.abstract = [current.abstract, value.trim()].filter(Boolean).join(' ');
      } else if (tag === 'TI') {
        current.title = [current.title, value.trim()].filter(Boolean).join(' ');
      } else if (tag === 'DP' || tag === 'YR') {
        if (!current.year) current.year = normaliseText(value);
      } else if (tag === 'LID' || tag === 'AID') {
        const doi = extractDoi(value);
        if (doi && !current.doi) current.doi = doi;
      } else if (tag === 'PMID') {
        current.pmid = normaliseText(value);
      }
      continue;
    }

    if (/^\s+\S/.test(rawLine) && lastTag) {
      const cont = rawLine.trim();
      if (lastTag === 'AB') {
        current.abstract = [current.abstract, cont].filter(Boolean).join(' ');
      } else if (lastTag === 'TI') {
        current.title = [current.title, cont].filter(Boolean).join(' ');
      }
    }
  }
  flush();

  return records.map((record, index) => makeCitation({
    title: record.title || '',
    author: record.author || '',
    year: record.year || '',
    abstract: record.abstract || '',
    doi: record.doi || '',
  }, index, source));
}

export function parseBibtexCitations(text, source = 'BibTeX import') {
  const entries = text.split(/(?=@[A-Za-z]+\s*\{)/).filter(chunk => chunk.trim().startsWith('@'));
  return entries.map((entry, index) => {
    const record = {};
    const fieldPattern = /(title|author|year|doi|abstract)\s*=\s*(?:\{([\s\S]*?)\}|"([\s\S]*?)")\s*,?/gi;
    let match;
    while ((match = fieldPattern.exec(entry))) {
      record[match[1].toLowerCase()] = normaliseText(match[2] ?? match[3]);
    }
    return makeCitation(record, index, source);
  });
}

function decodeXml(value = '') {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function xmlValue(block, tag) {
  return normaliseText(decodeXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || ''));
}

export function parsePubMedXmlCitations(text, source = 'PubMed XML import') {
  const articles = text.match(/<PubmedArticle\b[\s\S]*?<\/PubmedArticle>/gi) || [];
  return articles.map((article, index) => {
    const authors = [...article.matchAll(/<Author\b[\s\S]*?<\/Author>/gi)]
      .map(match => [xmlValue(match[0], 'LastName'), xmlValue(match[0], 'Initials')].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('; ');
    const doiMatch = article.match(/<ArticleId[^>]*IdType=["']doi["'][^>]*>([\s\S]*?)<\/ArticleId>/i);
    return makeCitation({
      title: xmlValue(article, 'ArticleTitle'),
      author: authors,
      year: xmlValue(article, 'Year'),
      abstract: xmlValue(article, 'AbstractText'),
      doi: normaliseText(decodeXml(doiMatch?.[1] || '')),
    }, index, source);
  });
}

export function parseCitationFile(text, format, source) {
  const selected = normaliseText(format).toLowerCase();
  if (selected === 'ris') return parseRisCitations(text, source);
  if (selected === 'bibtex') return parseBibtexCitations(text, source);
  if (selected === 'csv') return parseCsvCitations(text, source);
  if (selected === 'pubmed xml') return parsePubMedXmlCitations(text, source);
  if (
    selected === 'pubmed nbib'
    || selected === 'nbib'
    || selected === 'medline'
    || selected === 'pubmed medline'
  ) {
    return parseNbibCitations(text, source);
  }
  throw new Error(`Unsupported import format: ${format}`);
}

export function matchesQuery(values, query) {
  const needle = normaliseText(query).toLocaleLowerCase();
  if (!needle) return true;
  return values.some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
}

