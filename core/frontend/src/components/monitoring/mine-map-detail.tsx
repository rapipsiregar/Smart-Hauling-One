"use client";

import React from "react";
import { Checkpoint } from "@/lib/checkpoints";
import { PitOccupancy } from "@/lib/types";
import { GlassCard } from "../ui/glass-card";
import { Info, CheckCircle2, Clock, Truck } from "lucide-react";

interface MineMapDetailProps {
  selectedCp: Checkpoint | null;
  pit: PitOccupancy | null;
  matchCheckpoint: (gate: string | null) => string | null;
}

export function MineMapDetail({ selectedCp, pit, matchCheckpoint }: MineMapDetailProps) {
  const getTrucksForCheckpoint = (cpId: string) => {
    const inside = (pit?.inside ?? []).filter((t) => matchCheckpoint(t.lastGate) === cpId);
    const outside = (pit?.outside ?? []).filter((t) => matchCheckpoint(t.lastGate) === cpId);
    return { inside, outside };
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between bg-slate-950/20 backdrop-blur-sm border-[var(--border)]">
      {selectedCp ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
              Detail Pos: {selectedCp.name}
            </h4>
            {selectedCp.status === "active" ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                <CheckCircle2 className="w-3 h-3" /> AKTIF
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold">
                <Clock className="w-3 h-3" /> PENDING
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs font-mono text-[var(--text-secondary)]">
            <div>
              <span className="text-[10px] text-[var(--text-dim)] uppercase block">Wilayah Operasional</span>
              <span className="text-[var(--text-primary)] font-bold">{selectedCp.region}</span>
            </div>

            <div>
              <span className="text-[10px] text-[var(--text-dim)] uppercase block">Detail Lokasi Fisik</span>
              <span className="text-[var(--text-primary)] font-bold">{selectedCp.locationDetail}</span>
            </div>

            <div>
              <span className="text-[10px] text-[var(--text-dim)] uppercase block">Koordinat Geografis (UTM)</span>
              {selectedCp.coordinates ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  X: {selectedCp.coordinates.x.toLocaleString()} | Y: {selectedCp.coordinates.y.toLocaleString()}
                </span>
              ) : (
                <span className="text-rose-500 font-bold">Belum Terdaftar</span>
              )}
            </div>

            <div>
              <span className="text-[10px] text-[var(--text-dim)] uppercase block">Perusahaan Pengelola</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedCp.entities.map((e, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded text-[9px] font-bold border border-[var(--border)]">
                    {e}
                  </span>
                ))}
              </div>
            </div>

            {selectedCp.keterangan !== "-" && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] flex gap-1">
                <Info className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span className="text-amber-800 dark:text-amber-300/90 font-semibold">{selectedCp.keterangan}</span>
              </div>
            )}
          </div>

          {/* Antrean Kendaraan Terkini */}
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            <h5 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-500" /> Kendaraan Melintas Terakhir
            </h5>
            {(() => {
              const { inside, outside } = getTrucksForCheckpoint(selectedCp.id);
              const total = inside.length + outside.length;
              if (total === 0) {
                return <p className="text-[10px] text-[var(--text-dim)]">Tidak ada antrean terdeteksi di pos ini.</p>;
              }
              return (
                <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1">
                  {inside.map((t) => (
                    <div key={t.hullId} className="flex justify-between items-center p-1.5 rounded bg-emerald-500/5 border border-emerald-500/10 text-[10px]">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.hullId}</span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold uppercase">Masuk ke Pit</span>
                    </div>
                  ))}
                  {outside.map((t) => (
                    <div key={t.hullId} className="flex justify-between items-center p-1.5 rounded bg-amber-500/5 border border-amber-500/10 text-[10px]">
                      <span className="font-bold text-amber-600 dark:text-amber-400">{t.hullId}</span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-500 font-bold uppercase">Keluar Pit</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
          <Info className="w-8 h-8 text-[var(--text-dim)] mb-2" />
          <p className="text-xs text-[var(--text-secondary)]">Pilih salah satu pos cek di peta untuk melihat detail informasi.</p>
        </div>
      )}

      <div className="mt-4 p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-[var(--text-dim)] leading-relaxed font-sans">
          Klik penanda lingkaran pada peta untuk berpindah antar pos pemeriksaan. Posisi dihitung secara spasial proporsional.
        </p>
      </div>
    </GlassCard>
  );
}
