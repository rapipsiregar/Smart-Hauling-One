"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, FileText } from "lucide-react";
import { ShiftReport } from "@/lib/types";
import { downloadShiftReportXlsx } from "@/lib/shift-report-xlsx";
import { downloadShiftReportPdf } from "@/lib/shift-report-pdf";
import {
  PRESET_HOURS, PRESET_LABEL, ShiftPreset, ShiftWindow,
  deriveShiftMetrics, hasReportData, todayIso, windowHours,
} from "@/lib/shift-metrics";
import { ExportStatus, ShiftWindowToolbar } from "./shift-window-toolbar";
import { ShiftKpiGrid } from "./shift-kpi-grid";
import { LaneBreakdown } from "./lane-breakdown";
import { UnpairedCrossings } from "./unpaired-crossings";

const IDLE: ExportStatus = { kind: "idle", message: "" };

export function ShiftReportModule({ report }: { report: ShiftReport }) {
  const [win, setWin] = useState<ShiftWindow>(() => ({
    date: report.date || todayIso(),
    startTime: PRESET_HOURS.full[0],
    endTime: PRESET_HOURS.full[1],
    preset: "full",
    company: "BIB",
  }));
  const [status, setStatus] = useState<ExportStatus>(IDLE);
  const [building, setBuilding] = useState<"xlsx" | "pdf" | null>(null);

  const hours = windowHours(win);
  const metrics = useMemo(() => deriveShiftMetrics(report, hours), [report, hours]);
  const canExport = hasReportData(report);

  useEffect(() => {
    if (status.kind === "idle") return;
    const timer = setTimeout(() => setStatus(IDLE), 6000);
    return () => clearTimeout(timer);
  }, [status]);

  const patchWindow = useCallback((patch: Partial<ShiftWindow>) => {
    setWin((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPreset = (preset: ShiftPreset) => {
    if (preset === "custom") return patchWindow({ preset });
    const [startTime, endTime] = PRESET_HOURS[preset];
    patchWindow({ preset, startTime, endTime });
  };

  const runExport = async (kind: "xlsx" | "pdf") => {
    setBuilding(kind);
    try {
      const filename =
        kind === "xlsx"
          ? await downloadShiftReportXlsx(report, win)
          : await downloadShiftReportPdf(report, win);
      setStatus({ kind: "ok", message: `Tersimpan: ${filename}` });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? `Ekspor gagal: ${err.message}` : "Ekspor gagal",
      });
    } finally {
      setBuilding(null);
    }
  };

  return (
    <div className="glass-card overflow-hidden" data-print="sheet">
      <div
        className="bg-[var(--bg-elevated)] px-5 py-4 border-b border-[var(--border)] flex flex-wrap justify-between items-center gap-3"
        data-print="hide"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-amber-500">
            <FileText size={16} />
            <span className="font-mono text-xs font-black tracking-wider uppercase">
              Laporan Ritase
            </span>
          </div>
          <h3 className="text-base font-bold tracking-tight uppercase text-[var(--text-primary)]">
            Laporan Akhir Shift
          </h3>
        </div>
        <div className="flex gap-2">
          {(["full", "day", "night", "custom"] as ShiftPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              aria-pressed={win.preset === p}
              className={`px-3 py-1 text-[10px] font-mono font-bold rounded uppercase transition-colors cursor-pointer ${
                win.preset === p
                  ? "bg-amber-500 text-slate-950"
                  : "bg-[var(--bg-input)] hover:bg-[var(--border)] text-[var(--text-secondary)]"
              }`}
            >
              {PRESET_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 space-y-6">
        {!report.hasCrossingTimes && <NoCrossingTimeNotice />}

        <ShiftWindowToolbar
          value={win}
          onChange={patchWindow}
          onExportXlsx={() => runExport("xlsx")}
          onExportPdf={() => runExport("pdf")}
          canExport={canExport}
          building={building}
          status={status}
        />

        <ShiftKpiGrid metrics={metrics} />
        <LaneBreakdown report={report} metrics={metrics} />
        <UnpairedCrossings report={report} />
      </div>
    </div>
  );
}

/**
 * Says plainly that the shift window is a label, not a filter, while crossings
 * carry no real time — rather than letting the date/hour fields imply otherwise.
 */
function NoCrossingTimeNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
      <Clock3 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
          Waktu lintasan belum tersedia
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Data deteksi saat ini belum memuat waktu lintasan per truk, jadi jendela shift di bawah
          hanya menjadi keterangan pada berkas ekspor — bukan penyaring data. Ritase dipasangkan
          dengan menghitung IN dan OUT per nomor lambung, dan durasi siklus belum bisa dihitung.
        </p>
      </div>
    </div>
  );
}
