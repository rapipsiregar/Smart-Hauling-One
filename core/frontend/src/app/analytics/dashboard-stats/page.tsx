"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TrendingUp, Activity, CheckCircle2, ShieldCheck, RefreshCw, Cpu, Truck, BarChart2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { DashboardStatsResponse } from "@/lib/types";
import { TimeRangePicker, TimeRangeFilter } from "@/components/analytics/time-range-picker";
import { GlassCard } from "@/components/ui/glass-card";

export default function DashboardStatsPage() {
  const [filter, setFilter] = useState<TimeRangeFilter>({
    period: "daily",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (currentFilter: TimeRangeFilter) => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const data = await api.getDashboardStats(
        {
          period: currentFilter.period,
          start_date: currentFilter.startDate,
          end_date: currentFilter.endDate,
        },
        controller.signal
      );
      setStats(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Gagal memuat metrik analisis:", err);
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    api
      .getDashboardStats(
        {
          period: filter.period,
          start_date: filter.startDate,
          end_date: filter.endDate,
        },
        controller.signal
      )
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          console.error("Gagal memuat data statistik:", err);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [filter]);

  const maxBucketVal = stats?.timeSeries?.reduce((max, b) => Math.max(max, b.total), 0) || 1;

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
              Dashboard Statistik Operasional Periode
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Metrik terisolasi berdasar rentang waktu harian, mingguan, dan bulanan dari database server
            </p>
          </div>
        </div>

        <button
          onClick={() => setFilter({ ...filter })}
          disabled={loading}
          className="flex items-center gap-2 bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-xs px-4 py-2 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Data Periode
        </button>
      </GlassCard>

      {/* Time Range Filter Bar */}
      <TimeRangePicker
        filter={filter}
        onChange={setFilter}
        periodLabel={stats?.periodLabel}
        loading={loading}
      />

      {/* Real Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Total Lintasan Terbaca</span>
            <Activity className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
            {stats?.totalPassages ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">lintasan</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Tercatat di periode yang dipilih</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Total Ritase Pasangan</span>
            <Truck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400">
            {stats?.totalRitase ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">ritase</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Pasangan Masuk &amp; Keluar</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Armada Unik Terbaca</span>
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-500">
            {stats?.uniqueTrucks ?? 0} <span className="text-xs text-[var(--text-dim)] font-normal">unit</span>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Terdaftar di sistem tambang</div>
        </GlassCard>

        <GlassCard className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
            <span>Rata-rata Akurasi AI</span>
            <ShieldCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-amber-500">
            {stats?.avgConfidence != null ? `${stats.avgConfidence.toFixed(1)}%` : "0.0%"}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono">Tingkat presisi voting AI</div>
        </GlassCard>
      </div>

      {/* Time Series Distribution Chart */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 font-mono">
          <BarChart2 className="w-4 h-4 text-amber-500" />
          Distribusi Pergerakan Lintasan ({stats?.periodLabel || "Periode Aktif"})
        </h3>

        {stats?.timeSeries && stats.timeSeries.length > 0 ? (
          <div className="space-y-2">
            <div className="h-40 flex items-end gap-1.5 pt-4 pb-2 px-2 border-b border-[var(--border)]">
              {stats.timeSeries.map((bucket, idx) => {
                const heightPct = Math.round((bucket.total / maxBucketVal) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] font-mono px-2 py-0.5 rounded shadow text-[var(--text-primary)] whitespace-nowrap z-10">
                      {bucket.label}: {bucket.total} lintasan
                    </div>
                    <div
                      style={{ height: `${heightPct > 0 ? Math.max(heightPct, 4) : 0}%` }}
                      className={`w-full rounded-t transition-all duration-300 ${
                        bucket.total > 0
                          ? "bg-gradient-to-t from-amber-500 to-orange-400 hover:brightness-125"
                          : "bg-[var(--border)]/30"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-dim)] px-2">
              <span>{stats.timeSeries[0]?.label}</span>
              <span>{stats.timeSeries[Math.floor(stats.timeSeries.length / 2)]?.label}</span>
              <span>{stats.timeSeries[stats.timeSeries.length - 1]?.label}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Tidak ada data lintasan pada periode yang dipilih.
          </div>
        )}
      </GlassCard>

      {/* Gate Performance Breakdown (Real Data) */}
      <GlassCard className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 font-mono">
          <Cpu className="w-4 h-4 text-amber-500" />
          Analisis Kinerja Deteksi Otomatis per Gate Kamera ({stats?.periodLabel || "Periode Aktif"})
        </h3>

        {stats?.perGate && stats.perGate.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.perGate.map((g) => {
              const totalGatePassages = g.inbound + g.outbound + g.undirected;
              return (
                <div key={g.gate} className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-[var(--text-primary)] font-bold">
                    <span>{g.gate}</span>
                    <span className="text-emerald-400">{g.inbound + g.outbound} Terbaca</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Masuk: {g.inbound} | Keluar: {g.outbound}</span>
                    <span>Total: {totalGatePassages} kendaraan</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Belum ada pergerakan kendaraan tercatat pada gerbang pos untuk periode ini.
          </div>
        )}
      </GlassCard>
    </div>
  );
}
