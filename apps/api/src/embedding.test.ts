import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, splitSourceSpans } from './services/llm.js';

test('cosineSimilarity returns 1 for identical vectors', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test('cosineSimilarity is lower for orthogonal vectors', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
});

test('splitSourceSpans keeps readable chunks', () => {
  const spans = splitSourceSpans(
    'Randomization used a computer-generated sequence. Allocation was concealed with sealed envelopes. Blinding was incomplete for outcome assessors.',
  );
  assert.ok(spans.length >= 1);
  assert.ok(spans.join(' ').includes('Randomization'));
});
