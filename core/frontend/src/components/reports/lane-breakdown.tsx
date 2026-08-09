"use client";

import React from "react";
import { LogIn, LogOut } from "lucide-react";
import { ShiftReport } from "@/lib/types";
import { GuideSwap } from "@/components/ui/guide-note";
import { ShiftMetrics } from "@/lib/shift-metrics";

export function LaneBreakdown({ report, metrics }: { report: ShiftReport; metrics: ShiftMetrics }) {
  const { gatePeak, crossings } = metrics;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print-cols-2 print-avoid-break">
      <div className="lg:col-span-7 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-4 space-y-3">
        <GuideSwap
          title="Lintasan per Gate"
          note="Sebaran lintasan di tiap gate, dipisah antara truk masuk dan truk keluar. Batang hijau = masuk, batang oranye = keluar. Gate masuk dan gate keluar yang jumlahnya timpang jauh biasanya menandakan ada lintasan yang tidak terdeteksi."
        >
          <span className="text-[10px] font-bold font-mono text-[var(--text-dim)] uppercase tracking-widest block flex items-center gap-1.5">
            Lintasan per Gate
          </span>
          <div className="space-y-3 pt-1">
            {report.perGate.map((g) => {
              const total = g.inbound + g.outbound + g.undirected;
              return (
                <div key={g.gate} className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[11px] text-amber-500 w-24 truncate" title={g.gate}>
                    {g.gate}
                  </span>
                  <div className="flex-grow h-5 bg-[var(--bg-input)] rounded overflow-hidden border border-[var(--border)] flex">
                    <div
                      className="h-full bg-emerald-500 flex items-center justify-end pr-1.5"
                      style={{ width: `${(g.inbound / gatePeak) * 100}%` }}
                    >
                      {g.inbound > 0 && (
                        <span className="text-[9px] font-mono font-bold text-slate-950">{g.inbound}</span>
                      )}
                    </div>
                    <div
                      className="h-full bg-amber-500 flex items-center justify-end pr-1.5"
                      style={{ width: `${(g.outbound / gatePeak) * 100}%` }}
                    >
                      {g.outbound > 0 && (
                        <span className="text-[9px] font-mono font-bold text-slate-950">{g.outbound}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-dim)] w-8 text-right">{total}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 pt-1 text-[10px] font-mono text-[var(--text-dim)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> <LogIn size={11} /> Masuk
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> <LogOut size={11} /> Keluar
            </span>
          </div>
        </GuideSwap>
      </div>

      <div className="lg:col-span-5 border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between">
        <GuideSwap
          title="Rincian per Gate"
          note="Data yang sama dalam bentuk tabel: jumlah lintasan masuk, keluar, dan porsinya terhadap total. Berguna untuk menyalin angkanya ke laporan lain."
        >
          <div className="space-y-3">
            <span className="text-[10px] font-bold font-mono text-[var(--text-dim)] uppercase tracking-widest block">
              Rincian per Gate
            </span>
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-dim)]">
                  <th className="pb-2 font-bold uppercase">Gate</th>
                  <th className="pb-2 text-right font-bold uppercase">Masuk</th>
                  <th className="pb-2 text-right font-bold uppercase">Keluar</th>
                  <th className="pb-2 text-right font-bold uppercase">Porsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {report.perGate.map((g) => {
                  const total = g.inbound + g.outbound + g.undirected;
                  const share = crossings > 0 ? Math.round((total / crossings) * 100) : 0;
                  return (
                    <tr key={g.gate}>
                      <td className="py-2 font-bold text-[var(--text-primary)]">{g.gate}</td>
                      <td className="py-2 text-right text-emerald-400">{g.inbound}</td>
                      <td className="py-2 text-right text-amber-500">{g.outbound}</td>
                      <td className="py-2 text-right font-black">{share}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[10px] text-[var(--text-dim)] font-mono leading-relaxed pt-3 border-t border-[var(--border)]">
            Semua angka terukur dari hasil deteksi nyata (run {report.date}, model {report.model}).
            Ritase dihitung dari pasangan IN + OUT per nomor lambung.
          </div>
        </GuideSwap>
      </div>
    </div>
  );
}
