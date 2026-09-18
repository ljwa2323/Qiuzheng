export type ParsedCitation = {
  title: string;
  authors: string;
  year: string;
  abstract: string;
  doi: string;
};

function normaliseText(value = ''): string {
  return String(value).trim().replace(/\s+/g, ' ');
}

function first(record: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (value != null && normaliseText(value)) return normaliseText(value);
  }
  return '';
}

function makeCitation(record: Record<string, string>, index: number): ParsedCitation {
  const title = first(record, ['title', 'ti', 't1', 'article title']) || `Untitled record ${index + 1}`;
  const author = first(record, ['authors', 'author', 'au', 'a1']) || 'Unknown author';
  const year = first(record, ['year', 'py', 'y1', 'date'])?.match(/\b(?:19|20)\d{2}\b/)?.[0] || 'n.d.';
  const doi = first(record, ['doi', 'do', 'l3']);
  const abstract = first(record, ['abstract', 'ab', 'n2']);
  return { title, authors: author, year, abstract, doi };
}

function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.replace(/\r$/, ''));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseCsvCitations(text: string): ParsedCitation[] {
  const rows = parseDelimited(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => normaliseText(value).toLowerCase());
  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, i) => [header, values[i] || '']));
    return makeCitation(record, index);
  });
}

export function parseRisCitations(text: string): ParsedCitation[] {
  const records: Record<string, string>[] = [];
  let current: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
    if (!match) continue;
    const tag = match[1].toLowerCase();
    const value = normaliseText(match[2]);
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
  return records.map((record, index) => makeCitation(record, index));
}

/** PubMed Citation Manager .nbib / MEDLINE tagged format (PMID-, TI  -, AU  -, ...). */
export function parseNbibCitations(text: string): ParsedCitation[] {
  const records: Record<string, string>[] = [];
  let current: Record<string, string> = {};
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

  const extractDoi = (value: string) => {
    const match = value.match(/10\.\d{4,}\/[^\s\[\]]+/i);
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

  return records.map((record, index) =>
    makeCitation(
      {
        title: record.title || '',
        author: record.author || '',
        year: record.year || '',
        abstract: record.abstract || '',
        doi: record.doi || '',
      },
      index,
    ),
  );
}

export function parseBibtexCitations(text: string): ParsedCitation[] {
  const entries = text.split(/(?=@[A-Za-z]+\s*\{)/).filter((chunk) => chunk.trim().startsWith('@'));
  return entries.map((entry, index) => {
    const record: Record<string, string> = {};
    const fieldPattern = /(title|author|year|doi|abstract)\s*=\s*(?:\{([\s\S]*?)\}|"([\s\S]*?)")\s*,?/gi;
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(entry))) {
      record[match[1].toLowerCase()] = normaliseText(match[2] ?? match[3] ?? '');
    }
    return makeCitation(record, index);
  });
}

function decodeXml(value = ''): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function xmlValue(block: string, tag: string): string {
  return normaliseText(
    decodeXml(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || ''),
  );
}

export function parsePubMedXmlCitations(text: string): ParsedCitation[] {
  const articles = text.match(/<PubmedArticle\b[\s\S]*?<\/PubmedArticle>/gi) || [];
  return articles.map((article, index) => {
    const authors = [...article.matchAll(/<Author\b[\s\S]*?<\/Author>/gi)]
      .map((m) => [xmlValue(m[0], 'LastName'), xmlValue(m[0], 'Initials')].filter(Boolean).join(' '))
      .filter(Boolean)
      .join('; ');
    const doiMatch = article.match(/<ArticleId[^>]*IdType=["']doi["'][^>]*>([\s\S]*?)<\/ArticleId>/i);
    return makeCitation(
      {
        title: xmlValue(article, 'ArticleTitle'),
        author: authors,
        year: xmlValue(article, 'Year'),
        abstract: xmlValue(article, 'AbstractText'),
        doi: normaliseText(decodeXml(doiMatch?.[1] || '')),
      },
      index,
    );
  });
}

export function parseCitationFile(text: string, format: string): ParsedCitation[] {
  const selected = normaliseText(format).toLowerCase();
  if (selected === 'ris') return parseRisCitations(text);
  if (selected === 'bibtex') return parseBibtexCitations(text);
  if (selected === 'csv') return parseCsvCitations(text);
  if (selected === 'pubmed xml' || selected === 'pubmed_xml') return parsePubMedXmlCitations(text);
  if (
    selected === 'pubmed nbib'
    || selected === 'nbib'
    || selected === 'medline'
    || selected === 'pubmed medline'
  ) {
    return parseNbibCitations(text);
  }
  throw new Error(`Unsupported import format: ${format}`);
}
