import { ShiftReport } from "./types";

export type ShiftPreset = "day" | "night" | "custom";

/** The reporting window the operator scoped the sheet to. */
export interface ShiftWindow {
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  preset: ShiftPreset;
}

export const PRESET_HOURS: Record<"day" | "night", [string, string]> = {
  day: ["07:00", "19:00"],
  night: ["19:00", "07:00"],
};

export const PRESET_LABEL: Record<ShiftPreset, string> = {
  day: "Shift Siang",
  night: "Shift Malam",
  custom: "Kustom",
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

/** Night shifts roll past midnight, so the window can end on the following day. */
export function crossesMidnight(w: ShiftWindow): boolean {
  return minutesOfDay(w.endTime) <= minutesOfDay(w.startTime);
}

export function windowEndDate(w: ShiftWindow): string {
  return crossesMidnight(w) ? addDays(w.date, 1) : w.date;
}

export function windowStart(w: ShiftWindow): string {
  return `${w.date} ${w.startTime}`;
}

export function windowEnd(w: ShiftWindow): string {
  return `${windowEndDate(w)} ${w.endTime}`;
}

/** Human-readable window, collapsing the end date when it stays on the same day. */
export function formatWindow(w: ShiftWindow): string {
  return crossesMidnight(w)
    ? `${windowStart(w)} → ${windowEnd(w)}`
    : `${w.date} ${w.startTime} → ${w.endTime}`;
}

/** Window length in hours, wrapping around midnight for night shifts. */
export function windowHours(w: ShiftWindow): number {
  let mins = minutesOfDay(w.endTime) - minutesOfDay(w.startTime);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
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
 * `LAPORAN_RITASE_2026-07-19_MALAM_1900-0700`. Callers append the extension.
 */
export function shiftReportFileStem(w: ShiftWindow): string {
  const shift = w.preset === "day" ? "SIANG" : w.preset === "night" ? "MALAM" : "KUSTOM";
  const hhmm = (t: string) => t.replace(":", "");
  const stem = `LAPORAN_RITASE_${w.date}_${shift}_${hhmm(w.startTime)}-${hhmm(w.endTime)}`;
  return stem.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
