import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runCumulative,
  runEgger,
  runFixedRandom,
  runLeaveOneOut,
  runMetaRecipe,
  runPredictionInterval,
  runSubgroup,
  runTrimFill,
  studyFromRow,
} from './services/meta-stats.js';

const rows = [
  { id: 'a', label: 'Study A', eventsT: 10, nT: 100, eventsC: 20, nC: 100, subgroup: 'adult' },
  { id: 'b', label: 'Study B', eventsT: 15, nT: 120, eventsC: 25, nC: 110, subgroup: 'adult' },
  { id: 'c', label: 'Study C', eventsT: 8, nT: 90, eventsC: 18, nC: 95, subgroup: 'elderly' },
  { id: 'd', label: 'Study D', eventsT: 12, nT: 110, eventsC: 22, nC: 105, subgroup: 'elderly' },
];

test('OR meta pools two studies', () => {
  const out = runFixedRandom(rows.slice(0, 2), 'OR');
  assert.equal(out.studies.length, 2);
  assert.equal(out.studies[0].nTotal, 200);
  assert.equal(out.random.totalN, 430);
  assert.ok(out.random.yiDisplay > 0);
  assert.ok(out.random.ciHighDisplay > out.random.ciLowDisplay);
  assert.ok(out.random.k === 2);
});

test('rejects empty effect rows', () => {
  assert.throws(() => runFixedRandom([{ id: 'x', label: 'bad' }], 'OR'));
});

test('studyFromRow returns null for incomplete binary', () => {
  assert.equal(studyFromRow({ id: 'x', label: 'x', eventsT: 1, nT: 10 }, 'OR'), null);
});

test('funnel recipe returns svg', () => {
  const out = runMetaRecipe('funnel', rows, 'OR', 'random', 'Demo');
  assert.equal(out.plotKind, 'funnel');
  assert.match(out.forestSvg, /<svg/);
});

test('egger needs three studies and returns pValue', () => {
  const out = runEgger(rows, 'OR', 'random');
  assert.ok(out.egger.pValue == null || (out.egger.pValue >= 0 && out.egger.pValue <= 1));
  assert.ok(Number.isFinite(out.egger.intercept));
});

test('leave-one-out returns one entry per study', () => {
  const out = runLeaveOneOut(rows, 'OR', 'random');
  assert.equal(out.leaveOneOut.length, rows.length);
  assert.ok(out.leaveOneOut.every((x) => x.pooled.k === rows.length - 1));
});

test('subgroup pools named groups', () => {
  const out = runSubgroup(rows, 'OR', 'random');
  assert.equal(out.subgroups.length, 2);
  assert.ok(out.subgroups.some((g) => g.name === 'adult'));
});

test('cumulative grows k', () => {
  const out = runCumulative(rows, 'OR', 'random');
  assert.deepEqual(
    out.cumulative.map((c) => c.k),
    [1, 2, 3, 4],
  );
});

test('prediction interval wider than CI', () => {
  const out = runPredictionInterval(rows, 'OR');
  const widthCi = out.summary.ciHigh - out.summary.ciLow;
  const widthPi = out.predictionInterval.piHigh - out.predictionInterval.piLow;
  assert.ok(widthPi + 1e-9 >= widthCi);
});

test('trim-and-fill returns adjusted summary', () => {
  const out = runTrimFill(rows, 'OR', 'random');
  assert.ok(out.trimFill.filledCount >= 0);
  assert.ok(out.trimFill.adjusted.k >= out.studies.length);
});
