"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp, RefreshCw, ServerCrash, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { RitaseTrend, TrendGranularity } from "@/lib/types";
import { GRANULARITIES, defaultRange, trendTotals } from "@/lib/trend";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { CheckpointLegend, RitaseBarChart } from "@/components/trend/ritase-bar-chart";
import { TrendTable } from "@/components/trend/trend-table";

/**
 * PAGE — ritase over time.
 *
 * Every figure here is bucketed by MINING day (06:00–06:00), the site's own
 * reporting cut. A calendar-day chart would split each night shift across two
 * columns and disagree with the paperwork it is meant to be checked against.
 */
export default function TrendPage() {
  const [granularity, setGranularity] = useState<TrendGranularity>("day");
  const [range, setRange] = useState(() => defaultRange(30));
  const [trend, setTrend] = useState<RitaseTrend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [dark, setDark] = useState(true);

  // The palette has a selected dark and light step, so the chart has to know
  // which is on screen. Read from the document, where the theme toggle stamps it.
  useEffect(() => {
    const read = () => {
      const stamped = document.documentElement.getAttribute("data-theme");
      if (stamped === "light") return setDark(false);
      if (stamped === "dark") return setDark(true);
      setDark(!document.documentElement.classList.contains("light"));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getRitaseTrend(granularity, range)
      .then((data) => {
        if (cancelled) return;
        setTrend(data);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setTrend(null);
        setError("Data tren tidak dapat dimuat dari server.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [granularity, range, tick]);

  const totals = useMemo(() => (trend ? trendTotals(trend) : null), [trend]);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-500 font-mono text-xs font-bold tracking-widest uppercase">
          <TrendingUp className="w-4 h-4" /> Tren Produksi Ritase
        </div>
        <button
          onClick={() => setTick((t) => t + 1)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
        </button>
      </div>

      <GlassCard className="p-5">
        <GuideSwap
          title="Tren Produksi Ritase"
          note="Halaman ini menampilkan jumlah ritase dari waktu ke waktu, dipecah per pos cek. Satu hari dihitung dari pukul 06:00 pagi sampai 06:00 pagi berikutnya, mengikuti siklus pelaporan tambang."
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tren Ritase per Pos Cek</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Satu hari tambang = pukul 06:00 hingga 06:00 esok hari, sesuai siklus pelaporan
            di lapangan — bukan pergantian tanggal tengah malam. Shift malam karena itu tetap
            utuh dalam satu hari laporan.
          </p>
        </GuideSwap>
      </GlassCard>

      {/* Filters in one row above the chart. */}
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
              Skala Waktu
            </label>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              {GRANULARITIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGranularity(option.value)}
                  aria-pressed={granularity === option.value}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    granularity === option.value
                      ? "bg-amber-500 text-slate-950"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <DateField
            label="Dari Tanggal"
            value={range.startDate}
            onChange={(startDate) => setRange((r) => ({ ...r, startDate }))}
          />
          <DateField
            label="Sampai Tanggal"
            value={range.endDate}
            onChange={(endDate) => setRange((r) => ({ ...r, endDate }))}
          />

          <div className="flex gap-1.5">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setRange(defaultRange(days))}
                className="px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-[11px] rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors cursor-pointer"
              >
                {days} hari
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {error && (
        <GlassCard className="p-5">
          <div className="flex items-start gap-2.5 text-xs text-rose-400">
            <ServerCrash className="w-4 h-4 shrink-0 mt-px" />
            <p>{error}</p>
          </div>
        </GlassCard>
      )}

      {loading && !trend && (
        <p className="text-xs text-[var(--text-dim)] font-mono py-8 text-center">Memuat tren…</p>
      )}

      {trend && totals && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Total Ritase" value={totals.ritase} accent />
            <StatTile label="Total Lintasan" value={totals.crossings} />
            <StatTile label="Periode Tercatat" value={trend.series.length} />
            <StatTile label="Pos Cek Aktif" value={trend.checkpoints.length} />
          </div>

          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Ritase per Periode
              </h3>
              <CheckpointLegend trend={trend} dark={dark} />
            </div>
            <p className="text-[11px] text-[var(--text-dim)]">
              Arahkan kursor ke satu batang untuk melihat rincian angkanya.
            </p>
            <RitaseBarChart trend={trend} dark={dark} />
          </GlassCard>

          {trend.undatedCrossings > 0 && (
            <GlassCard className="p-4">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {trend.undatedCrossings} lintasan
                  </span>{" "}
                  tidak memiliki catatan waktu sehingga tidak dapat ditempatkan pada garis waktu,
                  dan tidak ikut dihitung pada grafik di atas. Lintasan tersebut tetap tersimpan
                  dan muncul di riwayat pembacaan.
                </p>
              </div>
            </GlassCard>
          )}

          <GlassCard className="p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Rincian Angka &amp; Jumlah
            </h3>
            <TrendTable trend={trend} dark={dark} />
          </GlassCard>
        </>
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500/60"
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <GlassCard className="p-4">
      <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</p>
      <p
        className={`text-2xl font-bold font-mono mt-1 ${
          accent ? "text-amber-500" : "text-[var(--text-primary)]"
        }`}
      >
        {value.toLocaleString("id-ID")}
      </p>
    </GlassCard>
  );
}
