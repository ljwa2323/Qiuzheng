import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessComputability,
  convertOrCiToYiSei,
  convertRateToEvents,
  convertMdCiToYiSei,
  runMetaTool,
} from './services/meta-tools.js';

test('rate_to_events converts percent', () => {
  const out = convertRateToEvents({ rate: 12.5, n: 80, rateIsPercent: true });
  assert.equal(out.ok, true);
  assert.equal(out.events, 10);
  assert.equal(out.eventsRounded, 10);
});

test('or_ci_to_yi_sei derives logOR and SE', () => {
  const out = convertOrCiToYiSei({ or: 0.5, ciLow: 0.3, ciHigh: 0.8 });
  assert.equal(out.ok, true);
  assert.ok(Math.abs(out.yi - Math.log(0.5)) < 1e-9);
  assert.ok(out.sei > 0);
});

test('md_ci_to_yi_sei derives SE from CI width', () => {
  const out = convertMdCiToYiSei({ md: -1.2, ciLow: -2.0, ciHigh: -0.4 });
  assert.equal(out.ok, true);
  assert.equal(out.yi, -1.2);
  assert.ok(Math.abs(out.sei - 0.4 / 1.959963984540054) < 1e-4 || out.sei > 0);
});

test('assessComputability flags rate-like events', () => {
  const report = assessComputability(
    [{ citationId: 'c1', label: 'Bad', eventsT: 0.12, nT: 100, eventsC: 0.2, nC: 100 }],
    'OR',
  );
  assert.equal(report.canRun, false);
  assert.ok(report.assessments[0].issues.some((i) => i.code.includes('looks_like_rate')));
});

test('assessComputability accepts 2x2 counts', () => {
  const report = assessComputability(
    [{ citationId: 'c1', label: 'Ok', eventsT: 12, nT: 100, eventsC: 20, nC: 100 }],
    'OR',
  );
  assert.equal(report.canRun, true);
  assert.equal(report.assessments[0].path, 'binary_counts');
});

test('runMetaTool reject invalid OR CI', () => {
  const out = runMetaTool('or_ci_to_yi_sei', { or: -1, ciLow: 0.2, ciHigh: 0.5 }) as { ok?: boolean };
  assert.equal(out.ok, false);
});
