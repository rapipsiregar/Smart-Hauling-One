import { ShiftReport, UnpairedCrossing } from "./types";
import { downloadBlob } from "./download";
import {
  PRESET_LABEL, ShiftWindow, deriveShiftMetrics, formatWindow,
  shiftReportFileStem, windowEnd, windowHours, windowStart,
} from "./shift-metrics";

const REASON_LABEL: Record<UnpairedCrossing["reason"], string> = {
  "missing-out": "Masuk, belum keluar",
  "missing-in": "Keluar, belum masuk",
  "no-direction": "Arah gate tidak diketahui",
  "unidentified-hull": "Nomor lambung tidak terbaca",
};

const HEADER_FILL = "FF0F172A";
const round1 = (n: number) => Math.round(n * 10) / 10;

export function shiftReportXlsxFilename(win: ShiftWindow): string {
  return `${shiftReportFileStem(win)}.xlsx`;
}

/**
 * Build the shift sheet as a real .xlsx workbook and download it.
 *
 * Four sheets so each audience gets a flat table it can filter: Ringkasan,
 * Per Gate, Per Nomor Lambung, Belum Berpasangan. Numbers are written as
 * numbers (not strings) so Excel can sum them without retyping the column.
 *
 * exceljs is loaded lazily — like jsPDF — so it stays out of the initial bundle.
 * (SheetJS was rejected: the npm `xlsx` package is stale and carries
 * CVE-2023-30533.)
 */
export async function downloadShiftReportXlsx(
  report: ShiftReport,
  win: ShiftWindow,
  generatedAt: Date = new Date(),
): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Integrated Smart Hauling System";
  wb.created = generatedAt;

  const hours = windowHours(win);
  const m = deriveShiftMetrics(report, hours);

  // --- Ringkasan -------------------------------------------------------------
  const ringkasan = wb.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Keterangan", key: "k", width: 32 },
    { header: "Nilai", key: "v", width: 26 },
    { header: "Dasar", key: "d", width: 30 },
  ];
  const meta: [string, string | number, string][] = [
    ["Shift", PRESET_LABEL[win.preset], "dipilih operator"],
    ["Awal jendela", windowStart(win), "dipilih operator"],
    ["Akhir jendela", windowEnd(win), "dipilih operator"],
    ["Panjang jendela (jam)", hours, "turunan"],
    ["Tanggal run deteksi", report.date, "terukur"],
    ["Model deteksi", report.model, "terukur"],
    ["Dibuat pada", generatedAt.toISOString(), "sistem"],
    ["", "", ""],
    ["Ritase (IN + OUT)", report.totalRitase, "terukur"],
    // Beside the headline rather than folded into it: haulage by units the
    // master does not list is a registry gap somebody has to close.
    ["Ritase belum terdaftar", report.unregisteredRitase, "terukur"],
    ["Nomor belum terdaftar", report.unregisteredHulls.join(", ") || "—", "terukur"],
    ["Total lintasan gate", report.totalCrossings, "terukur"],
    ["Belum berpasangan", report.unpairedCount, "terukur"],
    ["Metode pemasangan", report.pairingBasis === "chronological" ? "kronologis" : "hitungan IN/OUT", "sistem"],
    ["Waktu lintasan tersedia", report.hasCrossingTimes ? "ya" : "belum", "sistem"],
    ["Ritase per jam", m.ritasePerHour, "turunan atas jendela"],
    ["Lintasan teridentifikasi", report.identified, "terukur"],
    ["Lintasan tidak dikenal", report.unknown, "terukur"],
    ["Lintasan terekonsiliasi", report.reconciled, "terukur"],
    ["Nomor lambung unik", report.uniqueTrucks, "terukur"],
    ["Total pembacaan nomor", report.totalReads, "terukur"],
    ["Rata-rata keyakinan (%)", round1(report.avgConfidence), "terukur"],
  ];
  meta.forEach(([k, v, d]) => ringkasan.addRow({ k, v, d }));

  // --- Per Gate --------------------------------------------------------------
  const perGate = wb.addWorksheet("Per Gate");
  perGate.columns = [
    { header: "Gate", key: "gate", width: 22 },
    { header: "Masuk", key: "in", width: 10 },
    { header: "Keluar", key: "out", width: 10 },
    { header: "Tanpa arah", key: "none", width: 12 },
    { header: "Total", key: "total", width: 10 },
    { header: "Porsi (%)", key: "share", width: 12 },
  ];
  for (const g of report.perGate) {
    const total = g.inbound + g.outbound + g.undirected;
    perGate.addRow({
      gate: g.gate, in: g.inbound, out: g.outbound, none: g.undirected, total,
      share: report.totalCrossings > 0 ? Math.round((total / report.totalCrossings) * 100) : 0,
    });
  }

  // --- Per Nomor Lambung -----------------------------------------------------
  const perTruck = wb.addWorksheet("Per Nomor Lambung");
  perTruck.columns = [
    { header: "Nomor Lambung", key: "hull", width: 20 },
    // Its own column, so the hull id stays clean to sort, filter and copy into
    // the master.
    { header: "Status", key: "status", width: 18 },
    { header: "Ritase", key: "ritase", width: 10 },
    { header: "Masuk", key: "in", width: 10 },
    { header: "Keluar", key: "out", width: 10 },
    { header: "Belum berpasangan", key: "unpaired", width: 20 },
    { header: "Pembacaan Nomor", key: "reads", width: 16 },
    { header: "Keyakinan tertinggi (%)", key: "conf", width: 22 },
    { header: "Rata-rata siklus (menit)", key: "cycle", width: 24 },
  ];
  for (const t of report.perTruck) {
    perTruck.addRow({
      hull: t.hullId,
      status: t.registered ? "terdaftar" : "BELUM TERDAFTAR",
      ritase: t.ritase, in: t.inCount, out: t.outCount,
      unpaired: t.unpaired, reads: t.reads, conf: round1(t.bestConf),
      cycle: t.avgCycleSeconds === null ? "" : round1(t.avgCycleSeconds / 60),
    });
  }
  const totalRow = perTruck.addRow({
    hull: "TOTAL",
    ritase: report.perTruck.reduce((s, t) => s + t.ritase, 0),
    in: report.perTruck.reduce((s, t) => s + t.inCount, 0),
    out: report.perTruck.reduce((s, t) => s + t.outCount, 0),
    unpaired: report.perTruck.reduce((s, t) => s + t.unpaired, 0),
    reads: report.perTruck.reduce((s, t) => s + t.reads, 0),
  });
  totalRow.font = { bold: true };

  // --- Belum Berpasangan -----------------------------------------------------
  const unpaired = wb.addWorksheet("Belum Berpasangan");
  unpaired.columns = [
    { header: "Nomor Lambung", key: "hull", width: 20 },
    { header: "Gate", key: "gate", width: 22 },
    { header: "Arah", key: "dir", width: 12 },
    { header: "Waktu lintasan", key: "at", width: 22 },
    { header: "Keterangan", key: "why", width: 30 },
  ];
  for (const u of report.unpaired) {
    unpaired.addRow({
      hull: u.hullId, gate: u.lane,
      dir: u.direction === "inbound" ? "Masuk" : u.direction === "outbound" ? "Keluar" : "—",
      at: u.crossedAt ?? "belum tersedia",
      why: REASON_LABEL[u.reason],
    });
  }

  for (const sheet of [ringkasan, perGate, perTruck, unpaired]) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = shiftReportXlsxFilename(win);
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  return filename;
}

/** Used by the PDF sheet header too, so both exports state the same window. */
export function shiftWindowCaption(win: ShiftWindow): string {
  return formatWindow(win);
}
