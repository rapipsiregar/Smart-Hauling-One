"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, Activity, CheckCircle2, ShieldCheck, Camera as CameraIcon, RefreshCw, Cpu } from "lucide-react";
import { api } from "@/lib/api-client";
import { PerformanceKpis, Camera } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<PerformanceKpis | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [kpiRes, camRes] = await Promise.all([
        api.getPerformanceKpis().catch(() => null),
        api.getCameras().catch(() => []),
      ]);
      setKpis(kpiRes);
      setCameras(camRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <GlassCard className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
              Analisis Kinerja Operasional &amp; Deteksi Pos
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Metrik akurasi pembacaan kamera, status gerbang aktif, dan statistik deteksi otomatis dari database server
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-xs px-4 py-2 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Metrik Realtime
        </button>
      </GlassCard>

      {/* Real Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Total Lintasan Terbaca</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
            {kpis?.totalPassages ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">lintasan</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Tercatat di seluruh pos gerbang</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Armada Unik Terbaca</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {kpis?.uniqueTrucks ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">unit</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Nomor lambung terdaftar</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Rata-rata Akurasi AI</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-500">
            {kpis?.avgConfidence != null ? `${(kpis.avgConfidence > 1 ? kpis.avgConfidence : kpis.avgConfidence * 100).toFixed(1)}%` : "0.0%"}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Tingkat presisi voting AI</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Kamera Pos Aktif</span>
            <CameraIcon className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-500">
            {cameras.length} <span className="text-xs text-[var(--text-dim)] font-normal">kamera</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Terdaftar di sistem tambang</div>
        </GlassCard>
      </div>

      {/* Gate Performance Breakdown (Real Data) */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 font-mono">
          <Cpu className="w-4 h-4 text-amber-500" />
          Analisis Kinerja Deteksi Otomatis per Gate Kamera
        </h3>

        {kpis?.perGate && kpis.perGate.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kpis.perGate.map((g) => (
              <div key={g.gate} className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-2 font-mono text-xs">
                <div className="flex justify-between items-center text-[var(--text-primary)] font-bold">
                  <span>{g.gate}</span>
                  <span className="text-emerald-400">{g.identified} Terbaca</span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                  <span>Total Lintasan: {g.passages} kendaraan</span>
                  <span>Tingkat Sukses: {g.passages > 0 ? `${((g.identified / g.passages) * 100).toFixed(0)}%` : "100%"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Semua gerbang pos aktif melayani deteksi otomatis. Metrik diperbarui secara otomatis setiap kali ada pergerakan armada.
          </div>
        )}
      </GlassCard>
    </div>
  );
}
