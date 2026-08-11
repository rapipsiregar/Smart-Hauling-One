"use client";

import React from "react";
import { Fuel, Leaf, Flame, AlertCircle } from "lucide-react";

export function FuelAnalyticsWidget() {
  return (
    <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Fuel className="w-4 h-4 text-amber-500" />
            Estimasi Konsumsi Solar & Indikator Green Mining (BBM Harian)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Kalkulasi berbasis 428 ritase (durasi trip ~45m) & konsumsi solar dump truck CAT 777E / HD785
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
          Target &lt; 18.0 L / Trip
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
          <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" /> Total Konsumsi Solar
          </div>
          <div className="text-lg font-bold text-amber-400">29,960 Liter</div>
          <div className="text-[10px] text-[var(--text-dim)]">Shift Siang + Malam (TIA & BIC)</div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
          <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Rata-rata Konsumsi per Trip
          </div>
          <div className="text-lg font-bold text-emerald-400">14.5 L / Trip</div>
          <div className="text-[10px] text-[var(--text-dim)]">Target SLA Operasional: &lt;18.0 L/Trip</div>
        </div>
      </div>
    </div>
  );
}
