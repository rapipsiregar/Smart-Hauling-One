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
            Analisis Jam Puncak Antrean Pos
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Pemantauan otomatis kepadatan pos gerbang koridor hauling
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
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
      </div>
    </div>
  );
}
