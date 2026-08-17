"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { ShiftReport } from "@/lib/types";
import { EMPTY_SHIFT_REPORT, normalizeShiftReport } from "@/lib/shift-report";
import { ShiftReportModule } from "@/components/reports/shift-report-module";
import { MiningDayWindow, todayWindow } from "@/lib/shift-metrics";
import { RitaseMetricCards } from "@/components/ritase-metric-cards";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { Loader, ClipboardList, ServerCrash } from "lucide-react";

type Health = "ok" | "stale" | "offline";

export default function ReportsPage() {
  const [report, setReport] = useState<ShiftReport>(EMPTY_SHIFT_REPORT);
  const [health, setHealth] = useState<Health>("ok");
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  // The reporting window lives here, not in the module: changing it refetches,
  // because the server is what resolves a mining day into real moments.
  const [win, setWin] = useState<MiningDayWindow>(() => todayWindow());

  const patchWindow = useCallback((patch: Partial<MiningDayWindow>) => {
    setWin((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRefetching(true);
    api.getShiftReport(win)
      .then((raw) => {
        if (cancelled) return;
        const { report: normalized, current } = normalizeShiftReport(raw);
        setReport(normalized);
        setHealth(current ? "ok" : "stale");
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Data laporan shift backend gagal dimuat:", err);
        setReport(EMPTY_SHIFT_REPORT);
        setHealth("offline");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefetching(false);
      });
    return () => { cancelled = true; };
  }, [win]);

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
          title="Modul Laporan Harian &amp; Periodik"
          note="Halaman laporan ritase harian dan berkala. Pilih jendela waktunya di atas, lalu halaman ini merangkum: berapa truk melintas, berapa yang berhasil dikenali, berapa ritase yang terbentuk, sebarannya per gate, dan lintasan mana yang belum berpasangan. Semua angkanya dihitung dari lintasan yang benar-benar tercatat, bukan perkiraan."
        >
          <h2 className="text-lg font-bold tracking-tight uppercase flex items-center gap-2 text-[var(--text-primary)]">
            <ClipboardList className="text-amber-500" size={20} />
            Laporan Ritase Harian &amp; Periodik
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
            Susun laporan akhir hari atau periode, tinjau lintasan yang belum berpasangan, dan ekspor ke Excel
            atau PDF untuk audit ritase.
          </p>
        </GuideSwap>
      </GlassCard>

      {health === "stale" && <StaleBackendNotice />}

      <div className="max-w-6xl" data-print="shell">
        <ShiftReportModule
          report={report}
          win={win}
          onWindowChange={patchWindow}
          loading={refetching}
        />
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
          Server masih versi lama
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Server menjawab, tetapi belum mengirimkan data ritase lengkap (pasangan Masuk + Keluar). Angka di bawah
          belum bisa digunakan. Silakan jalankan ulang server utama agar memuat kode terbaru:{" "}
          <code className="font-mono text-[11px] text-amber-500">uv run python main.py web</code>
        </p>
      </div>
    </div>
  );
}
