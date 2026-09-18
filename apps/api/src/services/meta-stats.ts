/** Deterministic meta-analysis recipes (IV / DerSimonian-Laird). No LLM. */

export type MetaMeasure = 'OR' | 'RR' | 'MD' | 'SMD';
export type MetaModel = 'fixed' | 'random';

export const META_RECIPES = [
  'fixed_random',
  'funnel',
  'egger',
  'leave_one_out',
  'subgroup',
  'cumulative',
  'prediction_interval',
  'trim_fill',
  'network',
] as const;

export type MetaRecipe = (typeof META_RECIPES)[number];

export type EffectInput = {
  id: string;
  label: string;
  eventsT?: number | null;
  nT?: number | null;
  eventsC?: number | null;
  nC?: number | null;
  meanT?: number | null;
  sdT?: number | null;
  meanC?: number | null;
  sdC?: number | null;
  yi?: number | null;
  sei?: number | null;
  subgroup?: string | null;
  armT?: string | null;
  armC?: string | null;
};

export type StudyEffect = {
  id: string;
  label: string;
  yi: number;
  sei: number;
  wi: number;
  yiDisplay: number;
  ciLow: number;
  ciHigh: number;
  subgroup: string;
  nT: number | null;
  nC: number | null;
  nTotal: number | null;
};

export type MetaSummary = {
  model: MetaModel;
  measure: MetaMeasure;
  k: number;
  yi: number;
  sei: number;
  ciLow: number;
  ciHigh: number;
  yiDisplay: number;
  ciLowDisplay: number;
  ciHighDisplay: number;
  q: number;
  i2: number;
  tau2: number;
  pQ: number | null;
  totalN: number | null;
};

function erfinvApprox(x: number): number {
  const a = 0.147;
  const sign = x < 0 ? -1 : 1;
  const ln = Math.log(1 - x * x);
  const first = 2 / (Math.PI * a) + ln / 2;
  const second = ln / a;
  return sign * Math.sqrt(Math.sqrt(first * first - second) - first);
}

function normPpf(p: number): number {
  return Math.SQRT2 * erfinvApprox(2 * p - 1);
}

function erfApprox(x: number): number {
  // Abramowitz and Stegun 7.1.26
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-ax * ax);
  return sign * y;
}

function chi2Sf(df: number, x: number): number | null {
  if (df <= 0 || !Number.isFinite(x)) return null;
  if (x <= 0) return 1;
  const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
  const se = Math.sqrt(2 / (9 * df));
  const zz = z / se;
  const cdf = 0.5 * (1 + erfApprox(zz / Math.SQRT2));
  return Math.max(0, Math.min(1, 1 - cdf));
}

function isBinary(measure: MetaMeasure) {
  return measure === 'OR' || measure === 'RR';
}

function isContinuous(measure: MetaMeasure) {
  return measure === 'MD' || measure === 'SMD';
}

function displayScale(measure: MetaMeasure, yi: number) {
  if (isBinary(measure)) return Math.exp(yi);
  return yi;
}

export function studyFromRow(row: EffectInput, measure: MetaMeasure): StudyEffect | null {
  const label = row.label || row.id;
  const subgroup = row.subgroup || '';
  const nTRaw = row.nT != null && Number.isFinite(Number(row.nT)) ? Number(row.nT) : null;
  const nCRaw = row.nC != null && Number.isFinite(Number(row.nC)) ? Number(row.nC) : null;
  const nTotal =
    nTRaw != null && nCRaw != null ? nTRaw + nCRaw : nTRaw != null ? nTRaw : nCRaw;

  if (row.yi != null && row.sei != null && row.sei > 0) {
    const yi = Number(row.yi);
    const sei = Number(row.sei);
    const z = normPpf(0.975);
    return {
      id: row.id,
      label,
      yi,
      sei,
      wi: 1 / (sei * sei),
      yiDisplay: displayScale(measure, yi),
      ciLow: displayScale(measure, yi - z * sei),
      ciHigh: displayScale(measure, yi + z * sei),
      subgroup,
      nT: nTRaw,
      nC: nCRaw,
      nTotal,
    };
  }

  if (isBinary(measure)) {
    const a = Number(row.eventsT);
    const n1 = Number(row.nT);
    const c = Number(row.eventsC);
    const n2 = Number(row.nC);
    if (![a, n1, c, n2].every((v) => Number.isFinite(v) && v >= 0) || n1 <= 0 || n2 <= 0) return null;
    const b = n1 - a;
    const d = n2 - c;
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;
    // Haldane-Anscombe correction when any cell is 0.
    const corr = a === 0 || b === 0 || c === 0 || d === 0 ? 0.5 : 0;
    const aa = a + corr;
    const bb = b + corr;
    const cc = c + corr;
    const dd = d + corr;
    let yi = 0;
    let sei = 0;
    if (measure === 'OR') {
      yi = Math.log((aa * dd) / (bb * cc));
      sei = Math.sqrt(1 / aa + 1 / bb + 1 / cc + 1 / dd);
    } else {
      const p1 = aa / (aa + bb);
      const p2 = cc / (cc + dd);
      if (p1 <= 0 || p2 <= 0) return null;
      yi = Math.log(p1 / p2);
      sei = Math.sqrt((1 - p1) / (n1 * p1) + (1 - p2) / (n2 * p2));
    }
    if (!Number.isFinite(yi) || !Number.isFinite(sei) || sei <= 0) return null;
    const z = normPpf(0.975);
    return {
      id: row.id,
      label,
      yi,
      sei,
      wi: 1 / (sei * sei),
      yiDisplay: displayScale(measure, yi),
      ciLow: displayScale(measure, yi - z * sei),
      ciHigh: displayScale(measure, yi + z * sei),
      subgroup,
      nT: n1,
      nC: n2,
      nTotal: n1 + n2,
    };
  }

  if (isContinuous(measure)) {
    const m1 = Number(row.meanT);
    const s1 = Number(row.sdT);
    const n1 = Number(row.nT);
    const m2 = Number(row.meanC);
    const s2 = Number(row.sdC);
    const n2 = Number(row.nC);
    if (![m1, s1, n1, m2, s2, n2].every((v) => Number.isFinite(v)) || n1 <= 1 || n2 <= 1 || s1 < 0 || s2 < 0) {
      return null;
    }
    let yi = m1 - m2;
    let sei = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);
    if (measure === 'SMD') {
      const sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
      if (sp <= 0) return null;
      yi = (m1 - m2) / sp;
      sei = Math.sqrt((n1 + n2) / (n1 * n2) + (yi * yi) / (2 * (n1 + n2)));
    }
    if (!Number.isFinite(yi) || !Number.isFinite(sei) || sei <= 0) return null;
    const z = normPpf(0.975);
    return {
      id: row.id,
      label,
      yi,
      sei,
      wi: 1 / (sei * sei),
      yiDisplay: yi,
      ciLow: yi - z * sei,
      ciHigh: yi + z * sei,
      subgroup,
      nT: n1,
      nC: n2,
      nTotal: n1 + n2,
    };
  }

  return null;
}

function pool(studies: StudyEffect[], measure: MetaMeasure, model: MetaModel): MetaSummary {
  const k = studies.length;
  const sumW = studies.reduce((s, x) => s + x.wi, 0);
  const fixedYi = studies.reduce((s, x) => s + x.wi * x.yi, 0) / sumW;
  const q = studies.reduce((s, x) => s + x.wi * (x.yi - fixedYi) ** 2, 0);
  const c = sumW - studies.reduce((s, x) => s + x.wi * x.wi, 0) / sumW;
  const tau2 = model === 'random' && c > 0 ? Math.max(0, (q - (k - 1)) / c) : 0;
  const weights = studies.map((x) => (model === 'random' ? 1 / (x.sei * x.sei + tau2) : x.wi));
  const sumWr = weights.reduce((s, w) => s + w, 0);
  const yi = studies.reduce((s, x, i) => s + weights[i] * x.yi, 0) / sumWr;
  const sei = Math.sqrt(1 / sumWr);
  const z = normPpf(0.975);
  const i2 = q <= k - 1 || k < 2 ? 0 : Math.max(0, Math.min(100, ((q - (k - 1)) / q) * 100));
  const totalParts = studies.map((s) => s.nTotal).filter((n): n is number => n != null && Number.isFinite(n));
  const totalN = totalParts.length === studies.length ? totalParts.reduce((a, b) => a + b, 0) : null;
  return {
    model,
    measure,
    k,
    yi,
    sei,
    ciLow: yi - z * sei,
    ciHigh: yi + z * sei,
    yiDisplay: displayScale(measure, yi),
    ciLowDisplay: displayScale(measure, yi - z * sei),
    ciHighDisplay: displayScale(measure, yi + z * sei),
    q,
    i2,
    tau2,
    pQ: k >= 2 ? chi2Sf(k - 1, q) : null,
    totalN,
  };
}

export function requireStudies(rows: EffectInput[], measure: MetaMeasure, min = 1): StudyEffect[] {
  const studies = rows.map((row) => studyFromRow(row, measure)).filter(Boolean) as StudyEffect[];
  if (studies.length < min) {
    throw new Error(`Need at least ${min} valid effect row(s) for the selected measure`);
  }
  return studies;
}

export function runFixedRandom(rows: EffectInput[], measure: MetaMeasure) {
  const studies = requireStudies(rows, measure, 1);
  const fixed = pool(studies, measure, 'fixed');
  const random = pool(studies, measure, 'random');
  return { studies, fixed, random };
}

function tPpf(p: number, df: number): number {
  if (!(df > 0) || !Number.isFinite(p)) return normPpf(p);
  if (df >= 40) return normPpf(p);
  const z = normPpf(p);
  // First-order Cornish-Fisher-style correction for Student-t
  return z + (z * z * z + z) / (4 * df);
}

function ordinaryLeastSquares(xs: number[], ys: number[]) {
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx <= 0) throw new Error('Egger regression needs variation in precision (1/SE)');
  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const residualSs = syy - slope * sxy;
  const mse = n > 2 ? residualSs / (n - 2) : 0;
  const seIntercept = Math.sqrt(mse * (1 / n + (meanX * meanX) / sxx));
  const seSlope = Math.sqrt(mse / sxx);
  return { intercept, slope, seIntercept, seSlope, n, mse };
}

function twoSidedTPvalue(t: number, df: number): number | null {
  if (!(df > 0) || !Number.isFinite(t)) return null;
  // Approximate via normal for large df; otherwise use erf on z-like transform
  const z = Math.abs(t) * (1 - 1 / (4 * df));
  const cdf = 0.5 * (1 + erfApprox(z / Math.SQRT2));
  return Math.max(0, Math.min(1, 2 * (1 - cdf)));
}

export function renderFunnelSvg(
  studies: StudyEffect[],
  summary: MetaSummary,
  opts: { title?: string; width?: number; filled?: StudyEffect[] } = {},
): string {
  const width = opts.width || 720;
  const height = 420;
  const pad = { top: 48, right: 36, bottom: 48, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = [...studies, ...(opts.filled || [])];
  const xs = all.map((s) => s.yiDisplay);
  const ys = all.map((s) => s.sei);
  let minX = Math.min(...xs, summary.yiDisplay);
  let maxX = Math.max(...xs, summary.yiDisplay);
  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  const maxSei = Math.max(...ys, 1e-6) * 1.12;
  const xScale = (v: number) => pad.left + ((v - minX) / (maxX - minX)) * plotW;
  const yScale = (sei: number) => pad.top + (sei / maxSei) * plotH;
  const nullX = summary.measure === 'OR' || summary.measure === 'RR' ? xScale(1) : xScale(0);
  const pooledX = xScale(summary.yiDisplay);
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="100%" height="100%" fill="#fbfcfb"/>`);
  lines.push(`<text x="20" y="28" font-family="DM Sans, sans-serif" font-size="14" fill="#142321">${escapeXml(opts.title || 'Funnel plot')}</text>`);
  lines.push(`<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#dfe7e3"/>`);
  lines.push(`<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#dfe7e3"/>`);
  lines.push(`<line x1="${nullX}" y1="${pad.top}" x2="${nullX}" y2="${pad.top + plotH}" stroke="#dfe7e3" stroke-dasharray="4 4"/>`);
  lines.push(`<line x1="${pooledX}" y1="${pad.top}" x2="${pooledX}" y2="${pad.top + plotH}" stroke="#146a61" stroke-dasharray="3 3"/>`);
  // Pseudo 95% CI funnel around pooled estimate on display scale (approx via SE on log/identity scale)
  const z = normPpf(0.975);
  const topY = pad.top;
  const bottomY = pad.top + plotH;
  const seiAtTop = 0;
  const seiAtBottom = maxSei;
  const leftTop = xScale(displayScale(summary.measure, summary.yi - z * seiAtTop));
  const rightTop = xScale(displayScale(summary.measure, summary.yi + z * seiAtTop));
  const leftBottom = xScale(displayScale(summary.measure, summary.yi - z * seiAtBottom));
  const rightBottom = xScale(displayScale(summary.measure, summary.yi + z * seiAtBottom));
  lines.push(`<path d="M ${leftTop} ${topY} L ${leftBottom} ${bottomY}" stroke="#b7c4c0" fill="none"/>`);
  lines.push(`<path d="M ${rightTop} ${topY} L ${rightBottom} ${bottomY}" stroke="#b7c4c0" fill="none"/>`);
  studies.forEach((s) => {
    lines.push(`<circle cx="${xScale(s.yiDisplay)}" cy="${yScale(s.sei)}" r="5" fill="#146a61" fill-opacity="0.85"><title>${escapeXml(s.label)}</title></circle>`);
  });
  (opts.filled || []).forEach((s) => {
    lines.push(`<circle cx="${xScale(s.yiDisplay)}" cy="${yScale(s.sei)}" r="5" fill="none" stroke="#c4574d" stroke-width="2"><title>${escapeXml(s.label)}</title></circle>`);
  });
  lines.push(`<text x="${pad.left}" y="${height - 16}" font-family="DM Sans, sans-serif" font-size="10" fill="#738580">x = effect · y = SE · solid = observed · open = filled</text>`);
  lines.push('</svg>');
  return lines.join('');
}

export function runEgger(rows: EffectInput[], measure: MetaMeasure, model: MetaModel = 'random') {
  const studies = requireStudies(rows, measure, 3);
  const base = runFixedRandom(rows, measure);
  const summary = model === 'fixed' ? base.fixed : base.random;
  const xs = studies.map((s) => 1 / s.sei);
  const ys = studies.map((s) => s.yi / s.sei);
  const fit = ordinaryLeastSquares(xs, ys);
  const t = fit.seIntercept > 0 ? fit.intercept / fit.seIntercept : 0;
  const pValue = twoSidedTPvalue(t, fit.n - 2);
  return {
    studies,
    fixed: base.fixed,
    random: base.random,
    summary,
    egger: {
      intercept: fit.intercept,
      slope: fit.slope,
      seIntercept: fit.seIntercept,
      seSlope: fit.seSlope,
      t,
      df: fit.n - 2,
      pValue,
      interpretation:
        pValue != null && pValue < 0.1
          ? 'Possible small-study / publication bias (Egger p < 0.10)'
          : 'No strong evidence of funnel asymmetry by Egger test',
    },
  };
}

export function runLeaveOneOut(rows: EffectInput[], measure: MetaMeasure, model: MetaModel = 'random') {
  const studies = requireStudies(rows, measure, 2);
  const base = runFixedRandom(rows, measure);
  const summary = model === 'fixed' ? base.fixed : base.random;
  const leaveOneOut = studies.map((omit) => {
    const rest = studies.filter((s) => s.id !== omit.id);
    const pooled = pool(rest, measure, model);
    return {
      omittedId: omit.id,
      omittedLabel: omit.label,
      pooled,
    };
  });
  return { studies, fixed: base.fixed, random: base.random, summary, leaveOneOut };
}

export function runSubgroup(rows: EffectInput[], measure: MetaMeasure, model: MetaModel = 'random') {
  const studies = requireStudies(rows, measure, 1);
  const base = runFixedRandom(rows, measure);
  const summary = model === 'fixed' ? base.fixed : base.random;
  const groups = new Map<string, StudyEffect[]>();
  for (const s of studies) {
    const key = (s.subgroup || '').trim() || '(ungrouped)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  if ([...groups.keys()].every((k) => k === '(ungrouped)')) {
    throw new Error('Subgroup analysis needs at least one non-empty subgroup label on effect rows');
  }
  const subgroups = [...groups.entries()].map(([name, groupStudies]) => ({
    name,
    k: groupStudies.length,
    pooled: pool(groupStudies, measure, model),
  }));
  return { studies, fixed: base.fixed, random: base.random, summary, subgroups };
}

export function runCumulative(rows: EffectInput[], measure: MetaMeasure, model: MetaModel = 'random') {
  const studies = requireStudies(rows, measure, 1);
  const ordered = [...studies].sort((a, b) => a.label.localeCompare(b.label, 'en'));
  const base = runFixedRandom(rows, measure);
  const summary = model === 'fixed' ? base.fixed : base.random;
  const cumulative = ordered.map((_, idx) => {
    const slice = ordered.slice(0, idx + 1);
    return {
      addedId: ordered[idx].id,
      addedLabel: ordered[idx].label,
      k: slice.length,
      pooled: pool(slice, measure, model),
    };
  });
  return { studies: ordered, fixed: base.fixed, random: base.random, summary, cumulative };
}

export function runPredictionInterval(rows: EffectInput[], measure: MetaMeasure) {
  const studies = requireStudies(rows, measure, 3);
  const base = runFixedRandom(rows, measure);
  const summary = base.random;
  const df = Math.max(1, summary.k - 2);
  const tCrit = tPpf(0.975, df);
  const predSe = Math.sqrt(summary.tau2 + summary.sei * summary.sei);
  const piLow = summary.yi - tCrit * predSe;
  const piHigh = summary.yi + tCrit * predSe;
  const predictionInterval = {
    df,
    tCrit,
    piLow,
    piHigh,
    piLowDisplay: displayScale(measure, piLow),
    piHighDisplay: displayScale(measure, piHigh),
  };
  return { studies, fixed: base.fixed, random: base.random, summary, predictionInterval };
}

/**
 * Simplified Duval & Tweedie trim-and-fill (L0-style) on the effect scale.
 * Estimates missing studies on the sparse side, mirrors them, then re-pools.
 */
export function runTrimFill(rows: EffectInput[], measure: MetaMeasure, model: MetaModel = 'random') {
  const studies = requireStudies(rows, measure, 3);
  const base = runFixedRandom(rows, measure);
  let theta = (model === 'fixed' ? base.fixed : base.random).yi;
  let filledCount = 0;
  for (let iter = 0; iter < 20; iter += 1) {
    const centered = studies.map((s) => ({ ...s, c: s.yi - theta })).sort((a, b) => a.c - b.c);
    const n = centered.length;
    // L0 estimator: number of studies with positive centered effects that lack mirrors
    let r0 = 0;
    for (let i = 0; i < n; i += 1) {
      if (centered[i].c > 0) r0 += 1;
    }
    const gamma = Math.max(0, r0 - (n - r0));
    if (gamma === filledCount) break;
    filledCount = gamma;
    const positives = centered.filter((s) => s.c > 0).sort((a, b) => b.c - a.c);
    const mirrors: StudyEffect[] = positives.slice(0, gamma).map((s, idx) => {
      const yi = 2 * theta - s.yi;
      const z = normPpf(0.975);
      return {
        id: `filled_${idx + 1}`,
        label: `Filled ${idx + 1}`,
        yi,
        sei: s.sei,
        wi: 1 / (s.sei * s.sei),
        yiDisplay: displayScale(measure, yi),
        ciLow: displayScale(measure, yi - z * s.sei),
        ciHigh: displayScale(measure, yi + z * s.sei),
        subgroup: '',
        nT: null,
        nC: null,
        nTotal: null,
      };
    });
    const combined = [...studies, ...mirrors];
    theta = pool(combined, measure, model).yi;
  }

  const positives = studies
    .map((s) => ({ ...s, c: s.yi - theta }))
    .filter((s) => s.c > 0)
    .sort((a, b) => b.c - a.c);
  const filled: StudyEffect[] = positives.slice(0, filledCount).map((s, idx) => {
    const yi = 2 * theta - s.yi;
    const z = normPpf(0.975);
    return {
      id: `filled_${idx + 1}`,
      label: `Filled ${idx + 1}`,
      yi,
      sei: s.sei,
      wi: 1 / (s.sei * s.sei),
      yiDisplay: displayScale(measure, yi),
      ciLow: displayScale(measure, yi - z * s.sei),
      ciHigh: displayScale(measure, yi + z * s.sei),
      subgroup: '',
      nT: null,
      nC: null,
      nTotal: null,
    };
  });
  const adjusted = pool([...studies, ...filled], measure, model);
  const observed = model === 'fixed' ? base.fixed : base.random;
  return {
    studies,
    fixed: base.fixed,
    random: base.random,
    summary: adjusted,
    trimFill: {
      filledCount,
      observed,
      adjusted,
      filled,
    },
  };
}

export type MetaRecipeResult = {
  studies: StudyEffect[];
  fixed?: MetaSummary;
  random?: MetaSummary;
  summary: MetaSummary;
  plotKind: 'forest' | 'funnel' | 'table';
  forestSvg: string;
  egger?: ReturnType<typeof runEgger>['egger'];
  leaveOneOut?: ReturnType<typeof runLeaveOneOut>['leaveOneOut'];
  subgroups?: ReturnType<typeof runSubgroup>['subgroups'];
  cumulative?: ReturnType<typeof runCumulative>['cumulative'];
  predictionInterval?: ReturnType<typeof runPredictionInterval>['predictionInterval'];
  trimFill?: ReturnType<typeof runTrimFill>['trimFill'];
};

export function runMetaRecipe(
  recipe: Exclude<MetaRecipe, 'network'>,
  rows: EffectInput[],
  measure: MetaMeasure,
  model: MetaModel,
  title: string,
): MetaRecipeResult {
  if (recipe === 'fixed_random') {
    const out = runFixedRandom(rows, measure);
    const summary = model === 'fixed' ? out.fixed : out.random;
    return {
      ...out,
      summary,
      plotKind: 'forest',
      forestSvg: renderForestSvg(out.studies, summary, { title }),
    };
  }
  if (recipe === 'funnel') {
    const out = runFixedRandom(rows, measure);
    const summary = model === 'fixed' ? out.fixed : out.random;
    return {
      ...out,
      summary,
      plotKind: 'funnel',
      forestSvg: renderFunnelSvg(out.studies, summary, { title: `${title} · Funnel` }),
    };
  }
  if (recipe === 'egger') {
    const out = runEgger(rows, measure, model);
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: out.summary,
      plotKind: 'funnel',
      forestSvg: renderFunnelSvg(out.studies, out.summary, { title: `${title} · Egger` }),
      egger: out.egger,
    };
  }
  if (recipe === 'leave_one_out') {
    const out = runLeaveOneOut(rows, measure, model);
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: out.summary,
      plotKind: 'table',
      forestSvg: renderForestSvg(out.studies, out.summary, { title: `${title} · Leave-one-out` }),
      leaveOneOut: out.leaveOneOut,
    };
  }
  if (recipe === 'subgroup') {
    const out = runSubgroup(rows, measure, model);
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: out.summary,
      plotKind: 'table',
      forestSvg: renderForestSvg(out.studies, out.summary, { title: `${title} · Subgroup` }),
      subgroups: out.subgroups,
    };
  }
  if (recipe === 'cumulative') {
    const out = runCumulative(rows, measure, model);
    const last = out.cumulative[out.cumulative.length - 1]?.pooled || out.summary;
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: last,
      plotKind: 'table',
      forestSvg: renderForestSvg(out.studies, last, { title: `${title} · Cumulative` }),
      cumulative: out.cumulative,
    };
  }
  if (recipe === 'prediction_interval') {
    const out = runPredictionInterval(rows, measure);
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: out.summary,
      plotKind: 'forest',
      forestSvg: renderForestSvg(out.studies, out.summary, {
        title: `${title} · Prediction interval ${out.predictionInterval.piLowDisplay.toFixed(2)}–${out.predictionInterval.piHighDisplay.toFixed(2)}`,
      }),
      predictionInterval: out.predictionInterval,
    };
  }
  if (recipe === 'trim_fill') {
    const out = runTrimFill(rows, measure, model);
    return {
      studies: out.studies,
      fixed: out.fixed,
      random: out.random,
      summary: out.summary,
      plotKind: 'funnel',
      forestSvg: renderFunnelSvg(out.studies, out.summary, {
        title: `${title} · Trim-and-fill`,
        filled: out.trimFill.filled,
      }),
      trimFill: out.trimFill,
    };
  }
  throw new Error(`Unknown TypeScript meta recipe: ${recipe}`);
}

export function renderForestSvg(
  studies: StudyEffect[],
  summary: MetaSummary,
  opts: { title?: string; width?: number } = {},
): string {
  const width = opts.width || 780;
  const rowH = 28;
  const padTop = 48;
  const padBottom = 40;
  const height = padTop + (studies.length + 2) * rowH + padBottom;
  const plotLeft = 260;
  const plotRight = width - 90;
  const plotW = plotRight - plotLeft;

  const allVals = [
    ...studies.flatMap((s) => [s.ciLow, s.ciHigh, s.yiDisplay]),
    summary.ciLowDisplay,
    summary.ciHighDisplay,
    summary.yiDisplay,
  ].filter((v) => Number.isFinite(v));
  let minV = Math.min(...allVals);
  let maxV = Math.max(...allVals);
  if (minV === maxV) {
    minV -= 1;
    maxV += 1;
  }
  const span = maxV - minV;
  minV -= span * 0.08;
  maxV += span * 0.08;
  const xScale = (v: number) => plotLeft + ((v - minV) / (maxV - minV)) * plotW;

  const nullX = summary.measure === 'OR' || summary.measure === 'RR' ? xScale(1) : xScale(0);
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<rect width="100%" height="100%" fill="#fbfcfb"/>`);
  lines.push(`<text x="20" y="28" font-family="DM Sans, sans-serif" font-size="14" fill="#142321">${escapeXml(opts.title || 'Forest plot')}</text>`);
  lines.push(`<text x="${plotLeft}" y="28" font-family="DM Sans, sans-serif" font-size="10" fill="#738580">N = arm sample sizes (nT+nC)</text>`);
  lines.push(`<line x1="${nullX}" y1="${padTop - 8}" x2="${nullX}" y2="${height - padBottom}" stroke="#dfe7e3" stroke-dasharray="4 4"/>`);

  studies.forEach((s, i) => {
    const y = padTop + i * rowH;
    const x1 = xScale(s.ciLow);
    const x2 = xScale(s.ciHigh);
    const xm = xScale(s.yiDisplay);
    const nLabel = s.nTotal != null ? `N=${s.nTotal}` : '';
    lines.push(`<text x="16" y="${y + 14}" font-family="DM Sans, sans-serif" font-size="11" fill="#445955">${escapeXml(truncate(s.label, 28))}${nLabel ? ` · ${nLabel}` : ''}</text>`);
    lines.push(`<line x1="${x1}" y1="${y + 10}" x2="${x2}" y2="${y + 10}" stroke="#146a61" stroke-width="2"/>`);
    lines.push(`<rect x="${xm - 5}" y="${y + 5}" width="10" height="10" fill="#146a61"/>`);
    lines.push(`<text x="${plotRight + 6}" y="${y + 14}" font-family="DM Sans, sans-serif" font-size="10" fill="#738580">${s.yiDisplay.toFixed(2)}</text>`);
  });

  const sy = padTop + studies.length * rowH + 8;
  const sx1 = xScale(summary.ciLowDisplay);
  const sx2 = xScale(summary.ciHighDisplay);
  const sxm = xScale(summary.yiDisplay);
  const pooledN = summary.totalN != null ? ` · N=${summary.totalN}` : '';
  lines.push(`<text x="16" y="${sy + 14}" font-family="DM Sans, sans-serif" font-size="11" font-weight="700" fill="#142321">${summary.model} pooled${pooledN}</text>`);
  lines.push(`<polygon points="${sxm},${sy + 2} ${sx2},${sy + 10} ${sxm},${sy + 18} ${sx1},${sy + 10}" fill="#0f514b"/>`);
  lines.push(`<text x="16" y="${height - 14}" font-family="DM Sans, sans-serif" font-size="10" fill="#738580">I2=${summary.i2.toFixed(1)}% · tau2=${summary.tau2.toFixed(4)} · k=${summary.k}${pooledN}</text>`);
  lines.push('</svg>');
  return lines.join('');
}

function truncate(text: string, n: number) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function escapeXml(text: string) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
