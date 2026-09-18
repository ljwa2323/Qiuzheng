import test from 'node:test';
import assert from 'node:assert/strict';
import { runFixedRandom, studyFromRow } from './services/meta-stats.js';

test('OR meta pools two studies', () => {
  const rows = [
    { id: 'a', label: 'Study A', eventsT: 10, nT: 100, eventsC: 20, nC: 100 },
    { id: 'b', label: 'Study B', eventsT: 15, nT: 120, eventsC: 25, nC: 110 },
  ];
  const out = runFixedRandom(rows, 'OR');
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
