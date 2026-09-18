import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  META_RECIPES,
  runMetaRecipe,
  studyFromRow,
  type EffectInput,
  type MetaMeasure,
  type MetaModel,
  type MetaRecipe,
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

function isMetaRecipe(value: string): value is MetaRecipe {
  return (META_RECIPES as readonly string[]).includes(value);
}

async function findRscript(): Promise<string | null> {
  const candidates = process.platform === 'win32'
    ? ['Rscript.exe', 'Rscript']
    : ['Rscript'];
  for (const bin of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(bin, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
      });
      return bin;
    } catch {
      /* try next */
    }
  }
  return null;
}

function runProcess(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `Rscript exited with code ${code}`));
    });
  });
}

async function runNetworkMeta(input: MetaSandboxRequest, workspace: string) {
  const rscript = await findRscript();
  if (!rscript) {
    throw Object.assign(
      new Error(
        'Rscript not found. Install R and ensure Rscript is on PATH, then install.packages(c("jsonlite","netmeta")).',
      ),
      { code: 'R_MISSING' },
    );
  }

  const nmaRows = input.rows
    .map((row) => {
      const study = studyFromRow(row, input.measure);
      if (!study) return null;
      const treat1 = (row.armT || 'Treatment').trim() || 'Treatment';
      const treat2 = (row.armC || 'Control').trim() || 'Control';
      if (treat1 === treat2) return null;
      return {
        studlab: study.label || study.id,
        treat1,
        treat2,
        TE: study.yi,
        seTE: study.sei,
      };
    })
    .filter(Boolean);

  const arms = new Set(nmaRows.flatMap((r) => [r!.treat1, r!.treat2]));
  if (arms.size < 3) {
    throw new Error(
      `Network meta-analysis needs >= 3 distinct arms (found ${arms.size}: ${[...arms].join(', ')}). Set armT/armC on effect rows.`,
    );
  }

  const nmaInputPath = path.join(workspace, 'nma_input.json');
  await fs.writeFile(
    nmaInputPath,
    JSON.stringify(
      {
        measure: input.measure,
        model: input.model,
        title: input.title,
        rows: nmaRows,
      },
      null,
      2,
    ),
    'utf8',
  );

  const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'run_nma.R');
  try {
    await runProcess(rscript, [scriptPath, workspace], workspace);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw Object.assign(
      new Error(
        message.includes('netmeta') || message.includes('jsonlite')
          ? message
          : `Network meta-analysis failed: ${message}`,
      ),
      { code: 'NMA_FAILED' },
    );
  }

  const resultRaw = await fs.readFile(path.join(workspace, 'nma_result.json'), 'utf8');
  const nmaResult = JSON.parse(resultRaw) as Record<string, unknown>;
  let forestSvg = '';
  try {
    forestSvg = await fs.readFile(path.join(workspace, 'network.svg'), 'utf8');
  } catch {
    forestSvg = '';
  }

  const summary = (nmaResult.summary || {
    model: input.model,
    measure: input.measure,
    k: nmaRows.length,
    yi: 0,
    sei: 0,
    ciLow: 0,
    ciHigh: 0,
    yiDisplay: null,
    ciLowDisplay: null,
    ciHighDisplay: null,
    q: 0,
    i2: 0,
    tau2: 0,
    pQ: null,
    totalN: null,
  }) as Record<string, unknown>;

  return {
    result: {
      schema: 'qiuzheng.meta.result.v1',
      recipe: 'network',
      measure: input.measure,
      model: input.model,
      plotKind: 'network',
      summary,
      network: nmaResult,
      studies: nmaRows,
    },
    forestSvg,
    workspace,
  };
}

/**
 * Fail-closed meta workspace runner:
 * - isolated job directory only
 * - allowlisted recipe (no free shell / run_code)
 * - TS recipes in-process; network via Rscript + netmeta
 */
export async function runMetaInSandbox(input: MetaSandboxRequest) {
  if (!isMetaRecipe(input.recipe)) {
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
    if (input.recipe === 'network') {
      const networked = await runNetworkMeta(input, workspace);
      await fs.writeFile(resultPath, JSON.stringify(networked.result, null, 2), 'utf8');
      if (networked.forestSvg) await fs.writeFile(forestPath, networked.forestSvg, 'utf8');
      return networked;
    }

    const computed = runMetaRecipe(
      input.recipe,
      input.rows,
      input.measure,
      input.model,
      input.title,
    );
    const result = {
      schema: 'qiuzheng.meta.result.v1',
      recipe: input.recipe,
      measure: input.measure,
      model: input.model,
      plotKind: computed.plotKind,
      studies: computed.studies,
      fixed: computed.fixed,
      random: computed.random,
      summary: computed.summary,
      egger: computed.egger,
      leaveOneOut: computed.leaveOneOut,
      subgroups: computed.subgroups,
      cumulative: computed.cumulative,
      predictionInterval: computed.predictionInterval,
      trimFill: computed.trimFill
        ? {
            filledCount: computed.trimFill.filledCount,
            observed: computed.trimFill.observed,
            adjusted: computed.trimFill.adjusted,
            filled: computed.trimFill.filled,
          }
        : undefined,
      workspace,
    };
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
    await fs.writeFile(forestPath, computed.forestSvg, 'utf8');
    return { result, forestSvg: computed.forestSvg, workspace };
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
