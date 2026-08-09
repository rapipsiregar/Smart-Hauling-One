"use client";

import React from "react";
import { GuideSwap } from "@/components/ui/guide-note";
import { ShiftMetrics } from "@/lib/shift-metrics";

export function ShiftKpiGrid({ metrics }: { metrics: ShiftMetrics }) {
  const { ritase, crossings, unpaired, precision, reconRate } = metrics;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print-cols-4 print-avoid-break">
      <Tile
        label="Ritase"
        value={`${ritase}`}
        unit="siklus"
        sub={`dari ${crossings} lintasan gate`}
        tone="text-amber-500"
        guide="Jumlah siklus lengkap: satu ritase = satu lintasan masuk (IN) yang berpasangan dengan satu lintasan keluar (OUT) pada nomor lambung yang sama. Truk boleh masuk dan keluar lewat gate yang sama."
      />
      <Tile
        label="Lintasan Gate"
        value={`${crossings}`}
        unit="lintasan"
        sub="total pembacaan di semua gate"
        tone="text-[var(--text-primary)]"
        guide="Total lintasan yang terbaca di seluruh gate. Angka ini bukan ritase — satu ritase terdiri dari dua lintasan (IN dan OUT)."
      />
      <Tile
        label="Belum Berpasangan"
        value={`${unpaired}`}
        unit="lintasan"
        sub={unpaired > 0 ? "perlu ditinjau" : "semua berpasangan"}
        tone={unpaired > 0 ? "text-rose-400" : "text-emerald-400"}
        guide="Lintasan yang tidak menemukan pasangannya — IN tanpa OUT, OUT tanpa IN, atau nomor lambung yang tidak terbaca. Tidak dibuang, semuanya tetap tercatat dan bisa ditinjau di bawah."
      />
      <div className="glass-card p-4 space-y-2">
        <GuideSwap
          title="Presisi Pembacaan"
          note="Rata-rata tingkat keyakinan AI saat membaca nomor lambung, dari seluruh lintasan pada jendela waktu ini. Makin tinggi makin dapat dipercaya. Kalau angkanya turun jauh, biasanya ada gate yang kameranya kotor, posisinya bergeser, atau pencahayaannya berubah."
        >
          <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider block">
            Presisi Pembacaan
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{precision.toFixed(1)}%</span>
            <span
              className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                precision >= 90 ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {precision >= 90 ? "BAIK" : "PERLU AUDIT"}
            </span>
          </div>
          <p className="text-[10px] text-[var(--text-dim)] font-mono">
            {reconRate}% lintasan terekonsiliasi
          </p>
        </GuideSwap>
      </div>
    </div>
  );
}

function Tile({ label, value, unit, sub, tone, guide }: {
  label: string; value: string; unit: string; sub: string; tone: string; guide: string;
}) {
  return (
    <div className="glass-card p-4 space-y-2">
      <GuideSwap title={label} note={guide}>
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider block">
          {label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-black font-mono ${tone}`}>{value}</span>
          <span className="text-xs text-[var(--text-dim)] font-normal">{unit}</span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-dim)] block">{sub}</span>
      </GuideSwap>
    </div>
  );
}
