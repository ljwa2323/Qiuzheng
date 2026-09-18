import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderForestSvg,
  runFixedRandom,
  type EffectInput,
  type MetaMeasure,
  type MetaModel,
} from './meta-stats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type MetaSandboxRequest = {
  projectId: string;
  analysisId: string;
  runId: string;
  measure: MetaMeasure;
  model: MetaModel;
  recipe: string;
  title: string;
  rows: EffectInput[];
};

/**
 * Fail-closed meta workspace runner inspired by DeepSeek Harness sandbox ideas:
 * - isolated job directory only
 * - allowlisted recipe (no free shell / run_code)
 * - writes input.json + result.json + forest.svg for audit/replay
 */
export async function runMetaInSandbox(input: MetaSandboxRequest) {
  const allowed = new Set(['fixed_random']);
  if (!allowed.has(input.recipe)) {
    throw Object.assign(new Error(`Recipe not allowlisted: ${input.recipe}`), { code: 'SANDBOX_DENIED' });
  }

  const runtimeRoot = path.resolve(path.join(__dirname, '..', '..', '..', '..', '.runtime', 'meta-jobs'));
  const workspace = path.join(runtimeRoot, input.projectId, input.runId);
  await fs.mkdir(workspace, { recursive: true });

  const inputPath = path.join(workspace, 'input.json');
  const resultPath = path.join(workspace, 'result.json');
  const forestPath = path.join(workspace, 'forest.svg');

  await fs.writeFile(inputPath, JSON.stringify(input, null, 2), 'utf8');

  try {
    const computed = runFixedRandom(input.rows, input.measure);
    const summary = input.model === 'fixed' ? computed.fixed : computed.random;
    const forestSvg = renderForestSvg(computed.studies, summary, { title: input.title });
    const result = {
      schema: 'qiuzheng.meta.result.v1',
      recipe: input.recipe,
      measure: input.measure,
      model: input.model,
      studies: computed.studies,
      fixed: computed.fixed,
      random: computed.random,
      summary,
      workspace,
    };
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
    await fs.writeFile(forestPath, forestSvg, 'utf8');
    return { result, forestSvg, workspace };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await fs.writeFile(
      path.join(workspace, 'error.json'),
      JSON.stringify({ code: 'analysis_error', message }, null, 2),
      'utf8',
    );
    throw err;
  }
}
