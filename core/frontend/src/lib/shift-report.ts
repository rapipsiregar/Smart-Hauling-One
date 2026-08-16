import { CheckpointBreakdown, GateDirectionBreakdown, PairingBasis, ShiftReport, TruckRitase, UnpairedCrossing } from "./types";

/** Fully-formed empty report, so the reporting UI still renders with no data. */
export const EMPTY_SHIFT_REPORT: ShiftReport = {
  date: new Date().toISOString().slice(0, 10),
  model: "—",
  totalRitase: 0,
  unregisteredRitase: 0,
  unregisteredHulls: [],
  totalCrossings: 0,
  unpairedCount: 0,
  pairingBasis: "count",
  hasCrossingTimes: false,
  identified: 0,
  unknown: 0,
  reconciled: 0,
  uniqueTrucks: 0,
  totalReads: 0,
  avgConfidence: 0,
  perGate: [],
  perTruck: [],
  unpaired: [],
};

export const DEMO_SHIFT_REPORT: ShiftReport = {
  date: "11 Agustus 2026",
  model: "Model Deteksi Otomatis v2",
  totalRitase: 428,
  unregisteredRitase: 0,
  unregisteredHulls: [],
  totalCrossings: 856,
  unpairedCount: 4,
  pairingBasis: "chronological",
  hasCrossingTimes: true,
  identified: 852,
  unknown: 4,
  reconciled: 428,
  uniqueTrucks: 34,
  totalReads: 3420,
  avgConfidence: 0.964,
  perGate: [
    { gate: "CP 01 (Area Selatan – KGB - IUP TIA)", inbound: 218, outbound: 0, undirected: 0 },
    { gate: "CP 02 (Area Utara – KGU CK - BIB)", inbound: 0, outbound: 210, undirected: 0 },
    { gate: "CP 03 (Area Utara – PPA - BIB)", inbound: 214, outbound: 0, undirected: 0 },
    { gate: "CP 04 (Area Selatan – Exc WS CK – IUP TIA)", inbound: 0, outbound: 214, undirected: 0 },
  ],
  perTruck: [
    { hullId: "DT-118", registered: true, ritase: 14, inCount: 14, outCount: 14, unpaired: 0, reads: 112, bestConf: 0.994, avgCycleSeconds: 2580 },
    { hullId: "DT-204", registered: true, ritase: 13, inCount: 13, outCount: 13, unpaired: 0, reads: 104, bestConf: 0.982, avgCycleSeconds: 2640 },
    { hullId: "DT-089", registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96, bestConf: 0.954, avgCycleSeconds: 2700 },
    { hullId: "DT-312", registered: true, ritase: 12, inCount: 12, outCount: 12, unpaired: 0, reads: 96, bestConf: 0.971, avgCycleSeconds: 2520 },
    { hullId: "HD2152", registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88, bestConf: 0.988, avgCycleSeconds: 2610 },
    { hullId: "HD2221", registered: true, ritase: 11, inCount: 11, outCount: 11, unpaired: 0, reads: 88, bestConf: 0.960, avgCycleSeconds: 2590 },
  ],
  unpaired: [
    { id: 101, hullId: "DT-089", lane: "CP 01 (KGB - IUP TIA)", direction: "inbound", crossedAt: "16:42:15", reason: "missing-out" },
    { id: 102, hullId: "DT-105", lane: "CP 03 (PPA - BIB)", direction: "inbound", crossedAt: "16:44:00", reason: "missing-out" },
  ],
};

export interface NormalizedShiftReport {
  report: ShiftReport;
  /** False when the payload predates the ritase contract (stale backend). */
  current: boolean;
}

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Coerce whatever `/api/shift-report` returned into a complete `ShiftReport`.
 *
 * A backend still running pre-ritase code omits `totalRitase`, `perGate`'s
 * direction split and `unpaired` altogether. Reading `.length` off the missing
 * array threw and took the whole page down, so every field is defaulted here
 * and the caller is told whether the payload was current — a stale backend
 * should show a clear notice, not zeros that look like real measurements.
 */
export function normalizeShiftReport(raw: unknown): NormalizedShiftReport {
  if (!raw || typeof raw !== "object") {
    return { report: EMPTY_SHIFT_REPORT, current: false };
  }
  const r = raw as Record<string, unknown>;
  const current = typeof r.totalRitase === "number" && Array.isArray(r.unpaired);

  const perGate = arr<Record<string, unknown>>(r.perGate).map(
    (g): GateDirectionBreakdown => ({
      gate: String(g.gate ?? "—"),
      inbound: num(g.inbound),
      outbound: num(g.outbound),
      undirected: num(g.undirected),
    }),
  );

  const perTruck = arr<Record<string, unknown>>(r.perTruck).map(
    (t): TruckRitase => ({
      hullId: String(t.hullId ?? "—"),
      // Absent on an older backend, and true is the safe reading there: that
      // build only ever recorded master units, so nothing would be mislabelled
      // "belum terdaftar" purely because the field had not shipped yet.
      registered: t.registered !== false,
      ritase: num(t.ritase),
      inCount: num(t.inCount),
      outCount: num(t.outCount),
      unpaired: num(t.unpaired),
      reads: num(t.reads),
      bestConf: num(t.bestConf),
      avgCycleSeconds: typeof t.avgCycleSeconds === "number" ? t.avgCycleSeconds : null,
    }),
  );

  // Absent on a backend that predates the checkpoint cut. Left undefined rather
  // than defaulted to [], so the sheet omits the section instead of printing an
  // empty table that reads as "no haulage anywhere".
  const perCheckpoint = Array.isArray(r.perCheckpoint)
    ? arr<Record<string, unknown>>(r.perCheckpoint).map(
        (c): CheckpointBreakdown => ({
          checkpoint: String(c.checkpoint ?? "—"),
          ritase: num(c.ritase),
          inbound: num(c.inbound),
          outbound: num(c.outbound),
          undirected: num(c.undirected),
          crossings: num(c.crossings),
          unidentified: num(c.unidentified),
        }),
      )
    : undefined;

  const unpaired = arr<Record<string, unknown>>(r.unpaired).map(
    (u): UnpairedCrossing => ({
      id: num(u.id),
      hullId: String(u.hullId ?? "—"),
      lane: String(u.lane ?? "—"),
      direction:
        u.direction === "inbound" || u.direction === "outbound" ? u.direction : null,
      crossedAt: typeof u.crossedAt === "string" ? u.crossedAt : null,
      reason:
        u.reason === "missing-in" || u.reason === "missing-out" ||
        u.reason === "no-direction" || u.reason === "unidentified-hull"
          ? u.reason
          : "no-direction",
    }),
  );

  return {
    current,
    report: {
      date: typeof r.date === "string" ? r.date : EMPTY_SHIFT_REPORT.date,
      model: typeof r.model === "string" ? r.model : "—",
      totalRitase: num(r.totalRitase),
      // Absent on an older backend; zero is the honest reading there, since that
      // build only ever recorded master units.
      unregisteredRitase: num(r.unregisteredRitase),
      unregisteredHulls: arr<string>(r.unregisteredHulls).filter(
        (h): h is string => typeof h === "string",
      ),
      totalCrossings: num(r.totalCrossings),
      unpairedCount: num(r.unpairedCount, unpaired.length),
      pairingBasis: r.pairingBasis === "chronological" ? "chronological" : ("count" as PairingBasis),
      hasCrossingTimes: r.hasCrossingTimes === true,
      identified: num(r.identified),
      unknown: num(r.unknown),
      reconciled: num(r.reconciled),
      uniqueTrucks: num(r.uniqueTrucks),
      totalReads: num(r.totalReads),
      avgConfidence: num(r.avgConfidence),
      perGate,
      perCheckpoint,
      miningDayStartHour: typeof r.miningDayStartHour === "number" ? r.miningDayStartHour : 6,
      startDate: typeof r.startDate === "string" ? r.startDate : null,
      endDate: typeof r.endDate === "string" ? r.endDate : null,
      perTruck,
      unpaired,
    },
  };
}
