// Excel exporter for Shift Report using exceljs
import ExcelJS from 'exceljs';
import { ShiftReport } from './shift-report-data';

function headerStyle(color = 'FF1E293B'): Partial<ExcelJS.Style> {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: color } },
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    },
  };
}

function dataStyle(bg = 'FF0F172A'): Partial<ExcelJS.Style> {
  return {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    font: { color: { argb: 'FFE2E8F0' }, size: 10 },
    alignment: { horizontal: 'left', vertical: 'middle' },
  };
}

export async function downloadShiftReportXlsx(
  report: ShiftReport,
  shiftLabel = 'Semua Shift',
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ISHS – Integrated Smart Hauling System';
  wb.created = new Date();

  // ── Sheet 1: KPI Ringkasan ────────────────────────────────────────────────
  const kpiSheet = wb.addWorksheet('Ringkasan KPI');
  kpiSheet.columns = [
    { key: 'metric', width: 32 },
    { key: 'value',  width: 20 },
  ];
  const kpiTitle = kpiSheet.addRow(['ISHS – Laporan Ritase Harian']);
  kpiTitle.font = { bold: true, size: 14, color: { argb: 'FFF59E0B' } };
  kpiSheet.mergeCells('A1:B1');
  kpiSheet.addRow(['Tanggal', report.date]);
  kpiSheet.addRow(['Shift',   shiftLabel]);
  kpiSheet.addRow(['Model Deteksi', report.model]);
  kpiSheet.addRow([]);

  const kpiHeaders = kpiSheet.addRow(['Metrik', 'Nilai']);
  kpiHeaders.eachCell(cell => Object.assign(cell, headerStyle('FF1E40AF')));

  const kpiData = [
    ['Total Ritase Selesai',       report.totalRitase],
    ['Total Lintasan Gate',        report.totalCrossings],
    ['Armada Unik Terbaca',        report.uniqueTrucks],
    ['Lintasan Teridentifikasi',   report.identified],
    ['Lintasan Gagal Dibaca',      report.unknown],
    ['Akurasi Deteksi Rata-rata',  `${(report.avgConfidence * 100).toFixed(1)}%`],
    ['Lintasan Belum Berpasangan', report.unpairedCount],
    ['Total Frame Dibaca',         report.totalReads],
  ];
  kpiData.forEach(([m, v]) => {
    const r = kpiSheet.addRow([m, v]);
    r.eachCell(cell => Object.assign(cell, dataStyle()));
  });

  // ── Sheet 2: Per Gate ─────────────────────────────────────────────────────
  const gateSheet = wb.addWorksheet('Per Gate');
  gateSheet.columns = [
    { key: 'gate',       width: 30 },
    { key: 'inbound',    width: 15 },
    { key: 'outbound',   width: 15 },
    { key: 'undirected', width: 18 },
    { key: 'total',      width: 15 },
  ];
  const gateHeaders = gateSheet.addRow(['Gerbang', 'Masuk (IN)', 'Keluar (OUT)', 'Tanpa Arah', 'Total']);
  gateHeaders.eachCell(cell => Object.assign(cell, headerStyle('FF065F46')));

  report.perGate.forEach(g => {
    const total = g.inbound + g.outbound + g.undirected;
    const r = gateSheet.addRow([g.gate, g.inbound, g.outbound, g.undirected, total]);
    r.eachCell(cell => Object.assign(cell, dataStyle()));
  });

  // ── Sheet 3: Per Truck ───────────────────────────────────────────────────
  const truckSheet = wb.addWorksheet('Per Truk');
  truckSheet.columns = [
    { key: 'hull',      width: 16 },
    { key: 'status',    width: 14 },
    { key: 'ritase',    width: 12 },
    { key: 'in',        width: 12 },
    { key: 'out',       width: 12 },
    { key: 'conf',      width: 16 },
    { key: 'cycle',     width: 18 },
  ];
  const truckHeaders = truckSheet.addRow([
    'Nomor Lambung', 'Status Master', 'Ritase', 'Masuk', 'Keluar', 'Conf Terbaik', 'Siklus Rata-rata',
  ]);
  truckHeaders.eachCell(cell => Object.assign(cell, headerStyle('FF7C3AED')));

  report.perTruck.forEach(t => {
    const cycleMin = t.avgCycleSeconds ? `${(t.avgCycleSeconds / 60).toFixed(0)} mnt` : '—';
    const r = truckSheet.addRow([
      t.hullId,
      t.registered ? 'Terdaftar' : 'BELUM TERDAFTAR',
      t.ritase,
      t.inCount,
      t.outCount,
      `${(t.bestConf * 100).toFixed(1)}%`,
      cycleMin,
    ]);
    r.eachCell(cell => Object.assign(cell, dataStyle(t.registered ? 'FF0F172A' : 'FF3B0000')));
  });

  // ── Sheet 4: Unpaired Crossings ──────────────────────────────────────────
  if (report.unpaired.length > 0) {
    const upSheet = wb.addWorksheet('Lintasan Belum Berpasangan');
    upSheet.columns = [
      { key: 'hull', width: 16 },
      { key: 'lane', width: 24 },
      { key: 'dir',  width: 14 },
      { key: 'time', width: 16 },
      { key: 'reason', width: 30 },
    ];
    const upHeaders = upSheet.addRow(['Nomor Lambung', 'Gerbang', 'Arah', 'Waktu', 'Sebab']);
    upHeaders.eachCell(cell => Object.assign(cell, headerStyle('FF991B1B')));

    const REASONS: Record<string, string> = {
      'missing-out':        'Belum terbaca keluar',
      'missing-in':         'Tidak ada catatan masuk',
      'no-direction':       'Arah gate tidak diketahui',
      'unidentified-hull':  'Nomor lambung tidak terbaca',
    };
    report.unpaired.forEach(u => {
      const r = upSheet.addRow([
        u.hullId,
        u.lane,
        u.direction ?? '—',
        u.crossedAt,
        REASONS[u.reason] ?? u.reason,
      ]);
      r.eachCell(cell => Object.assign(cell, dataStyle('FF1C0000')));
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `ISHS_Laporan_Ritase_${report.date}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
