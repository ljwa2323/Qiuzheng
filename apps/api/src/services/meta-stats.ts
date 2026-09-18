/** Deterministic meta-analysis recipes (IV / DerSimonian-Laird). No LLM. */

export type MetaMeasure = 'OR' | 'RR' | 'MD' | 'SMD';
export type MetaModel = 'fixed' | 'random';

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

export function runFixedRandom(rows: EffectInput[], measure: MetaMeasure) {
  const studies = rows.map((row) => studyFromRow(row, measure)).filter(Boolean) as StudyEffect[];
  if (studies.length < 1) {
    throw new Error('Need at least one valid effect row for the selected measure');
  }
  const fixed = pool(studies, measure, 'fixed');
  const random = pool(studies, measure, 'random');
  return { studies, fixed, random };
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
