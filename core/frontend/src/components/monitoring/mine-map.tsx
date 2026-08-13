"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { CHECKPOINTS, Checkpoint } from "@/lib/checkpoints";
import { PitOccupancy } from "@/lib/types";
import { GlassCard } from "../ui/glass-card";
import { MapPin } from "lucide-react";
import { MineMapDetail } from "./mine-map-detail";

// Impor komponen Leaflet secara dinamis untuk mencegah crash SSR Next.js
const MineLeafletMap = dynamic(
  () => import("./mine-leaflet-map").then((mod) => mod.MineLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-950/20 rounded-2xl border border-[var(--border)]/40 font-mono text-xs text-[var(--text-secondary)]">
        Memuat Peta Satelit Tambang...
      </div>
    ),
  }
);

interface MineMapProps {
  pit: PitOccupancy | null;
}

export function MineMap({ pit }: MineMapProps) {
  const [selectedCp, setSelectedCp] = useState<Checkpoint | null>(CHECKPOINTS[0]);

  const matchCheckpoint = (gate: string | null): string | null => {
    if (!gate) return null;
    const upper = gate.toUpperCase();
    if (upper.includes("CP 01") || upper.includes("CP-01") || upper.includes("KGB")) return "CP-01";
    if (upper.includes("CP 02") || upper.includes("CP-02") || upper.includes("KGU")) return "CP-02";
    if (upper.includes("CP 03") || upper.includes("CP-03") || upper.includes("PPA")) return "CP-03";
    if (upper.includes("CP 04") || upper.includes("CP-04") || upper.includes("EXC")) return "CP-04";
    return null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Kolom Kiri & Tengah: Visualisasi Peta Satelit Leaflet */}
      <GlassCard className="lg:col-span-2 p-5 flex flex-col justify-between bg-slate-950/20 backdrop-blur-sm border-[var(--border)]">
        {/* Header Panel Peta */}
        <div className="w-full flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
                Peta Satelit Rute &amp; Pos Cek
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Pantauan geografis riil rute angkutan tambang batubara (Kalimantan Selatan)
              </p>
            </div>
          </div>
        </div>

        {/* Wadah Peta Leaflet */}
        <div className="w-full relative flex-1">
          <MineLeafletMap
            pit={pit}
            selectedCp={selectedCp}
            onSelectCheckpoint={setSelectedCp}
          />
        </div>

        {/* Legenda Horizontal di Bawah Peta */}
        <div className="w-full mt-4 pt-3 border-t border-[var(--border)]/60 flex flex-wrap gap-x-5 gap-y-2 items-center justify-center text-[10px] font-mono text-[var(--text-secondary)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
            <span>Pos Aktif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
            <span>Pos Tertunda</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1.5 rounded bg-amber-500" />
            <span>Truk di Pos</span>
          </div>
        </div>
      </GlassCard>

      {/* Kolom Kanan: Detail Pos Cek (Modular) */}
      <MineMapDetail selectedCp={selectedCp} pit={pit} matchCheckpoint={matchCheckpoint} />
    </div>
  );
}
