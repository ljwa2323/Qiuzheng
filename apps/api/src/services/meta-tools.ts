/** Meta conversion + computability checks for agent/tool use. No LLM. */

export type MetaMeasure = 'OR' | 'RR' | 'MD' | 'SMD';

export type EffectRowLike = {
  citationId?: string;
  label?: string;
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
  ciLow?: number | null;
  ciHigh?: number | null;
};

export type ComputabilityIssue = {
  code: string;
  field?: string;
  message: string;
};

export type RowComputability = {
  citationId?: string;
  label?: string;
  ok: boolean;
  path: 'binary_counts' | 'continuous' | 'yi_sei' | 'none';
  issues: ComputabilityIssue[];
  hints: string[];
};

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function issue(code: string, message: string, field?: string): ComputabilityIssue {
  return field ? { code, field, message } : { code, message };
}

/** Check whether a row can be used for the selected measure before pooling. */
export function assessRowComputability(row: EffectRowLike, measure: MetaMeasure): RowComputability {
  const issues: ComputabilityIssue[] = [];
  const hints: string[] = [];
  const label = row.label || row.citationId || '';
  const eventsT = num(row.eventsT);
  const nT = num(row.nT);
  const eventsC = num(row.eventsC);
  const nC = num(row.nC);
  const meanT = num(row.meanT);
  const sdT = num(row.sdT);
  const meanC = num(row.meanC);
  const sdC = num(row.sdC);
  const yi = num(row.yi);
  const sei = num(row.sei);

  // Preferred generic path: already on effect scale.
  if (yi != null && sei != null) {
    if (sei <= 0) issues.push(issue('sei_nonpositive', 'sei must be > 0', 'sei'));
    if (!Number.isFinite(yi)) issues.push(issue('yi_invalid', 'yi must be a finite number', 'yi'));
    if (!issues.length) {
      return { citationId: row.citationId, label, ok: true, path: 'yi_sei', issues: [], hints };
    }
    return { citationId: row.citationId, label, ok: false, path: 'none', issues, hints };
  }
  if (yi != null || sei != null) {
    issues.push(issue('yi_sei_incomplete', 'yi and sei must be provided together', yi == null ? 'yi' : 'sei'));
    hints.push('If the paper reports OR/RR/HR with CI, use or_ci_to_yi_sei / rr_ci_to_yi_sei / hr_ci_to_yi_sei.');
  }

  if (measure === 'OR' || measure === 'RR') {
    const hasCounts = [eventsT, nT, eventsC, nC].every((v) => v != null);
    if (hasCounts) {
      const local: ComputabilityIssue[] = [];
      if (nT! <= 0) local.push(issue('nT_nonpositive', 'nT must be > 0', 'nT'));
      if (nC! <= 0) local.push(issue('nC_nonpositive', 'nC must be > 0', 'nC'));
      if (eventsT! < 0) local.push(issue('eventsT_negative', 'eventsT must be >= 0', 'eventsT'));
      if (eventsC! < 0) local.push(issue('eventsC_negative', 'eventsC must be >= 0', 'eventsC'));
      if (eventsT! > nT!) local.push(issue('eventsT_gt_nT', 'eventsT cannot exceed nT', 'eventsT'));
      if (eventsC! > nC!) local.push(issue('eventsC_gt_nC', 'eventsC cannot exceed nC', 'eventsC'));
      if (eventsT! > 0 && eventsT! < 1 && nT! >= 10) {
        local.push(issue('eventsT_looks_like_rate', 'eventsT looks like a rate/proportion; convert with rate_to_events first', 'eventsT'));
        hints.push('Paper rates must be converted: events = rate * n (use rate_to_events).');
      }
      if (eventsC! > 0 && eventsC! < 1 && nC! >= 10) {
        local.push(issue('eventsC_looks_like_rate', 'eventsC looks like a rate/proportion; convert with rate_to_events first', 'eventsC'));
        hints.push('Paper rates must be converted: events = rate * n (use rate_to_events).');
      }
      if (!local.length) {
        // Prefer complete 2x2 counts even if yi/sei are partially filled.
        return { citationId: row.citationId, label, ok: true, path: 'binary_counts', issues: [], hints: [] };
      }
      return {
        citationId: row.citationId,
        label,
        ok: false,
        path: 'none',
        issues: [...issues, ...local],
        hints: [...new Set(hints)],
      };
    }
    if (!issues.length) {
      const missing = [
        eventsT == null ? 'eventsT' : '',
        nT == null ? 'nT' : '',
        eventsC == null ? 'eventsC' : '',
        nC == null ? 'nC' : '',
      ].filter(Boolean);
      issues.push(issue('binary_incomplete', `Binary ${measure} needs eventsT/nT/eventsC/nC or yi/sei; missing: ${missing.join(', ')}`));
    }
    hints.push('If only rates are reported, call rate_to_events for each arm.');
    hints.push('If OR/RR + 95% CI are reported, call or_ci_to_yi_sei / rr_ci_to_yi_sei.');
    return { citationId: row.citationId, label, ok: false, path: 'none', issues, hints: [...new Set(hints)] };
  }

  // MD / SMD
  const hasCont = [meanT, sdT, nT, meanC, sdC, nC].every((v) => v != null);
  if (hasCont) {
    const local: ComputabilityIssue[] = [];
    if (nT! <= 1) local.push(issue('nT_too_small', 'nT must be > 1 for continuous outcomes', 'nT'));
    if (nC! <= 1) local.push(issue('nC_too_small', 'nC must be > 1 for continuous outcomes', 'nC'));
    if (sdT! < 0) local.push(issue('sdT_negative', 'sdT must be >= 0', 'sdT'));
    if (sdC! < 0) local.push(issue('sdC_negative', 'sdC must be >= 0', 'sdC'));
    if (sdT === 0 && sdC === 0) local.push(issue('sd_both_zero', 'Both SDs are 0; variance undefined'));
    if (!local.length) {
      return { citationId: row.citationId, label, ok: true, path: 'continuous', issues: [], hints: [] };
    }
    return { citationId: row.citationId, label, ok: false, path: 'none', issues: [...issues, ...local], hints: [...new Set(hints)] };
  }
  if (!issues.length) {
    issues.push(issue('continuous_incomplete', `Continuous ${measure} needs meanT/sdT/nT/meanC/sdC/nC or yi/sei`));
  }
  hints.push('If only mean difference with CI is reported, call md_ci_to_yi_sei.');
  return { citationId: row.citationId, label, ok: false, path: 'none', issues, hints: [...new Set(hints)] };
}

export function assessComputability(rows: EffectRowLike[], measure: MetaMeasure) {
  const assessments = rows.map((row) => assessRowComputability(row, measure));
  const okRows = assessments.filter((a) => a.ok);
  const badRows = assessments.filter((a) => !a.ok);
  return {
    schema: 'qiuzheng.meta.computability.v1',
    measure,
    total: rows.length,
    computable: okRows.length,
    notComputable: badRows.length,
    canRun: okRows.length >= 1,
    assessments,
  };
}

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

export const META_TOOL_KINDS = [
  'rate_to_events',
  'or_ci_to_yi_sei',
  'rr_ci_to_yi_sei',
  'hr_ci_to_yi_sei',
  'md_ci_to_yi_sei',
  'assess_computability',
] as const;

export type MetaToolKind = (typeof META_TOOL_KINDS)[number];

export function listMetaTools() {
  return [
    {
      name: 'assess_computability',
      description: 'Validate effect rows for a measure before meta pooling; returns per-row issues and conversion hints.',
      input: { measure: 'OR|RR|MD|SMD', rows: 'EffectRow[]' },
    },
    {
      name: 'rate_to_events',
      description: 'Convert a reported rate/proportion/percent and sample size into event count.',
      input: { rate: 'number', n: 'number', rateIsPercent: 'boolean?' },
    },
    {
      name: 'or_ci_to_yi_sei',
      description: 'Convert odds ratio and 95% CI into logOR (yi) and SE (sei).',
      input: { or: 'number', ciLow: 'number', ciHigh: 'number' },
    },
    {
      name: 'rr_ci_to_yi_sei',
      description: 'Convert risk ratio and 95% CI into logRR (yi) and SE (sei).',
      input: { rr: 'number', ciLow: 'number', ciHigh: 'number' },
    },
    {
      name: 'hr_ci_to_yi_sei',
      description: 'Convert hazard ratio and 95% CI into logHR (yi) and SE (sei).',
      input: { hr: 'number', ciLow: 'number', ciHigh: 'number' },
    },
    {
      name: 'md_ci_to_yi_sei',
      description: 'Convert mean difference and 95% CI into yi (MD scale) and sei.',
      input: { md: 'number', ciLow: 'number', ciHigh: 'number' },
    },
  ];
}

export function convertRateToEvents(input: {
  rate: number;
  n: number;
  rateIsPercent?: boolean;
}) {
  const rate = num(input.rate);
  const n = num(input.n);
  const issues: ComputabilityIssue[] = [];
  if (rate == null) issues.push(issue('rate_invalid', 'rate must be a number', 'rate'));
  if (n == null || n <= 0) issues.push(issue('n_invalid', 'n must be > 0', 'n'));
  if (issues.length) return { ok: false as const, issues };

  let p = rate!;
  if (input.rateIsPercent || p > 1) {
    if (p < 0 || p > 100) issues.push(issue('percent_out_of_range', 'percent rate must be in [0, 100]', 'rate'));
    p = p / 100;
  } else if (p < 0 || p > 1) {
    issues.push(issue('proportion_out_of_range', 'proportion rate must be in [0, 1] (or pass rateIsPercent)', 'rate'));
  }
  if (issues.length) return { ok: false as const, issues };

  const events = p * n!;
  return {
    ok: true as const,
    events,
    eventsRounded: Math.round(events),
    n: n!,
    rateUsed: p,
    note: 'Use eventsRounded for integer counts when journals report whole events; keep events if continuity correction / expected counts are acceptable.',
  };
}

function convertRatioCiToLog(input: {
  estimate: number;
  ciLow: number;
  ciHigh: number;
  label: string;
}) {
  const estimate = num(input.estimate);
  const ciLow = num(input.ciLow);
  const ciHigh = num(input.ciHigh);
  const issues: ComputabilityIssue[] = [];
  if (estimate == null || estimate <= 0) issues.push(issue('estimate_invalid', `${input.label} must be > 0`, 'estimate'));
  if (ciLow == null || ciLow <= 0) issues.push(issue('ciLow_invalid', 'ciLow must be > 0', 'ciLow'));
  if (ciHigh == null || ciHigh <= 0) issues.push(issue('ciHigh_invalid', 'ciHigh must be > 0', 'ciHigh'));
  if (ciLow != null && ciHigh != null && !(ciLow < ciHigh)) {
    issues.push(issue('ci_order', 'ciLow must be < ciHigh'));
  }
  if (estimate != null && ciLow != null && ciHigh != null && !(ciLow <= estimate && estimate <= ciHigh)) {
    issues.push(issue('estimate_outside_ci', `${input.label} should lie within [ciLow, ciHigh]`));
  }
  if (issues.length) return { ok: false as const, issues };

  const yi = Math.log(estimate!);
  const z = normPpf(0.975);
  const sei = (Math.log(ciHigh!) - Math.log(ciLow!)) / (2 * z);
  if (!(sei > 0)) {
    return { ok: false as const, issues: [issue('sei_nonpositive', 'Derived SE is not positive; check CI')] };
  }
  return {
    ok: true as const,
    yi,
    sei,
    measureScale: `log(${input.label})`,
    ciLow: ciLow!,
    ciHigh: ciHigh!,
    estimate: estimate!,
  };
}

export function convertOrCiToYiSei(input: { or: number; ciLow: number; ciHigh: number }) {
  return convertRatioCiToLog({ estimate: input.or, ciLow: input.ciLow, ciHigh: input.ciHigh, label: 'OR' });
}

export function convertRrCiToYiSei(input: { rr: number; ciLow: number; ciHigh: number }) {
  return convertRatioCiToLog({ estimate: input.rr, ciLow: input.ciLow, ciHigh: input.ciHigh, label: 'RR' });
}

export function convertHrCiToYiSei(input: { hr: number; ciLow: number; ciHigh: number }) {
  return convertRatioCiToLog({ estimate: input.hr, ciLow: input.ciLow, ciHigh: input.ciHigh, label: 'HR' });
}

export function convertMdCiToYiSei(input: { md: number; ciLow: number; ciHigh: number }) {
  const md = num(input.md);
  const ciLow = num(input.ciLow);
  const ciHigh = num(input.ciHigh);
  const issues: ComputabilityIssue[] = [];
  if (md == null) issues.push(issue('md_invalid', 'md must be a number', 'md'));
  if (ciLow == null) issues.push(issue('ciLow_invalid', 'ciLow must be a number', 'ciLow'));
  if (ciHigh == null) issues.push(issue('ciHigh_invalid', 'ciHigh must be a number', 'ciHigh'));
  if (ciLow != null && ciHigh != null && !(ciLow < ciHigh)) issues.push(issue('ci_order', 'ciLow must be < ciHigh'));
  if (issues.length) return { ok: false as const, issues };
  const z = normPpf(0.975);
  const sei = (ciHigh! - ciLow!) / (2 * z);
  if (!(sei > 0)) return { ok: false as const, issues: [issue('sei_nonpositive', 'Derived SE is not positive; check CI')] };
  return { ok: true as const, yi: md!, sei, measureScale: 'MD', ciLow: ciLow!, ciHigh: ciHigh!, estimate: md! };
}

export function runMetaTool(kind: MetaToolKind, input: Record<string, unknown>) {
  switch (kind) {
    case 'assess_computability':
      return assessComputability(
        (Array.isArray(input.rows) ? input.rows : []) as EffectRowLike[],
        String(input.measure || 'OR').toUpperCase() as MetaMeasure,
      );
    case 'rate_to_events':
      return convertRateToEvents({
        rate: Number(input.rate),
        n: Number(input.n),
        rateIsPercent: Boolean(input.rateIsPercent),
      });
    case 'or_ci_to_yi_sei':
      return convertOrCiToYiSei({ or: Number(input.or), ciLow: Number(input.ciLow), ciHigh: Number(input.ciHigh) });
    case 'rr_ci_to_yi_sei':
      return convertRrCiToYiSei({ rr: Number(input.rr), ciLow: Number(input.ciLow), ciHigh: Number(input.ciHigh) });
    case 'hr_ci_to_yi_sei':
      return convertHrCiToYiSei({ hr: Number(input.hr), ciLow: Number(input.ciLow), ciHigh: Number(input.ciHigh) });
    case 'md_ci_to_yi_sei':
      return convertMdCiToYiSei({ md: Number(input.md), ciLow: Number(input.ciLow), ciHigh: Number(input.ciHigh) });
    default:
      return { ok: false, issues: [issue('unknown_tool', `Unknown tool: ${kind}`)] };
  }
}
