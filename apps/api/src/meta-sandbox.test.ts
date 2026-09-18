import test from 'node:test';
import assert from 'node:assert/strict';
import { runMetaInSandbox } from './services/meta-sandbox.js';

test('sandbox denies unknown recipe', async () => {
  await assert.rejects(
    () =>
      runMetaInSandbox({
        projectId: 'p_test',
        analysisId: 'a_test',
        runId: 'run_deny',
        measure: 'OR',
        model: 'random',
        recipe: 'not_a_real_recipe',
        title: 'Deny',
        rows: [{ id: '1', label: 'A', eventsT: 1, nT: 10, eventsC: 2, nC: 10 }],
      }),
    /not allowlisted/i,
  );
});

test('sandbox runs funnel recipe', async () => {
  const out = await runMetaInSandbox({
    projectId: 'p_test',
    analysisId: 'a_test',
    runId: `run_funnel_${Date.now().toString(36)}`,
    measure: 'OR',
    model: 'random',
    recipe: 'funnel',
    title: 'Funnel smoke',
    rows: [
      { id: '1', label: 'A', eventsT: 10, nT: 100, eventsC: 20, nC: 100 },
      { id: '2', label: 'B', eventsT: 12, nT: 110, eventsC: 18, nC: 105 },
      { id: '3', label: 'C', eventsT: 8, nT: 90, eventsC: 16, nC: 95 },
    ],
  });
  assert.match(out.forestSvg, /<svg/);
  assert.equal((out.result as { recipe?: string }).recipe, 'funnel');
});
