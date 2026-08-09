"use client";

import React from "react";
import { Truck, Calendar, ShieldCheck, Cpu } from "lucide-react";

export function FleetAnalyticsWidget() {
  return (
    <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            Breakdown Usia Armada & Performa Merek Kendaraan (276 Unit Master)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Diimpor langsung dari master Excel database hauling CK, Caterpillar 777E, 773, Komatsu HD785 & WT
          </p>
        </div>
        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
          276 Master Trucks
        </span>
      </div>

      {/* Grid distributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age distribution */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Kategori Usia Armada
          </div>
          <div className="space-y-2 font-mono text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-emerald-400">&lt; 3 Tahun (Baru - 2023–2026)</span>
                <span>142 Unit (51.4%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: "51.4%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-amber-400">3–5 Tahun (Sedang - 2020–2022)</span>
                <span>98 Unit (35.5%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: "35.5%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-rose-400">&gt; 5 Tahun (Tua - Prioritas Cek OCR)</span>
                <span>36 Unit (13.1%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: "13.1%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Brand performance */}
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Distribusi Merek Kendaraan (OEM)
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
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
    </div>
  );
}
