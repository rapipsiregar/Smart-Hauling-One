"use client";

import React from "react";
import { Calendar, CheckCircle2, Clock, FileDown, FileSpreadsheet, Loader2, TriangleAlert, Building } from "lucide-react";
import { GuideSwap } from "@/components/ui/guide-note";
import { MiningDayWindow, windowDays } from "@/lib/shift-metrics";

export interface ExportStatus {
  kind: "idle" | "ok" | "error";
  message: string;
}

interface Props {
  value: MiningDayWindow;
  onChange: (patch: Partial<MiningDayWindow>) => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
  canExport: boolean;
  building: "xlsx" | "pdf" | null;
  status: ExportStatus;
}

export function ShiftWindowToolbar({
  value, onChange, onExportXlsx, onExportPdf, canExport, building, status,
}: Props) {
  const days = windowDays(value);
  const blockedTitle = "Tidak ada data untuk diekspor — backend mengembalikan laporan kosong.";

  return (
    <GuideSwap
      title="Hari Tambang & Ekspor"
      note="Pilih hari tambang yang ingin dilaporkan. Satu hari tambang dihitung pukul 06:00 pagi sampai 06:00 pagi berikutnya, mengikuti siklus pelaporan di lapangan. Angka pada laporan diambil ulang dari server sesuai rentang yang Anda pilih, lalu bisa diunduh sebagai Excel atau PDF."
    >
      <div className="space-y-2" data-print="hide">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4">
          <Field label="Dari Hari Tambang" icon={<Calendar size={13} />}>
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Sampai Hari Tambang" icon={<Calendar size={13} />}>
            <input
              type="date"
              value={value.endDate}
              onChange={(e) => onChange({ endDate: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Perusahaan / Konsesi" icon={<Building size={13} />}>
            <select
              value={value.company || "BIB"}
              onChange={(e) => onChange({ company: e.target.value as "BIB" | "TIA" })}
              className={selectClass}
            >
              <option value="BIB">BIB</option>
              <option value="TIA">TIA</option>
            </select>
          </Field>
          <Field label="Cakupan" icon={<Clock size={13} />}>
            <p className="text-xs font-mono text-[var(--text-secondary)] py-1.5 pl-8">
              {days} hari &times; 24 jam
              <span className="block text-[10px] text-[var(--text-dim)]">
                mulai 06:00 tiap hari
              </span>
            </p>
          </Field>
          <div className="flex items-end gap-2">
            <button
              onClick={onExportXlsx}
              disabled={!canExport || building !== null}
              title={canExport ? "Unduh laporan lengkap sebagai berkas Excel (.xlsx)" : blockedTitle}
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] hover:border-amber-500/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--border)] text-[var(--text-primary)] text-xs font-bold font-mono py-1.5 rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {building === "xlsx"
                ? <Loader2 size={13} className="animate-spin" />
                : <FileSpreadsheet size={13} className="text-emerald-400" />}
              {building === "xlsx" ? "Menyusun…" : "Excel"}
            </button>
            <button
              onClick={onExportPdf}
              disabled={!canExport || building !== null}
              title={canExport ? "Unduh laporan shift sebagai dokumen PDF" : blockedTitle}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-500 text-slate-950 text-xs font-bold font-mono py-1.5 rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              {building === "pdf" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
              {building === "pdf" ? "Menyusun…" : "PDF"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1 min-h-[18px]">
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            Panjang jendela: {days * 24} jam ({days} hari tambang)
          </span>
          <span
            role="status"
            aria-live="polite"
            className={`text-[10px] font-mono flex items-center gap-1.5 text-right ${
              status.kind === "error" ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {status.kind === "ok" && <CheckCircle2 size={11} />}
            {status.kind === "error" && <TriangleAlert size={11} />}
            {status.message}
          </span>
        </div>
      </div>
    </GuideSwap>
  );
}

const inputClass =
  "w-full bg-[var(--bg-input)] border border-[var(--border)] rounded px-2.5 py-1.5 pl-8 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-500";

const selectClass =
  "w-full bg-[var(--bg-input)] border border-[var(--border)] rounded px-2.5 py-1.5 pl-8 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-500 appearance-none cursor-pointer";

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold font-mono text-[var(--text-dim)] uppercase tracking-widest block mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-2.5 top-2.5 text-[var(--text-dim)]">{icon}</span>
        {children}
      </div>
    </div>
  );
}
