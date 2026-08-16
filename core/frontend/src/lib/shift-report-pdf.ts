import { ShiftReport, UnpairedCrossing } from "./types";
import { downloadBlob } from "./download";
import {
  CONTENT_W, Doc, INK, MARGIN, MUTED, PAGE_H, PAGE_W, RULE,
  numericFrom, pdfSafe, stampPageFooters, titledTable,
} from "./pdf-kit";
import {
  MiningDayWindow, windowLabel,
  deriveShiftMetrics, formatWindow, shiftReportFileStem, windowHours,
} from "./shift-metrics";

const round1 = (n: number) => Math.round(n * 10) / 10;

const REASON_LABEL: Record<UnpairedCrossing["reason"], string> = {
  "missing-out": "Masuk, belum keluar",
  "missing-in": "Keluar, belum masuk",
  "no-direction": "Arah gate tidak diketahui",
  "unidentified-hull": "Nomor lambung tidak terbaca",
};

export function shiftReportPdfFilename(win: MiningDayWindow): string {
  return `${shiftReportFileStem(win)}.pdf`;
}

/**
 * Build the shift-end sheet as a real PDF document and hand it to the browser
 * as a download — no print dialog involved. Returns the filename used.
 */
export async function downloadShiftReportPdf(
  report: ShiftReport,
  win: MiningDayWindow,
  generatedAt: Date = new Date(),
): Promise<string> {
  const filename = shiftReportPdfFilename(win);
  downloadBlob(filename, await renderShiftReportPdf(report, win, generatedAt));
  return filename;
}

/**
 * Render the report to PDF bytes.
 *
 * jsPDF is imported dynamically so ~400 kB of PDF machinery stays out of the
 * initial bundle and only loads when an operator actually asks for the report.
 * Output is vector text (selectable and searchable), not a rasterised screenshot
 * of the page, so the tables stay legible and paginate properly.
 */
export async function renderShiftReportPdf(
  report: ShiftReport,
  win: MiningDayWindow,
  generatedAt: Date = new Date(),
): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const hours = windowHours(win);
  const m = deriveShiftMetrics(report, hours);

  let y = drawMasthead(doc, report, win, m.ritase, generatedAt);

  y = titledTable(doc, autoTable, y, "Ringkasan Kinerja Shift", {
    head: [["Keterangan", "Nilai", "Satuan", "Dasar"]],
    body: [
      ["Total Ritase Selesai (Masuk + Keluar)", m.ritase, "siklus", "terukur"],
      // Beside the headline, not folded into it. A shift partly hauled by units
      // the master has never heard of is a registry gap, and this is the line
      // that gets it noticed by whoever signs the page.
      ["  — di antaranya oleh armada belum terdaftar", report.unregisteredRitase, "siklus", "terukur"],
      ["Total truk melintas gerbang", report.totalCrossings, "lintasan", "terukur"],
      ["Truk tanpa pasangan (IN/OUT)", report.unpairedCount, "lintasan", "terukur"],
      ["Rata-rata ritase per jam", m.ritasePerHour, "siklus/jam", "turunan atas jendela"],
      ["Lintasan teridentifikasi kamera", report.identified, "lintasan", "terukur"],
      ["Lintasan tidak dikenal (gagal baca)", report.unknown, "lintasan", "terukur"],
      ["Lintasan terekonsiliasi otomatis", report.reconciled, "lintasan", "terukur"],
      ["Jumlah armada aktif", report.uniqueTrucks, "unit", "terukur"],
      ["Total pembacaan kamera", report.totalReads.toLocaleString("id-ID"), "baca", "terukur"],
      ["Tingkat akurasi kamera rata-rata", `${round1(report.avgConfidence)}%`, "", "terukur"],
      ["Metode pemasangan", report.pairingBasis === "chronological" ? "kronologis" : "hitungan IN/OUT", "", "sistem"],
      ["Ketersediaan waktu sensor", report.hasCrossingTimes ? "tersedia" : "belum tersedia", "", "sistem"],
    ],
    columnStyles: { 1: { halign: "right" }, 3: { textColor: MUTED } },
  });

  // Checkpoint first: it is the cut the site plans by and the one this sheet
  // gets reconciled against. The per-area table below merges checkpoints that
  // share an area, so it cannot serve that purpose.
  if (report.perCheckpoint?.length) {
    y = titledTable(doc, autoTable, y, "Ritase per Pos Cek", {
      head: [["Pos Cek", "Ritase", "Masuk (IN)", "Keluar (OUT)", "Tanpa Arah", "Total Melintas"]],
      body: report.perCheckpoint.map((cp) => [
        cp.checkpoint, cp.ritase, cp.inbound, cp.outbound, cp.undirected, cp.crossings,
      ]),
      columnStyles: numericFrom(1),
    });
  }

  y = titledTable(doc, autoTable, y, "Lalu Lintas per Area Gerbang", {
    head: [["Nama Gerbang", "Masuk (IN)", "Keluar (OUT)", "Tanpa Arah", "Total Melintas", "Porsi Trafik"]],
    body: report.perGate.map((g) => {
      const total = g.inbound + g.outbound + g.undirected;
      const share = report.totalCrossings > 0
        ? Math.round((total / report.totalCrossings) * 100) : 0;
      return [g.gate, g.inbound, g.outbound, g.undirected, total, `${share}%`];
    }),
    columnStyles: numericFrom(1),
  });

  if (report.perTruck.length > 0) {
    const sum = (pick: (t: ShiftReport["perTruck"][number]) => number) =>
      report.perTruck.reduce((total, t) => total + pick(t), 0);
    y = titledTable(doc, autoTable, y, "Kinerja Per Nomor Lambung Truk", {
      head: [["Nomor Lambung", "Status Registrasi", "Ritase Selesai", "Masuk", "Keluar", "Tanpa Pasangan", "Deteksi Kamera", "Akurasi Tertinggi"]],
      body: report.perTruck.map((t) => [
        t.hullId,
        // Its own column rather than a mark on the hull id: the number stays
        // clean to read off and to type into the master.
        t.registered ? "terdaftar" : "BELUM TERDAFTAR",
        t.ritase,
        t.inCount,
        t.outCount,
        t.unpaired,
        t.reads.toLocaleString("id-ID"),
        `${round1(t.bestConf)}%`,
      ]),
      foot: [[
        "TOTAL AKUMULASI",
        "",
        sum((t) => t.ritase),
        sum((t) => t.inCount),
        sum((t) => t.outCount),
        sum((t) => t.unpaired),
        sum((t) => t.reads).toLocaleString("id-ID"),
        "",
      ]],
      columnStyles: numericFrom(2),
    });
  }

  if (report.unpaired.length > 0) {
    y = titledTable(doc, autoTable, y, "Daftar Lintasan Tanpa Pasangan (Untuk Audit)", {
      head: [["Nomor Lambung", "Pintu Gerbang", "Arah", "Waktu Melintas", "Penyebab / Keterangan"]],
      body: report.unpaired.map((u) => [
        u.hullId,
        u.lane,
        u.direction === "inbound" ? "Masuk" : u.direction === "outbound" ? "Keluar" : "-",
        u.crossedAt ?? "belum tersedia",
        REASON_LABEL[u.reason],
      ]),
    });
  }

  drawSignOff(doc, report, y);
  stampPageFooters(doc, `Integrated Smart Hauling System  ·  ${formatWindow(win)}`);

  return doc.output("blob") as Blob;
}

/** Document header carrying the provenance an audit sheet needs. */
function drawMasthead(
  doc: Doc, report: ShiftReport, win: MiningDayWindow, trips: number, generatedAt: Date,
): number {
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  doc.text("SISTEM PINTAR PEMANTAUAN RITASE (ISHS)", MARGIN, MARGIN + 2);

  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...INK);
  doc.text("Laporan Ritase Shift Tambang", MARGIN, MARGIN + 10);

  const badge = pdfSafe(windowLabel(win).toUpperCase());
  doc.setFontSize(9);
  const badgeW = doc.getTextWidth(badge) + 8;
  doc.setDrawColor(...INK).setLineWidth(0.3);
  doc.rect(PAGE_W - MARGIN - badgeW, MARGIN + 4.5, badgeW, 7);
  doc.text(badge, PAGE_W - MARGIN - badgeW / 2, MARGIN + 9.3, { align: "center" });

  doc.setLineWidth(0.6);
  doc.line(MARGIN, MARGIN + 14, PAGE_W - MARGIN, MARGIN + 14);

  const meta: [string, string][] = [
    ["Jendela laporan", formatWindow(win)],
    ["Panjang jendela", `${windowHours(win)} jam`],
    ["Run deteksi", report.date],
    ["Model", report.model],
    ["Ritase (IN + OUT)", String(trips)],
    ["Dicetak", generatedAt.toLocaleString("id-ID")],
  ];
  const colW = CONTENT_W / 3;
  meta.forEach(([label, value], i) => {
    const x = MARGIN + (i % 3) * colW;
    const rowY = MARGIN + 20 + Math.floor(i / 3) * 9;
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(pdfSafe(label.toUpperCase()), x, rowY);
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK);
    doc.text(doc.splitTextToSize(pdfSafe(value), colW - 3)[0], x, rowY + 4);
  });

  return MARGIN + 42;
}

/** Disclaimer plus the two signature blocks, kept whole on one page. */
function drawSignOff(doc: Doc, report: ShiftReport, y: number): void {
  const timeNote = report.hasCrossingTimes
    ? "Pemasangan dilakukan secara kronologis berdasarkan waktu lintasan."
    : "Waktu lintasan belum tersedia, sehingga pemasangan memakai hitungan IN/OUT per nomor lambung "
      + "dan durasi siklus belum dapat dihitung.";
  // Named in the disclaimer as well as flagged in the table: a reader who only
  // scans the prose still learns that part of this shift's haulage belongs to
  // units nobody has registered yet.
  const unregNote = report.unregisteredRitase > 0
    ? `${report.unregisteredRitase} ritase dikerjakan oleh nomor lambung yang terbaca yakin `
      + `tetapi belum ada di master data (${report.unregisteredHulls.join(", ")}); `
      + `ritase tersebut tetap dihitung dan ditandai BELUM TERDAFTAR agar dapat didaftarkan. `
    : "";
  const disclaimer =
    `Satu ritase = satu lintasan masuk (IN) berpasangan dengan satu lintasan keluar (OUT) pada nomor `
    + `lambung yang sama; gate masuk dan keluar boleh sama. ${timeNote} `
    + `Lintasan yang tidak berpasangan tidak dibuang dan tetap dicantumkan. ${unregNote}`
    + `Seluruh angka terukur dari run deteksi ${report.date} (model ${report.model}). `
    + `Dihasilkan oleh Integrated Smart Hauling System.`;
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  const lines = doc.splitTextToSize(pdfSafe(disclaimer), CONTENT_W) as string[];

  if (y + lines.length * 3.4 + 32 > PAGE_H - MARGIN - 8) {
    doc.addPage();
    y = MARGIN;
  }

  doc.setDrawColor(...RULE).setLineWidth(0.2);
  doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
  doc.text(lines, MARGIN, y);

  const sigY = y + lines.length * 3.4 + 22;
  const sigW = (CONTENT_W - 20) / 2;
  ["Disiapkan Oleh: Pengawas Lapangan", "Disetujui Oleh: Superintendent Tambang"].forEach((role, i) => {
    const x = MARGIN + i * (sigW + 20);
    doc.setDrawColor(...INK).setLineWidth(0.3);
    doc.line(x, sigY, x + sigW, sigY);
    doc.setFontSize(7.5).setTextColor(...MUTED);
    doc.text(pdfSafe(role.toUpperCase()), x, sigY + 4);
  });
}
