"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { PerformanceKpis } from "@/lib/types";
import { GlassCard } from "./ui/glass-card";
import { GuideSwap } from "./ui/guide-note";
import { AlertTriangle, Layers, Truck } from "lucide-react";

const ACCENTS: Record<string, string> = {
  amber: "text-amber-500",
  emerald: "text-emerald-400",
  rose: "text-rose-400",
};

const CARDS = [
  {
    href: "/cctv-history",
    icon: <Layers className="w-5 h-5" />,
    label: "Lintasan Gate",
    unit: "lintasan",
    hint: "Buka buku lintasan",
    accent: "amber",
    read: (k: PerformanceKpis | null) => k?.totalPassages ?? 0,
    guide:
      "Setiap lintasan truk yang terbaca di gate. Satu lintasan bukan satu ritase — satu ritase terdiri dari lintasan masuk dan keluar.",
  },
  {
    href: "/ritase",
    icon: <Truck className="w-5 h-5" />,
    label: "Nomor Lambung Terbaca",
    unit: "unit",
    hint: "Lihat daftar nomor lambung",
    accent: "emerald",
    read: (k: PerformanceKpis | null) => k?.uniqueTrucks ?? 0,
    guide: "Berapa banyak nomor lambung berbeda yang berhasil dikenali sistem.",
  },
  {
    href: "/gate-console",
    icon: <AlertTriangle className="w-5 h-5" />,
    label: "Gagal Terbaca",
    unit: "perlu ditinjau",
    hint: "Selesaikan pembacaan gagal",
    accent: "rose",
    read: (k: PerformanceKpis | null) => k?.unknown ?? 0,
    guide:
      "Lintasan yang nomor lambungnya tidak terbaca yakin oleh AI. Perlu ditinjau dan dicocokkan manual.",
  },
];

/**
 * The three headline ritase counters, shared by the pages that report on them.
 *
 * Each card is a shortcut into the page that explains its number; the card
 * pointing at the page it is already on stays a plain tile so it doesn't offer
 * a link to nowhere.
 */
export function RitaseMetricCards({ currentHref }: { currentHref?: string }) {
  const [kpis, setKpis] = useState<PerformanceKpis | null>(null);

  useEffect(() => {
    api
      .getPerformanceKpis()
      .then(setKpis)
      .catch((err) => {
        console.warn("Gagal memuat KPI dari backend:", err);
        setKpis({
          totalPassages: 0,
          identified: 0,
          unknown: 0,
          uniqueTrucks: 0,
          totalReads: 0,
          avgConfidence: 0,
          perGate: [],
        });
      });
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-print="hide">
      {CARDS.map((card) => {
        const tile = (
          <MetricCard
            icon={card.icon}
            label={card.label}
            value={card.read(kpis)}
            unit={card.unit}
            hint={card.href === currentHref ? "Anda sedang di halaman ini" : card.hint}
            accent={card.accent}
            guide={card.guide}
            linked={card.href !== currentHref}
          />
        );
        return card.href === currentHref ? (
          <div key={card.href}>{tile}</div>
        ) : (
          <Link key={card.href} href={card.href}>
            {tile}
          </Link>
        );
      })}
    </div>
  );
}

function MetricCard({
  icon, label, value, unit, hint, accent, guide, linked,
}: {
  icon: React.ReactNode; label: string; value: number; unit: string;
  hint: string; accent: string; guide: string; linked: boolean;
}) {
  return (
    <GlassCard
      className={`p-5 flex items-center justify-between h-full ${linked ? "glass-card-hover cursor-pointer" : ""}`}
    >
      {/* Only promise a click where there is somewhere to click to. */}
      <GuideSwap
        title={label}
        note={linked ? `${guide} Klik kartu ini untuk membuka halamannya.` : `${guide} Halaman yang merincinya adalah halaman ini sendiri.`}
      >
        <div className="space-y-1">
          <span className={`text-[10px] font-mono uppercase tracking-widest font-bold flex items-center gap-1.5 ${ACCENTS[accent]}`}>
            {label}
          </span>
          <div className="text-3xl font-black font-mono tracking-tight text-[var(--text-primary)] flex items-baseline gap-1.5">
            {value}
            <span className="text-[10px] text-[var(--text-dim)] font-normal">{unit}</span>
          </div>
          <span className="text-[9px] text-[var(--text-dim)] font-mono block">{hint}</span>
        </div>
      </GuideSwap>
      <div className={`p-2.5 rounded-xl bg-[var(--bg-elevated)] ${ACCENTS[accent]}`}>{icon}</div>
    </GlassCard>
  );
}
