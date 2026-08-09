"use client";

import React from "react";
import Link from "next/link";
import { GateFeed } from "@/lib/gate-feeds";
import { GlassCard } from "../ui/glass-card";
import { GuideSwap } from "../ui/guide-note";
import { Cctv, SatelliteDish } from "lucide-react";

/**
 * One screen of the monitoring wall: a gate's raw camera view.
 *
 * RAW VIDEO ONLY. No bounding boxes, no hull-ID readout, no overlay of any kind
 * (PRD Goal 7 / Non-Goals). Inference reaches this console solely as finished,
 * consensus-voted crossing events — and the reading itself is inspected on the
 * gate that produced it, not here.
 */
export function CctvViewport({
  feeds,
  cameraCode,
  onCameraChange,
  label,
}: {
  feeds: GateFeed[];
  cameraCode: string;
  onCameraChange: (cameraCode: string) => void;
  label: string;
}) {
  const feed = feeds.find((f) => f.cameraCode === cameraCode);

  return (
    <GlassCard className="p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--text-dim)] shrink-0">
          {label}
        </span>
        <Cctv className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <select
          value={cameraCode}
          onChange={(e) => onCameraChange(e.target.value)}
          className="flex-1 min-w-0 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          {/* Keeps the select controlled during the frame before a pane has
              been pointed at a gate. */}
          {!feed && (
            <option value={cameraCode}>
              {feeds.length === 0 ? "Tidak ada kamera" : "Memilih kamera…"}
            </option>
          )}
          {feeds.map((f) => (
            <option key={f.cameraCode} value={f.cameraCode}>
              {f.cameraName} · {f.direction}
            </option>
          ))}
        </select>
      </div>

      <GuideSwap
        title={`Layar Gate — ${label}`}
        note="Layar pantau gate. Menu di atas tiap layar memilih gate mana yang ditampilkan, dan kedua layar bisa diarahkan ke gate berbeda — misalnya gate masuk di kiri, gate keluar di kanan. Gambarnya sengaja polos: tidak ada kotak deteksi maupun nomor lambung yang ditempel, karena tayangan langsung dipakai untuk melihat kondisi lapangan, bukan untuk menilai hasil AI. Hasil pembacaan ada di halaman Riwayat Pembacaan. Tombol 'Buka tayangan langsung' membuka aliran video gate itu."
      >
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-[var(--border)]">
          <CctvPlaceholder feed={feed} />
        </div>

        <p className="font-mono text-[10px] text-[var(--text-dim)] truncate">
          {feed
            ? `${feed.gateLocation || feed.cameraCode} · ${feed.status}`
            : "Kamera belum dipilih"}
        </p>
        {feed && (
          <Link
            href={`/live/${feed.cameraCode}`}
            className="inline-block font-mono text-[10px] text-amber-500 hover:underline"
          >
            Buka tayangan langsung →
          </Link>
        )}
      </GuideSwap>
    </GlassCard>
  );
}

/** RTSP is registered but nothing consumes it on this page — say so, don't fake a feed. */
function CctvPlaceholder({ feed }: { feed: GateFeed | undefined }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
      <SatelliteDish className="w-7 h-7 text-[var(--text-dim)]" />
      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
        CCTV belum tersambung
      </p>
      <p className="font-mono text-[10px] text-white/50 break-all">
        {feed?.rtspUrl || "Alamat RTSP belum diisi di Konfigurasi Sistem"}
      </p>
      <p className="text-[10px] text-white/40 max-w-xs">
        Alamat kamera sudah terdaftar, tetapi belum ada aliran langsung yang masuk ke
        halaman ini.
      </p>
    </div>
  );
}
