import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEvidenceQuote,
  parseRiskOfBiasJson,
  validateEvidenceSpans,
  joinEvidenceText,
} from './routes/risk-of-bias.js';

test('risk-of-bias JSON parser accepts evidenceQuotes array', () => {
  const result = parseRiskOfBiasJson(JSON.stringify({
    answer: 'Probably yes',
    judgement: 'Some concerns',
    evidenceQuotes: ['Allocation concealment was not described.'],
    sourceLocation: 'Abstract',
    rationale: 'Reporting is incomplete.',
    confidence: 'Moderate',
  }));
  assert.equal(result.answer, 'Probably yes');
  assert.equal(result.judgement, 'Some concerns');
  assert.equal(result.evidenceQuotes.length, 1);
});

test('risk-of-bias JSON parser rejects unknown judgement values', () => {
  assert.throws(() => parseRiskOfBiasJson('{"answer":"Maybe","judgement":"Unknown"}'));
});

test('evidence normalization returns the exact source slice and rejects inventions', () => {
  const source = 'The reference standard was blinded to model output.';
  assert.equal(normalizeEvidenceQuote(source, 'reference STANDARD was blinded'), 'reference standard was blinded');
  assert.equal(normalizeEvidenceQuote(source, 'allocation was concealed'), '');
});

test('validateEvidenceSpans accepts exact quotes and rejects inventions', () => {
  const source = 'Randomization used a computer-generated sequence. Allocation was concealed.';
  const { accepted, rejected } = validateEvidenceSpans(source, [
    'computer-generated sequence',
    'invented claim',
    'Allocation was concealed.',
  ], 'ai');
  assert.equal(accepted.length, 2);
  assert.equal(rejected, 1);
  assert.ok(joinEvidenceText(accepted).includes('Allocation was concealed.'));
});
