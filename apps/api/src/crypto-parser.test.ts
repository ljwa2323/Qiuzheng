import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRisCitations, parseNbibCitations, parseCitationFile } from './services/citation-parser.js';

test('parse RIS citations', () => {
  const text = `TY  - JOUR
TI  - Example title
AU  - Doe J
PY  - 2024
AB  - An abstract
DO  - 10.1000/example
ER  - 
`;
  const rows = parseRisCitations(text);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Example title');
  assert.equal(rows[0].doi, '10.1000/example');
});

test('parse NBIB / MEDLINE citations with wrapped abstract', () => {
  const text = `PMID- 37952131
TI  - Semaglutide and Cardiovascular Outcomes in Obesity without Diabetes.
LID - 10.1056/NEJMoa2307563 [doi]
AB  - BACKGROUND: Semaglutide reduces risk
      in patients with obesity.
DP  - 2023 Dec 14
AU  - Lincoff AM
AU  - Brown-Frandsen K
PMID- 11111111
TI  - Second paper
DP  - 2022
AU  - Smith J
`;
  const rows = parseNbibCitations(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, 'Semaglutide and Cardiovascular Outcomes in Obesity without Diabetes.');
  assert.equal(rows[0].doi, '10.1056/NEJMoa2307563');
  assert.equal(rows[0].year, '2023');
  assert.match(rows[0].authors, /Lincoff AM; Brown-Frandsen K/);
  assert.match(rows[0].abstract, /BACKGROUND: Semaglutide reduces risk in patients with obesity/);
  assert.equal(rows[1].title, 'Second paper');
  assert.equal(parseCitationFile(text, 'PubMed NBIB').length, 2);
});

test('parseCitationFile rejects unknown format', () => {
  assert.throws(() => parseCitationFile('x', 'unknown'));
});

test('sha256 helper length', () => {
  assert.equal(createHash('sha256').update('sk-test-secret').digest('hex').length, 64);
});
