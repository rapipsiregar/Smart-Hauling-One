import { api } from "./api-client";
import { MiningDayWindow } from "./shift-metrics";

function parseDate(ts: string | null): Date | null {
  if (!ts) return null;
  return new Date(ts);
}

export function belongsToCompany(crossing: any, company: "BIB" | "TIA"): boolean {
  const contractor = crossing.contractor || "";
  const lane = crossing.lane || "";
  const hull = crossing.hullId || "";
  
  if (company === "BIB") {
    // Truk atau pos berasosiasi dengan BIB (semua CK di BIB)
    return contractor.includes("BIB") || lane.includes("BIB") || lane.startsWith("CK") || contractor.startsWith("PT. CK");
  } else {
    // Truk atau pos berasosiasi dengan TIA
    return contractor.includes("TIA") || lane.includes("TIA");
  }
}

export function pairHullEvents(events: any[]): { pairs: any[], unpaired: any[] } {
  const directed = events.filter((e: any) => e.direction === "inbound" || e.direction === "outbound");
  const undirected = events.filter((e: any) => e.direction !== "inbound" && e.direction !== "outbound");
  const ordered = [...directed].sort((a: any, b: any) => {
    const da = parseDate(a.crossedAt)?.getTime() || 0;
    const db = parseDate(b.crossedAt)?.getTime() || 0;
    return da - db;
  });
  
  const pairs: any[] = [];
  const unpaired: any[] = [];
  let openEvent: any | null = null;
  
  for (const event of ordered) {
    if (openEvent === null) {
      openEvent = event;
      continue;
    }
    
    if (event.direction === openEvent.direction) {
      unpaired.push(openEvent);
      openEvent = event;
      continue;
    }
    
    const start = openEvent;
    const end = event;
    pairs.push({
      in: start.direction === "inbound" ? start : end,
      out: start.direction === "outbound" ? start : end,
    });
    openEvent = null;
  }
  
  if (openEvent !== null) {
    unpaired.push(openEvent);
  }
  
  return { pairs, unpaired: [...unpaired, ...undirected] };
}

function getSeries(crossing: any): "777" | "773" | null {
  const model = crossing.modelType || "";
  if (model.includes("777")) return "777";
  if (model.includes("773")) return "773";
  const hull = crossing.hullId || "";
  if (hull.startsWith("HD 4")) return "777";
  if (hull.startsWith("HD 2")) return "773";
  return null;
}

function formatDateExcel(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yearShort = String(d.getFullYear()).slice(-2);
  return `${day}-${months[d.getMonth()]}-${yearShort}`;
}

export function applyGlobalExcelStyle(sheet: any, yellowCols?: number[]): void {
  const boldBorder = {
    top: { style: "medium" as const, color: { argb: "FF000000" } },
    left: { style: "medium" as const, color: { argb: "FF000000" } },
    bottom: { style: "medium" as const, color: { argb: "FF000000" } },
    right: { style: "medium" as const, color: { argb: "FF000000" } },
  };
  const HEADER_BLUE = "FFB4C6E7";
  const YELLOW_FILL = "FFFFFF00";

  // Tentukan jumlah baris header (sheet OB harian memiliki 2 baris, sheet analisis lainnya memiliki 1 baris)
  const headerRowCount = sheet.getCell("A1").value === "Date" ? 2 : 1;

  // Jika data kosong, buat 10 baris kosong berpola border agar tabel tetap tergambar
  if (sheet.rowCount <= headerRowCount) {
    const colCount = sheet.columns ? sheet.columns.length : (sheet.getRow(headerRowCount).cellCount || 5);
    for (let i = 0; i < 10; i++) {
      sheet.addRow(Array(colCount).fill(""));
    }
  }

  // Format header row dan data row
  sheet.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
    const isHeaderRow = rowNumber <= headerRowCount;
    
    // Periksa apakah baris ini baris TOTAL di bagian bawah
    const firstCellVal = String(row.getCell(1).value).toUpperCase();
    const isTotalRow = firstCellVal === "TOTAL";

    row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      if (isHeaderRow) {
        cell.font = { bold: true, name: "Calibri", size: 11, color: { argb: "FF000000" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: HEADER_BLUE },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = boldBorder;
      } else {
        cell.font = { bold: isTotalRow, name: "Calibri", size: 11, color: { argb: "FF000000" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = boldBorder;

        // Beri warna kuning jika kolom ritase terpilih atau ini adalah baris TOTAL
        if (isTotalRow || (yellowCols && yellowCols.includes(colNumber))) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: YELLOW_FILL },
          };
        }
      }
    });
  });
}

export async function buildObDariCompanySheet(wb: any, win: MiningDayWindow): Promise<void> {
  const company = win.company || "BIB";
  const sheetName = `OB DARI ${company}`;
  const mainSheet = wb.addWorksheet(sheetName);

  mainSheet.columns = [
    { key: "date", width: 16 },
    { key: "ritase777", width: 12 },
    { key: "unit777", width: 12 },
    { key: "volume777", width: 12 },
    { key: "ritase773", width: 12 },
    { key: "unit773", width: 12 },
    { key: "volume773", width: 12 },
    { key: "totalRitase", width: 16 },
    { key: "totalVolume", width: 16 },
  ];

  mainSheet.getRow(1).values = ["Date", sheetName, "", "", "", "", "", "", ""];
  mainSheet.getRow(2).values = ["", "Ritase", "Unit", "Volume", "Ritase", "Unit", "Volume", "Total Ritase", "Volume"];

  mainSheet.mergeCells("A1:A2");
  mainSheet.mergeCells("B1:I1");

  // Ambil crossings dari backend
  let allCrossings: any[] = [];
  try {
    allCrossings = await api.getCrossingEvents();
  } catch (err) {
    console.warn("Gagal memuat crossings untuk laporan harian Excel:", err);
  }

  // Filter crossings untuk perusahaan terpilih
  const crossingsForCompany = allCrossings.filter((c: any) => belongsToCompany(c, company));

  // Bangun daftar tanggal dari tanggal 1 sampai win.date
  const selectedDate = new Date(win.endDate);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const endDay = selectedDate.getDate();

  const datesList: string[] = [];
  for (let day = 1; day <= endDay; day++) {
    const isoString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    datesList.push(isoString);
  }

  // Hitung ritase harian per model truk
  datesList.forEach((isoDate: string, idx: number) => {
    const rowNum = 3 + idx;

    const crossingsOnDay = crossingsForCompany.filter((c: any) => {
      const ts = c.crossedAt || c.processedAt;
      if (!ts) return false;
      return ts.slice(0, 10) === isoDate;
    });

    const hullGroup: Record<string, any[]> = {};
    crossingsOnDay.forEach((c: any) => {
      if (c.known && c.hullId) {
        hullGroup[c.hullId] = hullGroup[c.hullId] || [];
        hullGroup[c.hullId].push(c);
      }
    });

    let ritase777 = 0;
    let ritase773 = 0;
    const activeUnits777 = new Set<string>();
    const activeUnits773 = new Set<string>();

    Object.entries(hullGroup).forEach(([hullId, events]: [string, any[]]) => {
      const { pairs } = pairHullEvents(events);
      if (pairs.length > 0) {
        const series = getSeries(events[0]);
        if (series === "777") {
          ritase777 += pairs.length;
          activeUnits777.add(hullId);
        } else if (series === "773") {
          ritase773 += pairs.length;
          activeUnits773.add(hullId);
        }
      }
    });

    mainSheet.getCell(`A${rowNum}`).value = formatDateExcel(isoDate);
    mainSheet.getCell(`B${rowNum}`).value = ritase777;
    mainSheet.getCell(`C${rowNum}`).value = activeUnits777.size;
    mainSheet.getCell(`D${rowNum}`).value = ""; // Volume 777 kosong
    mainSheet.getCell(`E${rowNum}`).value = ritase773;
    mainSheet.getCell(`F${rowNum}`).value = activeUnits773.size;
    mainSheet.getCell(`G${rowNum}`).value = ""; // Volume 773 kosong
    mainSheet.getCell(`H${rowNum}`).value = ritase777 + ritase773;
    mainSheet.getCell(`I${rowNum}`).value = ""; // Total Volume kosong
  });

  // Terapkan gaya visual global ke sheet rekap harian ini
  applyGlobalExcelStyle(mainSheet, [2, 5, 8]); // Kolom B, E, H kuning
}
