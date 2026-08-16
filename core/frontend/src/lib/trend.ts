import { RitaseTrend, TrendBucket, TrendGranularity } from "./types";

/**
 * Checkpoint colours for the trend chart.
 *
 * Slots 1–4 of the validated categorical palette, in fixed order — CP 01 is
 * always blue whatever the filter leaves on screen. Colour follows the
 * checkpoint, never its rank, so hiding a busy checkpoint must not repaint the
 * others into different hues and silently rewrite what the reader learned.
 *
 * Both columns were run through the palette validator against this app's own
 * surfaces (#eef1f6 light, #07090d dark): every hard gate passes in both modes.
 * Light mode trips the contrast warning, which obliges relief — hence the table
 * view below the chart, which is also the "total penjumlahan" the site asked
 * for, so one thing serves both needs.
 */
export const CHECKPOINT_COLORS_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
export const CHECKPOINT_COLORS_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500"];

/** Anything past the fourth checkpoint folds in here rather than inventing a hue. */
export const OVERFLOW_COLOR_LIGHT = "#6b7688";
export const OVERFLOW_COLOR_DARK = "#8b94a6";

export interface GranularityOption {
  value: TrendGranularity;
  label: string;
}

export const GRANULARITIES: GranularityOption[] = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
  { value: "year", label: "Tahunan" },
];

/**
 * Colour lookup keyed by checkpoint NAME, built once from the full roster.
 *
 * Built from `trend.checkpoints` (every checkpoint in the period) rather than
 * from whatever a bucket happens to contain, so a checkpoint idle on Tuesday
 * keeps its colour on Wednesday.
 */
export function checkpointColors(names: string[], dark: boolean): Record<string, string> {
  const palette = dark ? CHECKPOINT_COLORS_DARK : CHECKPOINT_COLORS_LIGHT;
  const overflow = dark ? OVERFLOW_COLOR_DARK : OVERFLOW_COLOR_LIGHT;
  const map: Record<string, string> = {};
  names.forEach((name, i) => {
    map[name] = i < palette.length ? palette[i] : overflow;
  });
  return map;
}

/** Human-facing bucket label. The raw key stays sortable; this one reads. */
export function formatBucket(bucket: string, granularity: TrendGranularity): string {
  if (granularity === "day") {
    const [y, m, d] = bucket.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  }
  if (granularity === "week") {
    const [y, w] = bucket.split("-W");
    return `Mg ${Number(w)}/${y.slice(2)}`;
  }
  if (granularity === "month") {
    const [y, m] = bucket.split("-");
    const names = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                   "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${names[Number(m) - 1] ?? m} ${y.slice(2)}`;
  }
  return bucket;
}

/** The tallest bar, and never zero — an all-empty series must not divide by 0. */
export function peakRitase(series: TrendBucket[]): number {
  return Math.max(1, ...series.map((b) => b.ritase));
}

/** Column totals for the table view, and the grand total the site asked for. */
export interface TrendTotals {
  perCheckpoint: Record<string, number>;
  ritase: number;
  crossings: number;
}

export function trendTotals(trend: RitaseTrend): TrendTotals {
  const perCheckpoint: Record<string, number> = {};
  for (const name of trend.checkpoints) perCheckpoint[name] = 0;
  let ritase = 0;
  let crossings = 0;
  for (const bucket of trend.series) {
    ritase += bucket.ritase;
    crossings += bucket.crossings;
    for (const [name, value] of Object.entries(bucket.perCheckpoint)) {
      perCheckpoint[name] = (perCheckpoint[name] ?? 0) + value;
    }
  }
  return { perCheckpoint, ritase, crossings };
}

/**
 * A bucket's stacked segments, bottom-up, in the roster's fixed order.
 *
 * Zero-valued checkpoints are dropped: a 0px segment cannot be hovered or seen,
 * and keeping it would put an invisible gap-spacer in the stack.
 */
export interface StackSegment {
  checkpoint: string;
  value: number;
  /** Share of this bucket's total, 0–1. */
  fraction: number;
}

export function stackSegments(bucket: TrendBucket, roster: string[]): StackSegment[] {
  const total = bucket.ritase || 1;
  return roster
    .map((checkpoint) => ({
      checkpoint,
      value: bucket.perCheckpoint[checkpoint] ?? 0,
      fraction: (bucket.perCheckpoint[checkpoint] ?? 0) / total,
    }))
    .filter((segment) => segment.value > 0);
}

/**
 * Default window: the last `days` mining days, ending today.
 *
 * Uses the mining day's own rollover — before 06:00 the current working day is
 * still yesterday's date, so a shift-end check at 03:00 opens on the shift the
 * operator is actually finishing rather than one that has not started.
 */
export function defaultRange(days = 30, now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const end = new Date(now);
  if (end.getHours() < 6) end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: iso(start), endDate: iso(end) };
}

/** Local calendar date as YYYY-MM-DD. `toISOString` would shift by the UTC offset. */
export function iso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
