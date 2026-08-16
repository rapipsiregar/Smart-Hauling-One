"use client";

import React from "react";
import Link from "next/link";
import { GateFeed } from "@/lib/gate-feeds";
import { GlassCard } from "../ui/glass-card";
import { GuideSwap } from "../ui/guide-note";
import { LivePlayer } from "../live/live-player";
import { Cctv } from "lucide-react";

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
              {f.cameraName}
            </option>
          ))}
        </select>
      </div>

      <GuideSwap
        title={`Layar Gate — ${label}`}
        note="Layar pantau gate. Menu di atas tiap layar memilih gate mana yang ditampilkan, dan kedua layar bisa diarahkan ke gate berbeda. Setiap gate kini mendeteksi truk masuk maupun keluar sendiri, jadi tidak ada lagi gate yang dikhususkan untuk satu arah. Gambarnya sengaja polos: tidak ada kotak deteksi maupun nomor lambung yang ditempel, karena tayangan langsung dipakai untuk melihat kondisi lapangan, bukan untuk menilai hasil AI. Hasil pembacaan ada di halaman Riwayat Pembacaan. Tombol 'Buka tayangan langsung' membuka aliran video gate itu."
      >
        {feed ? (
          <LivePlayer cameraCode={feed.cameraCode} cameraName={feed.cameraName} />
        ) : (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-[var(--border)] flex items-center justify-center">
            <p className="font-mono text-xs text-[var(--text-dim)]">Kamera belum dipilih</p>
          </div>
        )}

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
