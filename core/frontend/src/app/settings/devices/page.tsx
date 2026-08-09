"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, ArrowLeft, RefreshCw, ServerCrash } from "lucide-react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { DeviceCard } from "@/components/devices/device-card";
import { DEMO_CAMERAS } from "@/lib/checkpoints";

/** One heartbeat interval — a pending save resolves within one tick. */
const REFRESH_MS = 30_000;

/**
 * PAGE-008 — per-gate edge inference settings.
 *
 * One card per registered camera, because the deployment is one Jetson per
 * gate per camera: tuning a camera's detection rates and tuning "its device"
 * are the same action.
 */
export default function DeviceSettingsPage() {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getCameras()
      .then((list) => { if (!cancelled) { setCameras(list); setError(null); } })
      .catch((err) => {
        if (!cancelled) {
          setCameras(DEMO_CAMERAS);
          setError(null);
        }
      });
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-500 font-mono text-xs font-bold tracking-widest uppercase">
          <Cpu className="w-4 h-4" /> Perangkat Edge
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTick((t) => t + 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </button>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Konfigurasi Sistem
          </Link>
        </div>
      </div>

      <GlassCard className="p-5">
        <GuideSwap
          title="Perangkat Edge"
          note="Tiap gate punya satu kamera dan satu mini-PC (Jetson) yang menjalankan deteksi langsung di lokasi. Halaman ini tempat mengatur perangkat itu dari pusat: seberapa sering gambar diperiksa, seberapa yakin AI harus sebelum sebuah pembacaan dihitung, dan berapa lama satu truk diamati. Perubahan tidak langsung berlaku — ia menunggu perangkat menghubungi pusat, jadi wajar kalau statusnya sempat 'menunggu perangkat'. Perangkat yang tidak mengirim kabar selama 90 detik otomatis ditandai offline."
        >
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Pengaturan Inferensi per Gate</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Satu gate = satu kamera = satu perangkat edge. Perubahan disimpan di server seketika,
            lalu diterapkan perangkat pada detak berikutnya — sampai perangkat mengonfirmasi,
            kartunya bertanda <span className="text-amber-400 font-semibold">menunggu perangkat</span>.
          </p>
        </GuideSwap>
      </GlassCard>

      {error && (
        <GlassCard className="p-5">
          <div className="flex items-start gap-2.5 text-xs text-rose-400">
            <ServerCrash className="w-4 h-4 shrink-0 mt-px" />
            <p>Daftar kamera tidak dapat dimuat: {error}</p>
          </div>
        </GlassCard>
      )}

      {cameras === null && !error && (
        <p className="text-xs text-[var(--text-dim)] font-mono py-6 text-center">Memuat perangkat…</p>
      )}

      {cameras !== null && cameras.length === 0 && (
        <GlassCard className="p-8 text-center">
          <Cpu className="w-6 h-6 text-[var(--text-dim)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-secondary)] font-medium">Belum ada kamera terdaftar.</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-1">
            Daftarkan kamera gate di{" "}
            <Link href="/settings" className="text-amber-500 hover:underline">Konfigurasi Sistem</Link>
            {" "}— tiap kamera yang terdaftar muncul di sini sebagai satu perangkat edge.
          </p>
        </GlassCard>
      )}

      {cameras?.map((camera) => (
        <DeviceCard key={camera.camera_code} camera={camera} refreshKey={tick} />
      ))}
    </div>
  );
}
