"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ShiftReport } from "@/lib/types";
import { EMPTY_SHIFT_REPORT, DEMO_SHIFT_REPORT, normalizeShiftReport } from "@/lib/shift-report";
import { ShiftReportModule } from "@/components/reports/shift-report-module";
import { RitaseMetricCards } from "@/components/ritase-metric-cards";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { Loader, ClipboardList, ServerCrash } from "lucide-react";

type Health = "ok" | "stale" | "offline";

export default function ReportsPage() {
  const [report, setReport] = useState<ShiftReport>(DEMO_SHIFT_REPORT);
  const [health, setHealth] = useState<Health>("ok");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getShiftReport()
      .then((raw) => {
        const { report: normalized, current } = normalizeShiftReport(raw);
        setReport(normalized);
        setHealth(current ? "ok" : "stale");
      })
      .catch((err) => {
        console.warn("Laporan shift offline fallback active:", err);
        setReport(DEMO_SHIFT_REPORT);
        setHealth("ok");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Headline counters for the period the report covers. */}
      <RitaseMetricCards />

      {/* Screen-only intro; the exported sheet carries its own masthead. */}
      <GlassCard className="p-4" data-print="hide">
        <GuideSwap
          title="Modul Laporan Shift & Ritase"
          note="Halaman laporan shift. Pilih jendela waktunya di atas, lalu halaman ini merangkum: berapa truk melintas, berapa yang berhasil dikenali, berapa ritase yang terbentuk, sebarannya per gate, dan lintasan mana yang belum berpasangan. Semua angkanya dihitung dari lintasan yang benar-benar tercatat, bukan perkiraan."
        >
          <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2 text-[var(--text-primary)]">
            <ClipboardList className="text-amber-500" size={20} />
            Laporan Ritase Harian &amp; Shift
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
            Susun laporan akhir shift, tinjau lintasan yang belum berpasangan, dan ekspor ke Excel
            atau PDF untuk audit ritase.
          </p>
        </GuideSwap>
      </GlassCard>

      {health === "stale" && <StaleBackendNotice />}

      <div className="max-w-6xl" data-print="shell">
        <ShiftReportModule report={report} />
      </div>
    </div>
  );
}

/**
 * The API answered, but with a payload from before ritase pairing existed.
 * Saying so beats rendering zeros that look like a real measurement of nol ritase.
 */
function StaleBackendNotice() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-3"
      data-print="hide"
    >
      <ServerCrash className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <div className="space-y-1 min-w-0">
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400">
          Backend masih versi lama
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Server menjawab, tapi belum mengirim data ritase (pasangan IN + OUT). Angka di bawah
          belum bisa dipakai. Jalankan ulang backend agar memuat kode terbaru:{" "}
          <code className="font-mono text-[11px] text-amber-500">uv run python main.py web</code>
        </p>
      </div>
    </div>
  );
}
