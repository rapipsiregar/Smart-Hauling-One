"use client";

import React from "react";
import { Clock, AlertTriangle, Activity, CheckCircle2 } from "lucide-react";

export function BottleneckAnalyticsWidget() {
  return (
    <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Analisis Jam Puncak Antrean Pos & Peringatan Truk Terhenti
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Pemantauan otomatis kepadatan pos gerbang dan indikasi awal truk terhenti lebih dari 90 menit
          </p>
        </div>
        <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20">
          1 Peringatan Truk Terhenti
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        {/* Peak hour info */}
        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
          <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-500" /> Jam Puncak Antrean Truk
          </div>
          <div className="text-base font-bold text-amber-400">06:30 – 07:30 WITA</div>
          <div className="text-[10px] text-[var(--text-dim)]">Pergantian Shift Kerja (Pos CP 01 & CP 02)</div>
        </div>

        {/* Average gate dwell time */}
        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
          <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Rata-rata Waktu Deteksi Kamera
          </div>
          <div className="text-base font-bold text-emerald-400">4.2 Detik / Truk</div>
          <div className="text-[10px] text-[var(--text-dim)]">Kecepatan otomatis pembacaan kamera pos</div>
        </div>

        {/* Stagnant alert warning */}
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1">
          <div className="text-rose-400 flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" /> Peringatan Terhenti (&gt;90 mnt)
          </div>
          <div className="text-base font-bold text-rose-300">Unit DT-089 (94 mnt)</div>
          <div className="text-[10px] text-rose-400">Masuk Pos CP 01 (16:42), Belum Keluar Pos CP 02</div>
        </div>
      </div>
    </div>
  );
}
