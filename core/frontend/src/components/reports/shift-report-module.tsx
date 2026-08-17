"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, FileText } from "lucide-react";
import { ShiftReport } from "@/lib/types";
import { downloadShiftReportXlsx } from "@/lib/shift-report-xlsx";
import { downloadShiftReportPdf } from "@/lib/shift-report-pdf";
import {
  MiningDayWindow, addDays,
  deriveShiftMetrics, hasReportData, todayIso, windowHours, windowLabel,
} from "@/lib/shift-metrics";
import { ExportStatus, ShiftWindowToolbar } from "./shift-window-toolbar";
import { ShiftKpiGrid } from "./shift-kpi-grid";
import { LaneBreakdown } from "./lane-breakdown";
import { UnpairedCrossings } from "./unpaired-crossings";

const IDLE: ExportStatus = { kind: "idle", message: "" };

/**
 * The end-of-day sheet, scoped to a mining day.
 *
 * The window is owned by the page, not by this module, because changing it now
 * REFETCHES: the server resolves the dates and returns figures for that window.
 * It used to be applied client-side as a label over an unfiltered total, so the
 * numbers stayed the same whatever window was picked — a sheet that looked
 * scoped and was not.
 */
export function ShiftReportModule({
  report,
  win,
  onWindowChange,
  loading,
}: {
  report: ShiftReport;
  win: MiningDayWindow;
  onWindowChange: (patch: Partial<MiningDayWindow>) => void;
  loading?: boolean;
}) {
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
              Laporan Harian &amp; Periodik
            </span>
          </div>
          <h3 className="text-base font-bold tracking-tight uppercase text-[var(--text-primary)]">
            Rekapitulasi Harian &amp; Periodik
          </h3>
        </div>
        <div className="flex flex-wrap gap-3 items-center text-xs">
          <span className="text-[10px] font-mono text-[var(--text-dim)] mr-1">
            {windowLabel(win)}
          </span>
          <div className="h-4 w-px bg-[var(--border)] hidden sm:block" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-dim)] font-medium">Harian:</span>
            <QuickRange label="Hari Ini" onClick={() => {
              const t = todayIso();
              onWindowChange({ startDate: t, endDate: t });
            }} />
            <QuickRange label="Kemarin" onClick={() => {
              const y = addDays(todayIso(), -1);
              onWindowChange({ startDate: y, endDate: y });
            }} />
          </div>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-dim)] font-medium">Mingguan:</span>
            <QuickRange label="7 Hari" onClick={() => {
              const t = todayIso();
              onWindowChange({ startDate: addDays(t, -6), endDate: t });
            }} />
          </div>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--text-dim)] font-medium">Bulanan:</span>
            <QuickRange label="Bulan Ini" onClick={() => {
              const t = todayIso();
              const yearMonth = t.slice(0, 8);
              onWindowChange({ startDate: `${yearMonth}01`, endDate: t });
            }} />
            <QuickRange label="30 Hari" onClick={() => {
              const t = todayIso();
              onWindowChange({ startDate: addDays(t, -29), endDate: t });
            }} />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {!report.hasCrossingTimes && <NoCrossingTimeNotice />}

        <ShiftWindowToolbar
          value={win}
          onChange={onWindowChange}
          onExportXlsx={() => runExport("xlsx")}
          onExportPdf={() => runExport("pdf")}
          canExport={canExport}
          building={building}
          status={status}
        />

        {loading && (
          <p className="text-xs text-[var(--text-dim)] font-mono">Memuat ulang laporan…</p>
        )}

        <ShiftKpiGrid metrics={metrics} />
        <CheckpointBreakdown report={report} />
        <LaneBreakdown report={report} metrics={metrics} />
        <UnpairedCrossings report={report} />
      </div>
    </div>
  );
}

function QuickRange({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 text-[10px] font-mono font-bold rounded uppercase bg-[var(--bg-input)] hover:bg-[var(--border)] text-[var(--text-secondary)] transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}

/**
 * Haulage per checkpoint on the sheet itself.
 *
 * The site plans and reports by checkpoint, so the document that gets signed
 * has to carry that cut. The lane breakdown below groups by area, where two
 * checkpoints can share one row — useful for the map reading, useless for
 * reconciling against a per-checkpoint tally.
 */
function CheckpointBreakdown({ report }: { report: ShiftReport }) {
  if (!report.perCheckpoint?.length) return null;
  const total = report.perCheckpoint.reduce((sum, c) => sum + c.ritase, 0);

  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-secondary)]">
        Ritase per Pos Cek
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="text-left font-semibold py-1.5 pr-3">Pos Cek</th>
              <th className="text-right font-semibold py-1.5 px-2">Ritase</th>
              <th className="text-right font-semibold py-1.5 px-2">Masuk</th>
              <th className="text-right font-semibold py-1.5 px-2">Keluar</th>
              <th className="text-right font-semibold py-1.5 px-2">Tanpa Arah</th>
              <th className="text-right font-semibold py-1.5 pl-2">Lintasan</th>
            </tr>
          </thead>
          <tbody>
            {report.perCheckpoint.map((cp) => (
              <tr key={cp.checkpoint} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 pr-3 font-mono text-[var(--text-primary)]">{cp.checkpoint}</td>
                <td className="text-right py-1.5 px-2 font-mono font-bold text-amber-500">{cp.ritase}</td>
                <td className="text-right py-1.5 px-2 font-mono text-[var(--text-secondary)]">{cp.inbound}</td>
                <td className="text-right py-1.5 px-2 font-mono text-[var(--text-secondary)]">{cp.outbound}</td>
                <td className="text-right py-1.5 px-2 font-mono text-[var(--text-dim)]">{cp.undirected}</td>
                <td className="text-right py-1.5 pl-2 font-mono text-[var(--text-secondary)]">{cp.crossings}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border-strong)]">
              <td className="py-1.5 pr-3 font-bold text-[var(--text-primary)]">Jumlah</td>
              <td className="text-right py-1.5 px-2 font-mono font-bold text-amber-500">{total}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/**
 * Shown when the sheet's crossings carry no wall-clock time.
 *
 * The wording changed with the mining-day cut: the window IS a filter now, the
 * server applies it, and saying otherwise would have been the misleading half
 * of a true statement. What remains true is narrower — a crossing without a
 * recorded time cannot be placed in any window, so it is excluded rather than
 * quietly counted, and cycle durations cannot be derived.
 */
function NoCrossingTimeNotice() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
      <Clock3 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500">
          Tidak ada lintasan berwaktu pada rentang ini
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Bisa berarti memang tidak ada aktivitas pada hari tambang yang dipilih, atau lintasan
          yang ada belum memuat catatan waktu. Lintasan tanpa waktu tidak dapat ditempatkan pada
          rentang mana pun, jadi tidak ikut dihitung di sini — bukan dibuang, dan tetap muncul di
          Riwayat Pembacaan. Durasi siklus juga belum bisa dihitung untuk lintasan tersebut.
        </p>
      </div>
    </div>
  );
}
