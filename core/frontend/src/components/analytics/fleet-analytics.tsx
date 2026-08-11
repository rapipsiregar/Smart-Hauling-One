"use client";

import React from "react";
import { Truck, Cpu } from "lucide-react";

export function FleetAnalyticsWidget() {
  return (
    <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            Performa Merek Kendaraan (276 Unit Master)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Diimpor langsung dari master Excel database hauling CK, Caterpillar 777E, 773, Komatsu HD785 & WT
          </p>
        </div>
        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
          276 Master Trucks
        </span>
      </div>

      {/* Brand performance */}
      <div className="space-y-2">
        <div className="text-xs font-mono font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Distribusi Merek Kendaraan (OEM)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)]">Caterpillar (CAT 777E)</div>
            <div className="text-sm font-bold text-amber-400">164 Unit</div>
            <div className="text-[10px] text-emerald-400">Avg Conf: 98.4%</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)]">Komatsu (HD785)</div>
            <div className="text-sm font-bold text-emerald-400">68 Unit</div>
            <div className="text-[10px] text-emerald-400">Avg Conf: 97.2%</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)]">Volvo (FMX 440)</div>
            <div className="text-sm font-bold text-blue-400">28 Unit</div>
            <div className="text-[10px] text-emerald-400">Avg Conf: 96.8%</div>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)]">
            <div className="text-[10px] text-[var(--text-secondary)]">Scania / Water Truck</div>
            <div className="text-sm font-bold text-slate-300">16 Unit</div>
            <div className="text-[10px] text-emerald-400">Avg Conf: 95.1%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
