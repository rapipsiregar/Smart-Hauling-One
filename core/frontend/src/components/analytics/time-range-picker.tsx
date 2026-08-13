"use client";

import React from "react";
import { Calendar as CalendarIcon, Clock, Filter } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export type PeriodType = "daily" | "weekly" | "monthly" | "custom";

export interface TimeRangeFilter {
  period: PeriodType;
  startDate: string;
  endDate: string;
}

interface TimeRangePickerProps {
  filter: TimeRangeFilter;
  onChange: (newFilter: TimeRangeFilter) => void;
  periodLabel?: string;
  loading?: boolean;
}

export function TimeRangePicker({
  filter,
  onChange,
  periodLabel,
  loading = false,
}: TimeRangePickerProps) {
  const handlePeriodChange = (period: PeriodType) => {
    onChange({ ...filter, period });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, startDate: e.target.value });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, endDate: e.target.value });
  };

  return (
    <GlassCard className="p-4 space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Preset Period Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-elevated)] p-1.5 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => handlePeriodChange("daily")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center gap-1.5 ${
              filter.period === "daily"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Harian
          </button>

          <button
            type="button"
            onClick={() => handlePeriodChange("weekly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center gap-1.5 ${
              filter.period === "weekly"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Mingguan
          </button>
 
          <button
            type="button"
            onClick={() => handlePeriodChange("monthly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center gap-1.5 ${
              filter.period === "monthly"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Bulanan
          </button>

          <button
            type="button"
            onClick={() => handlePeriodChange("custom")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center gap-1.5 ${
              filter.period === "custom"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Rentang Kustom
          </button>
        </div>

        {/* Date Inputs */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {filter.period === "daily" && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)]">Tanggal:</span>
              <input
                type="date"
                value={filter.startDate}
                onChange={handleStartDateChange}
                className="bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {filter.period === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--text-secondary)]">Dari:</span>
              <input
                type="date"
                value={filter.startDate}
                onChange={handleStartDateChange}
                className="bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="text-[var(--text-secondary)]">Sampai:</span>
              <input
                type="date"
                value={filter.endDate}
                onChange={handleEndDateChange}
                className="bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Badge */}
      <div className="flex items-center justify-between text-xs font-mono bg-[var(--bg-elevated)]/60 px-3 py-2 rounded-xl border border-[var(--border)]">
        <div className="flex items-center gap-2 text-amber-500 font-semibold">
          <span>📌 Menampilkan Data:</span>
          <span className="text-[var(--text-primary)]">{periodLabel || "Memuat..."}</span>
        </div>
        {loading && (
          <span className="text-[10px] text-amber-400 animate-pulse">
            🔄 Mengisolasi & memuat data...
          </span>
        )}
      </div>
    </GlassCard>
  );
}
