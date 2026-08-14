import { ShiftReport, UnpairedCrossing } from "./types";
import { downloadBlob } from "./download";
import { api } from "./api-client";
import {
  belongsToCompany, pairHullEvents, applyGlobalExcelStyle, buildObDariCompanySheet
} from "./excel-recap-sheet";
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

const round1 = (n: number) => Math.round(n * 10) / 10;

export function shiftReportXlsxFilename(win: ShiftWindow, generatedAt: Date): string {
  const company = win.company || "BIB";
  const shiftDate = win.date;
  const pad = (n: number) => String(n).padStart(2, "0");
  const expTime = `${pad(generatedAt.getHours())}${pad(generatedAt.getMinutes())}`;
  return `LAPORAN_RITASE_${company}_${shiftDate}_${expTime}.xlsx`;
}

export async function downloadShiftReportXlsx(
  report: ShiftReport,
  win: ShiftWindow,
  generatedAt: Date = new Date(),
): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Integrated Smart Hauling System";
  wb.created = generatedAt;

  // 1. Ambil data crossings dan lakukan penyaringan terpadu
  let allCrossings: any[] = [];
  try {
    allCrossings = await api.getCrossingEvents();
  } catch (err) {
    console.warn("Gagal memuat crossings untuk laporan harian Excel:", err);
  }

  // Filter berdasarkan jendela waktu terpilih
  const startMs = new Date(windowStart(win)).getTime();
  const endMs = new Date(windowEnd(win)).getTime();
  const crossingsInWindow = allCrossings.filter(c => {
    const ts = c.crossedAt || c.processedAt;
    if (!ts) return false;
    const ms = new Date(ts).getTime();
    return ms >= startMs && ms <= endMs;
  });

  // Filter berdasarkan perusahaan pilihan (BIB atau TIA)
  const company = win.company || "BIB";
  const filteredCrossings = crossingsInWindow.filter(c => belongsToCompany(c, company));

  // --- 2. Bangun Sheet Rekapitulasi Harian ("OB DARI [COMPANY]") --------------
  await buildObDariCompanySheet(wb, win);

  // --- 3. Hitung metrik agregasi khusus perusahaan terpilih -------------------
  const perTruckMap: Record<string, any[]> = {};
  filteredCrossings.forEach(c => {
    if (c.known && c.hullId) {
      perTruckMap[c.hullId] = perTruckMap[c.hullId] || [];
      perTruckMap[c.hullId].push(c);
    }
  });

  const perTruckData: any[] = [];
  const unpairedList: any[] = [];
  let totalRitase = 0;
  let unregisteredRitase = 0;
  const unregisteredHulls = new Set<string>();

  // Kumpulkan lintasan belum berpasangan dari truk yang teridentifikasi
  Object.entries(perTruckMap).forEach(([hullId, events]) => {
    const { pairs, unpaired } = pairHullEvents(events);
    const inCount = events.filter(e => e.direction === "inbound").length;
    const outCount = events.filter(e => e.direction === "outbound").length;
    const reads = events.reduce((sum, e) => sum + (e.reads || 0), 0);
    const bestConf = Math.max(...events.map(e => e.confidence || 0), 0);
    const isRegistered = events.every(e => e.registered);

    totalRitase += pairs.length;
    if (!isRegistered) {
      unregisteredRitase += pairs.length;
      unregisteredHulls.add(hullId);
    }

    perTruckData.push({
      hullId,
      registered: isRegistered,
      ritase: pairs.length,
      inCount,
      outCount,
      unpaired: unpaired.length,
      reads,
      bestConf,
      avgCycleSeconds: null,
    });

    unpaired.forEach(u => {
      unpairedList.push({
        hullId: u.hullId,
        lane: u.lane,
        direction: u.direction,
        crossedAt: u.crossedAt,
        reason: u.direction === "inbound" ? "missing-out" : u.direction === "outbound" ? "missing-in" : "no-direction",
      });
    });
  });

  // Urutkan perTruckData
  perTruckData.sort((a, b) => b.ritase - a.ritase || a.hullId.localeCompare(b.hullId));

  // Tambahkan lintasan dari nomor lambung tidak teridentifikasi
  filteredCrossings.forEach(c => {
    if (!c.known) {
      unpairedList.push({
        hullId: "UNIDENTIFIED",
        lane: c.lane,
        direction: c.direction,
        crossedAt: c.crossedAt,
        reason: "unidentified-hull",
      });
    }
  });

  // Hitung sebaran per gate
  const gateMap: Record<string, { gate: string; inbound: number; outbound: number; undirected: number }> = {};
  filteredCrossings.forEach(c => {
    const gate = c.lane || "Unassigned Gate";
    gateMap[gate] = gateMap[gate] || { gate, inbound: 0, outbound: 0, undirected: 0 };
    if (c.direction === "inbound") gateMap[gate].inbound++;
    else if (c.direction === "outbound") gateMap[gate].outbound++;
    else gateMap[gate].undirected++;
  });
  const perGateData = Object.values(gateMap);

  const hours = windowHours(win);
  const identifiedCrossings = filteredCrossings.filter(c => c.known);
  const avgConf = identifiedCrossings.length > 0 
    ? round1(identifiedCrossings.reduce((sum, c) => sum + (c.confidence || 0), 0) / identifiedCrossings.length)
    : 0.0;

  // --- Ringkasan -------------------------------------------------------------
  const ringkasan = wb.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Keterangan", key: "k", width: 32 },
    { header: "Nilai", key: "v", width: 26 },
    { header: "Dasar", key: "d", width: 30 },
  ];
  const meta: [string, string | number, string][] = [
    ["Shift", PRESET_LABEL[win.preset], "dipilih operator"],
    ["Perusahaan / Konsesi", company, "dipilih operator"],
    ["Awal jendela", windowStart(win), "dipilih operator"],
    ["Akhir jendela", windowEnd(win), "dipilih operator"],
    ["Panjang jendela (jam)", hours, "turunan"],
    ["Dibuat pada", generatedAt.toISOString(), "sistem"],
    ["", "", ""],
    ["Ritase (IN + OUT)", totalRitase, "terukur"],
    ["Ritase belum terdaftar", unregisteredRitase, "terukur"],
    ["Nomor belum terdaftar", Array.from(unregisteredHulls).join(", ") || "—", "terukur"],
    ["Total lintasan gate", filteredCrossings.length, "terukur"],
    ["Belum berpasangan", unpairedList.length, "terukur"],
    ["Nomor lambung unik", perTruckData.length, "terukur"],
    ["Rata-rata keyakinan (%)", avgConf, "terukur"],
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
  for (const g of perGateData) {
    const total = g.inbound + g.outbound + g.undirected;
    perGate.addRow({
      gate: g.gate, in: g.inbound, out: g.outbound, none: g.undirected, total,
      share: filteredCrossings.length > 0 ? Math.round((total / filteredCrossings.length) * 100) : 0,
    });
  }

  // --- Per Nomor Lambung -----------------------------------------------------
  const perTruck = wb.addWorksheet("Per Nomor Lambung");
  perTruck.columns = [
    { header: "Nomor Lambung", key: "hull", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "Ritase", key: "ritase", width: 10 },
    { header: "Masuk", key: "in", width: 10 },
    { header: "Keluar", key: "out", width: 10 },
    { header: "Belum berpasangan", key: "unpaired", width: 20 },
    { header: "Pembacaan Nomor", key: "reads", width: 16 },
    { header: "Keyakinan tertinggi (%)", key: "conf", width: 22 },
  ];
  for (const t of perTruckData) {
    perTruck.addRow({
      hull: t.hullId,
      status: t.registered ? "terdaftar" : "BELUM TERDAFTAR",
      ritase: t.ritase, in: t.inCount, out: t.outCount,
      unpaired: t.unpaired, reads: t.reads, conf: round1(t.bestConf),
    });
  }
  perTruck.addRow({
    hull: "TOTAL",
    ritase: perTruckData.reduce((s, t) => s + t.ritase, 0),
    in: perTruckData.reduce((s, t) => s + t.inCount, 0),
    out: perTruckData.reduce((s, t) => s + t.outCount, 0),
    unpaired: perTruckData.reduce((s, t) => s + t.unpaired, 0),
    reads: perTruckData.reduce((s, t) => s + t.reads, 0),
  });

  // --- Belum Berpasangan -----------------------------------------------------
  const unpaired = wb.addWorksheet("Belum Berpasangan");
  unpaired.columns = [
    { header: "Nomor Lambung", key: "hull", width: 20 },
    { header: "Gate", key: "gate", width: 22 },
    { header: "Arah", key: "dir", width: 12 },
    { header: "Waktu lintasan", key: "at", width: 22 },
    { header: "Keterangan", key: "why", width: 30 },
  ];
  for (const u of unpairedList) {
    unpaired.addRow({
      hull: u.hullId, gate: u.lane,
      dir: u.direction === "inbound" ? "Masuk" : u.direction === "outbound" ? "Keluar" : "—",
      at: u.crossedAt ?? "belum tersedia",
      why: REASON_LABEL[u.reason as UnpairedCrossing["reason"]] || u.reason,
    });
  }

  // --- 4. Terapkan Gaya Visual Seragam ke Semua Sheet Pendukung ----------------
  applyGlobalExcelStyle(ringkasan);
  applyGlobalExcelStyle(perGate, [5]); // Kolom E (Total) kuning
  applyGlobalExcelStyle(perTruck, [3]); // Kolom C (Ritase) kuning
  applyGlobalExcelStyle(unpaired);

  // Freeze baris header pertama pada setiap sheet pendukung
  for (const sheet of [ringkasan, perGate, perTruck, unpaired]) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = shiftReportXlsxFilename(win, generatedAt);
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  return filename;
}

export function shiftWindowCaption(win: ShiftWindow): string {
  return formatWindow(win);
}
