import test from 'node:test';
import assert from 'node:assert/strict';
import {
  csvEscape,
  matchesQuery,
  parseBibtexCitations,
  parseCitationFile,
  parseDelimited,
  parsePubMedXmlCitations,
  parseRisCitations,
  toCsv,
} from '../core.js';

test('CSV parser preserves commas, quotes and line breaks inside quoted fields', () => {
  const rows = parseDelimited('title,abstract\r\n"A, B","He said ""yes""\nand left"');
  assert.deepEqual(rows, [['title', 'abstract'], ['A, B', 'He said "yes"\nand left']]);
});

test('RIS parser maps title, authors, year, DOI and abstract', () => {
  const [record] = parseRisCitations(`TY  - JOUR\nTI  - Evidence synthesis\nAU  - Luo, Jiawei\nAU  - Wang, Qiao\nPY  - 2026\nDO  - 10.1/test\nAB  - Useful abstract\nER  -`);
  assert.equal(record.title, 'Evidence synthesis');
  assert.match(record.authors, /Luo, Jiawei; Wang, Qiao · 2026/);
  assert.equal(record.doi, '10.1/test');
  assert.equal(record.completeness, 72);
});

test('BibTeX parser reads common fields', () => {
  const [record] = parseBibtexCitations('@article{x, title={Human AI review}, author={A and B}, year={2025}, doi={10.2/x}, abstract={Study abstract}}');
  assert.equal(record.title, 'Human AI review');
  assert.equal(record.doi, '10.2/x');
});

test('PubMed XML parser reads multiple authors and article metadata', () => {
  const xml = `<PubmedArticleSet><PubmedArticle><Article><ArticleTitle>Screening study</ArticleTitle><Abstract><AbstractText>Results</AbstractText></Abstract><AuthorList><Author><LastName>Li</LastName><Initials>K</Initials></Author></AuthorList><Journal><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal></Article><PubmedData><ArticleIdList><ArticleId IdType="doi">10.3/y</ArticleId></ArticleIdList></PubmedData></PubmedArticle></PubmedArticleSet>`;
  const [record] = parsePubMedXmlCitations(xml);
  assert.equal(record.title, 'Screening study');
  assert.equal(record.authors, 'Li K · 2024');
  assert.equal(record.doi, '10.3/y');
});

test('format router rejects unsupported formats', () => {
  assert.throws(() => parseCitationFile('', 'EndNote', 'test'), /Unsupported/);
});

test('CSV output escapes dangerous values and starts with a UTF-8 BOM', () => {
  assert.equal(csvEscape('a,"b"'), '"a,""b"""');
  const csv = toCsv([{ title: 'A, B' }], [{ key: 'title', label: '题目' }]);
  assert.equal(csv, '\uFEFF题目\r\n"A, B"');
});

test('query matching is case-insensitive across fields', () => {
  assert.equal(matchesQuery(['Qiuzheng', 'Evidence'], 'ZHENG'), true);
  assert.equal(matchesQuery(['Qiuzheng'], 'missing'), false);
});
