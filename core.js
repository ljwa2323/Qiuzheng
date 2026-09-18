export const SUPPORTED_IMPORT_FORMATS = ['RIS', 'BibTeX', 'CSV', 'PubMed XML'];

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
  throw new Error(`Unsupported import format: ${format}`);
}

export function matchesQuery(values, query) {
  const needle = normaliseText(query).toLocaleLowerCase();
  if (!needle) return true;
  return values.some(value => String(value ?? '').toLocaleLowerCase().includes(needle));
}

