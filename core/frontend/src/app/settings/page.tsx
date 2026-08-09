"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { ShiftReport } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { ResetCrossings } from "@/components/settings/reset-crossings";
import { CameraRegistry } from "@/components/settings/camera-registry";
import { CheckpointsTable } from "@/components/checkpoints/checkpoints-table";
import { DEMO_SHIFT_REPORT } from "@/lib/shift-report";
import { Cpu, Trash2, Laptop } from "lucide-react";

export default function SettingsPage() {
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getShiftReport().then(setReport).catch(() => setReport(DEMO_SHIFT_REPORT));
  }, []);

  const handleReset = () => {
    if (!confirm("Hapus preferensi tampilan lokal (tema, kondisi sidebar)? Data backend tidak tersentuh.")) return;
    try {
      const keep = localStorage.getItem("sg_theme");
      localStorage.clear();
      if (keep) localStorage.setItem("sg_theme", keep);
      setResetMsg("✓ Preferensi lokal dihapus.");
    } catch {
      setResetMsg("⚠ Gagal menghapus penyimpanan lokal.");
    }
  };

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2 text-amber-500 font-mono text-xs font-bold tracking-widest uppercase">
        <Laptop className="w-4 h-4" /> Konfigurasi Sistem
      </div>

      {/* Check Points Specifications */}
      <CheckpointsTable />

      {/* Camera registry — per-gate scalable camera management */}
      <CameraRegistry />

      {/* Edge devices — one Jetson per registered camera */}
      <GlassCard className="p-5">
        <GuideSwap title="Perangkat Edge" note="Tiap kamera gate dipasangkan dengan satu mini-PC di lokasi yang menjalankan deteksi truk. Ringkasan ini menunjukkan berapa perangkat yang sedang terhubung. Pengaturan rincinya ada di halaman Perangkat Edge.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <SectionTitle icon={<Cpu className="w-4 h-4" />} title="Perangkat Edge" subtitle="Pengaturan inferensi dan kesehatan tiap perangkat gate" />
            </div>
            <Link
              href="/settings/devices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 transition-colors shrink-0"
            >
              <Cpu className="w-3.5 h-3.5" /> Buka Perangkat Edge
            </Link>
          </div>
        </GuideSwap>
      </GlassCard>

      {/* Inference engine info (real run metadata) */}
      <GlassCard className="p-5">
        <GuideSwap title="Mesin Inferensi" note="Menampilkan model AI yang dipakai dan kapan pemrosesan terakhir dijalankan. Dipakai untuk memastikan angka di halaman lain berasal dari pemrosesan yang mana.">
          <SectionTitle icon={<Cpu className="w-4 h-4" />} title="Mesin Inferensi" subtitle="Model aktif dan run pemrosesan terakhir" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoTile label="Model" value={report?.model ?? "—"} mono />
            <InfoTile label="Tanggal Run" value={report?.date ?? "—"} mono />
            <InfoTile label="Lintasan" value={report ? String(report.totalCrossings) : "—"} />
            <InfoTile label="Ritase" value={report ? String(report.totalRitase) : "—"} />
            
          </div>
        </GuideSwap>
      </GlassCard>

      {/* Reset */}
      <ResetCrossings />

      <GlassCard className="p-5">
        <GuideSwap title="Reset Preferensi Lokal" note="Menghapus pengaturan tampilan yang tersimpan di browser ini — tema terang/gelap, kondisi sidebar, dan mode panduan. Data lintasan, nomor lambung, dan laporan tidak ikut terhapus; semuanya tersimpan di server.">
          <SectionTitle icon={<Trash2 className="w-4 h-4" />} title="Reset Preferensi Lokal" subtitle="Hanya menghapus preferensi tampilan — data asli tidak tersentuh" />
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 border border-rose-500/30 text-rose-400 font-semibold text-sm rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Hapus Preferensi
            </button>
            {resetMsg && <span className="text-xs font-mono text-[var(--text-secondary)]">{resetMsg}</span>}
          </div>
        </GuideSwap>
      </GlassCard>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <span className="text-amber-500">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{subtitle}</p>
    </div>
  );
}

function InfoTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2.5">
      <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-dim)]">{label}</p>
      <p className={`text-sm font-semibold text-[var(--text-primary)] truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
