import { ShiftReport } from "./types";

/**
 * The reporting window, in MINING days.
 *
 * A mining day runs 06:00 to 06:00 the next morning — the site's own cut, and
 * the one BIB's reports use. The 12-hour day/night shift presets that used to
 * live here are gone: a sheet cut per shift splits each night's haulage across
 * two documents and reconciles against neither.
 *
 * Both ends are inclusive mining dates. One date on both sides is one full
 * working day, which is the common case.
 *
 * The window is now sent to the server, which resolves it against the single
 * definition in `app/services/mining_day.py`. It used to be applied client-side
 * as a label over an unfiltered total — the numbers did not actually change
 * when the window did.
 */
export interface MiningDayWindow {
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
}

/** The hour a mining day rolls over. Mirrors the server constant. */
export const MINING_DAY_START_HOUR = 6;

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Today's MINING date.
 *
 * Before 06:00 the working day is still yesterday's — a supervisor closing out
 * at 03:00 is finishing the shift that began the previous evening, and opening
 * the sheet on a day that has not started yet would show them zeros.
 */
export function todayIso(now: Date = new Date()): string {
  const d = new Date(now);
  if (d.getHours() < MINING_DAY_START_HOUR) d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The default sheet: today's mining day. */
export function todayWindow(now: Date = new Date()): MiningDayWindow {
  const today = todayIso(now);
  return { startDate: today, endDate: today };
}

/** How many mining days the window spans; at least one. */
export function windowDays(w: MiningDayWindow): number {
  const start = Date.parse(`${w.startDate}T00:00:00Z`);
  const end = Date.parse(`${w.endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Window length in hours — a mining day is a full 24. */
export function windowHours(w: MiningDayWindow): number {
  return windowDays(w) * 24;
}

export function windowStart(w: MiningDayWindow): string {
  return `${w.startDate} 06:00`;
}

/** Exclusive end: 06:00 the morning AFTER the last day in the window. */
export function windowEnd(w: MiningDayWindow): string {
  return `${addDays(w.endDate, 1)} 06:00`;
}

/** Human-readable window, collapsing the dates when it is a single day. */
export function formatWindow(w: MiningDayWindow): string {
  if (w.startDate === w.endDate) {
    return `${w.startDate} 06:00 → ${addDays(w.startDate, 1)} 06:00`;
  }
  return `${windowStart(w)} → ${windowEnd(w)}`;
}

/** Short caption for the sheet header. */
export function windowLabel(w: MiningDayWindow): string {
  const days = windowDays(w);
  if (days === 1) return `Hari Tambang ${w.startDate}`;
  return `${w.startDate} s/d ${w.endDate} (${days} hari tambang)`;
}

export interface ShiftMetrics {
  ritase: number;
  crossings: number;
  unpaired: number;
  precision: number;
  reconRate: number;
  gatePeak: number;
  ritasePerHour: number;
}

export function deriveShiftMetrics(report: ShiftReport, hours: number): ShiftMetrics {
  const ritase = report.totalRitase;
  const gateTotals = report.perGate.map((g) => g.inbound + g.outbound + g.undirected);
  return {
    ritase,
    crossings: report.totalCrossings,
    unpaired: report.unpairedCount,
    precision: report.avgConfidence,
    reconRate:
      report.totalCrossings > 0
        ? Math.round((report.reconciled / report.totalCrossings) * 100)
        : 0,
    gatePeak: Math.max(...gateTotals, 1),
    ritasePerHour: hours > 0 ? Math.round((ritase / hours) * 100) / 100 : 0,
  };
}

/** True when there is anything worth exporting. */
export function hasReportData(report: ShiftReport): boolean {
  return report.perTruck.length > 0 || report.perGate.length > 0 || report.totalCrossings > 0;
}

/**
 * Shared filename stem for the Excel and PDF exports, e.g.
 * `LAPORAN_RITASE_HARITAMBANG_2026-08-16`. Callers append the extension.
 */
export function shiftReportFileStem(w: MiningDayWindow): string {
  const span = w.startDate === w.endDate ? w.startDate : `${w.startDate}_sd_${w.endDate}`;
  const stem = `LAPORAN_RITASE_HARITAMBANG_${span}`;
  return stem.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
