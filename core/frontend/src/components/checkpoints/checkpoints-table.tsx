"use client";

import React, { useState } from "react";
import { CHECKPOINTS, Checkpoint } from "@/lib/checkpoints";
import { MapPin, Building2, Info, CheckCircle2, Clock, Shield } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export function CheckpointsTable() {
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // Ambil data unik dinamis untuk filter
  const allEntities = Array.from(
    new Set(CHECKPOINTS.flatMap((cp) => cp.entities))
  ).sort();

  const allRegions = Array.from(
    new Set(CHECKPOINTS.map((cp) => cp.region))
  ).sort();

  const handleEntityToggle = (entity: string) => {
    setSelectedEntities((prev) =>
      prev.includes(entity)
        ? prev.filter((e) => e !== entity)
        : [...prev, entity]
    );
  };

  const filteredCheckpoints = CHECKPOINTS.filter((cp) => {
    if (selectedRegion !== "all" && cp.region !== selectedRegion) {
      return false;
    }
    if (selectedEntities.length > 0) {
      return cp.entities.some((ent) => selectedEntities.includes(ent));
    }
    return true;
  });

  return (
    <GlassCard className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
              Daftar Lokasi Check Point (CP)
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-sans">
              Pemetaan Wilayah, Detail Lokasi, Entitas Terkait, dan Status Operasional
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 uppercase">
          {filteredCheckpoints.length} POS CEK AKTIF
        </span>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border)] text-xs">
        <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-sans font-semibold">
          <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Saring Perusahaan:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedEntities([])}
            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition border ${
              selectedEntities.length === 0
                ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            SEMUA
          </button>
          {allEntities.map((ent) => {
            const active = selectedEntities.includes(ent);
            return (
              <button
                key={ent}
                onClick={() => handleEntityToggle(ent)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase border ${
                  active
                    ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                    : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
                }`}
              >
                {ent}
              </button>
            );
          })}
        </div>

        <div className="h-4 w-px bg-[var(--border)] hidden md:block" />

        <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-sans font-semibold">
          <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Wilayah:</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setSelectedRegion("all")}
            className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition border ${
              selectedRegion === "all"
                ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            SEMUA
          </button>
          {allRegions.map((reg) => (
            <button
              key={reg}
              onClick={() => setSelectedRegion(reg)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition uppercase border ${
                selectedRegion === reg
                  ? "bg-amber-500 text-slate-950 border-amber-600/30 hover:bg-amber-400"
                  : "bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border-[var(--border)]"
              }`}
            >
              {reg}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-dim)] uppercase text-[10px] tracking-wider">
              <th className="py-3 px-3">Nama Check Point</th>
              <th className="py-3 px-3">Wilayah / Posisi</th>
              <th className="py-3 px-3">Detail Lokasi</th>
              <th className="py-3 px-3">Perusahaan / Entitas Terkait</th>
              <th className="py-3 px-3">Keterangan</th>
              <th className="py-3 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredCheckpoints.map((cp) => {
              const isPending = cp.status === "pending";
              return (
                <tr
                  key={cp.id}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    isPending ? "bg-amber-500/[0.06] dark:bg-amber-950/20" : ""
                  }`}
                >
                  {/* Nama Check Point */}
                  <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      {cp.name}
                    </div>
                  </td>

                  {/* Wilayah / Posisi */}
                  <td className="py-3 px-3">
                    <span
                       className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                        cp.region.includes("Utara")
                          ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 dark:border-cyan-500/30"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30"
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      {cp.region}
                    </span>
                  </td>

                  {/* Detail Lokasi */}
                  <td className={`py-3 px-3 font-semibold ${isPending ? "text-amber-950 dark:text-amber-200 font-bold" : "text-[var(--text-primary)]"}`}>
                    {cp.locationDetail}
                  </td>

                  {/* Perusahaan / Entitas Terkait */}
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {cp.entities.map((ent, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] text-[10px] font-bold"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Keterangan */}
                  <td className="py-3 px-3 text-[var(--text-secondary)] text-[11px] max-w-[240px]">
                    {cp.keterangan === "-" ? (
                      <span className="text-[var(--text-dim)]">—</span>
                    ) : (
                      <div className="flex items-start gap-1 bg-amber-500/10 p-1.5 rounded border border-amber-500/30 text-[10px]">
                        <Info className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                        <span className="text-[var(--text-secondary)] dark:text-amber-200 font-bold">{cp.keterangan}</span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-center">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 text-[10px] font-bold">
                        <Clock className="w-3 h-3" /> PENDING OB
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> AKTIF
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
