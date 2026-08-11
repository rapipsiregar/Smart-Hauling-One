// PDF exporter for Shift Report using jspdf + jspdf-autotable
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShiftReport } from './shift-report-data';

export async function downloadShiftReportPdf(
  report: ShiftReport,
  shiftLabel = 'Semua Shift',
): Promise<string> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 28, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INTEGRATED SMART HAULING SYSTEM', W / 2, 10, { align: 'center' });

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Laporan Ritase Harian  ·  ${report.date}  ·  ${shiftLabel}`, W / 2, 17, { align: 'center' });
  doc.text(`Model Deteksi: ${report.model}`, W / 2, 23, { align: 'center' });

  let y = 34;

  // ── KPI Summary Grid ──────────────────────────────────────────────────────
  const kpis = [
    ['Total Ritase', String(report.totalRitase)],
    ['Total Lintasan', String(report.totalCrossings)],
    ['Armada Unik', String(report.uniqueTrucks)],
    ['Akurasi Deteksi', `${(report.avgConfidence * 100).toFixed(1)}%`],
    ['Teridentifikasi', String(report.identified)],
    ['Gagal Terbaca', String(report.unknown)],
  ];

  const cellW = (W - 20) / 3;
  const cellH = 14;
  kpis.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 10 + col * cellW;
    const cy = y + row * (cellH + 2);

    doc.setFillColor(30, 41, 59);
    doc.roundedRect(x, cy, cellW - 2, cellH, 2, 2, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + (cellW - 2) / 2, cy + 7, { align: 'center' });
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), x + (cellW - 2) / 2, cy + 12, { align: 'center' });
  });

  y += 2 * (cellH + 2) + 6;

  // ── Per Gate Table ────────────────────────────────────────────────────────
  doc.setTextColor(16, 185, 129);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Breakdown per Gerbang', 10, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Gerbang', 'Masuk (IN)', 'Keluar (OUT)', 'Tanpa Arah', 'Total']],
    body: report.perGate.map(g => [
      g.gate,
      String(g.inbound),
      String(g.outbound),
      String(g.undirected),
      String(g.inbound + g.outbound + g.undirected),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [6, 95, 70], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fillColor: [15, 23, 42], textColor: [226, 232, 240], fontSize: 8 },
    alternateRowStyles: { fillColor: [30, 41, 59] },
    margin: { left: 10, right: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Per Truck Table ───────────────────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 15; }
  doc.setTextColor(167, 139, 250);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Ritase Per Unit Truk', 10, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['No. Lambung', 'Ritase', 'Masuk', 'Keluar', 'Conf %', 'Siklus Avg']],
    body: report.perTruck.slice(0, 15).map(t => [
      t.hullId + (t.registered ? '' : ' ⚠'),
      String(t.ritase),
      String(t.inCount),
      String(t.outCount),
      `${(t.bestConf * 100).toFixed(1)}%`,
      t.avgCycleSeconds ? `${(t.avgCycleSeconds / 60).toFixed(0)} mnt` : '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [109, 40, 217], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fillColor: [15, 23, 42], textColor: [226, 232, 240], fontSize: 8 },
    alternateRowStyles: { fillColor: [30, 41, 59] },
    margin: { left: 10, right: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Unpaired Table ────────────────────────────────────────────────────────
  if (report.unpaired.length > 0) {
    if (y > 230) { doc.addPage(); y = 15; }
    doc.setTextColor(248, 113, 113);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Lintasan Belum Berpasangan (${report.unpairedCount})`, 10, y);
    y += 3;

    const REASONS: Record<string, string> = {
      'missing-out': 'Belum keluar',
      'missing-in': 'Tidak ada catatan masuk',
      'no-direction': 'Arah tidak diketahui',
      'unidentified-hull': 'Lambung tidak terbaca',
    };

    autoTable(doc, {
      startY: y,
      head: [['No. Lambung', 'Gerbang', 'Arah', 'Waktu', 'Sebab']],
      body: report.unpaired.map(u => [
        u.hullId,
        u.lane,
        u.direction ?? '—',
        u.crossedAt,
        REASONS[u.reason] ?? u.reason,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fillColor: [28, 0, 0], textColor: [252, 165, 165], fontSize: 8 },
      margin: { left: 10, right: 10 },
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 287, W, 10, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `ISHS – Laporan Otomatis  ·  Dicetak: ${new Date().toLocaleString('id-ID')}  ·  Hal ${p}/${pageCount}`,
      W / 2,
      293,
      { align: 'center' },
    );
  }

  const filename = `ISHS_Laporan_Ritase_${report.date}.pdf`;
  doc.save(filename);
  return filename;
}
