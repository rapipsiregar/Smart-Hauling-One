"use client";

import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { ShiftReport, UnpairedCrossing } from "@/lib/types";
import { GuideSwap } from "@/components/ui/guide-note";

const REASON_LABEL: Record<UnpairedCrossing["reason"], string> = {
  "missing-out": "Masuk, belum keluar",
  "missing-in": "Keluar, belum masuk",
  "no-direction": "Arah gate tidak diketahui",
  "unidentified-hull": "Nomor lambung tidak terbaca",
};

const REASON_TONE: Record<UnpairedCrossing["reason"], string> = {
  "missing-out": "text-amber-500 bg-amber-500/10",
  "missing-in": "text-amber-500 bg-amber-500/10",
  "no-direction": "text-sky-400 bg-sky-500/10",
  "unidentified-hull": "text-rose-400 bg-rose-500/10",
};

/**
 * Crossings that never found a partner. Kept visible rather than dropped, so a
 * shift's numbers always add up: ritase x 2 + unpaired = total crossings.
 */
export function UnpairedCrossings({ report }: { report: ShiftReport }) {
  const [open, setOpen] = useState(false);
  const rows = report.unpaired ?? [];
  if (rows.length === 0) return null;

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="glass-card overflow-hidden print-avoid-break">
      <GuideSwap
        title="Lintasan Belum Berpasangan"
        note="Lintasan yang belum menemukan pasangannya — truk yang tercatat masuk tapi belum tercatat keluar, atau sebaliknya. Sengaja ditampilkan, bukan dibuang, supaya jumlah totalnya selalu bisa dicocokkan. Truk yang masih di dalam pit wajar muncul di sini; yang perlu diperiksa adalah lintasan keluar tanpa lintasan masuk."
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
              Belum Berpasangan
            </span>
            <span className="text-[10px] font-mono text-[var(--text-dim)] truncate">
              {rows.length} lintasan &middot;{" "}
              {Object.entries(counts)
                .map(([reason, n]) => `${n} ${REASON_LABEL[reason as UnpairedCrossing["reason"]].toLowerCase()}`)
                .join(", ")}
            </span>
          </span>
          {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        </button>

        {open && (
          <div className="border-t border-[var(--border)] overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="bg-[var(--bg-elevated)] text-[var(--text-dim)]">
                  <th className="px-4 py-2 font-bold uppercase">Nomor Lambung</th>
                  <th className="px-4 py-2 font-bold uppercase">Gate</th>
                  <th className="px-4 py-2 font-bold uppercase">Arah</th>
                  <th className="px-4 py-2 font-bold uppercase">Waktu</th>
                  <th className="px-4 py-2 font-bold uppercase">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-bold text-amber-500">{r.hullId}</td>
                    <td className="px-4 py-2">{r.lane}</td>
                    <td className="px-4 py-2">
                      {r.direction === "inbound" ? "Masuk" : r.direction === "outbound" ? "Keluar" : "—"}
                    </td>
                    <td className="px-4 py-2 text-[var(--text-dim)]">{r.crossedAt ?? "belum tersedia"}</td>
                    <td className="px-4 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${REASON_TONE[r.reason]}`}>
                        {REASON_LABEL[r.reason]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GuideSwap>
    </div>
  );
}
