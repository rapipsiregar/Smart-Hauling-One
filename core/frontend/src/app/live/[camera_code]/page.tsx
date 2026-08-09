"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { Radio, ArrowLeft, Cpu, Info } from "lucide-react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";
import { GlassCard } from "@/components/ui/glass-card";
import { GuideSwap } from "@/components/ui/guide-note";
import { LivePlayer } from "@/components/live/live-player";
import { DeviceHealthBadge } from "@/components/devices/device-health-badge";

/**
 * PAGE-009 — one gate's raw camera feed, on demand.
 *
 * One gate at a time by construction: the session is scoped to this route's
 * `camera_code`, and leaving the page closes it.
 */
export default function LiveGatePage({ params }: { params: Promise<{ camera_code: string }> }) {
  const { camera_code } = use(params);
  const cameraCode = decodeURIComponent(camera_code);
  const [camera, setCamera] = useState<Camera | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getCamera(cameraCode)
      .then((c) => { if (!cancelled) setCamera(c); })
      .catch(() => { /* identity is decoration here; the player works regardless */ });
    return () => { cancelled = true; };
  }, [cameraCode]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-amber-500 font-mono text-xs font-bold tracking-widest uppercase">
          <Radio className="w-4 h-4" /> Tayangan Langsung · {cameraCode}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/devices"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors"
          >
            <Cpu className="w-3.5 h-3.5" /> Perangkat Edge
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Monitoring
          </Link>
        </div>
      </div>

      <GlassCard className="p-5">
        <GuideSwap
          title="Tayangan Langsung Gate"
          note="Menampilkan gambar mentah kamera gate secara langsung dari perangkat di lokasi. Sengaja polos tanpa kotak deteksi maupun tulisan nomor lambung — tayangan langsung dipakai untuk melihat keadaan gate, sedangkan hasil pembacaan AI sudah punya halamannya sendiri. Kalau gambar tidak muncul, biasanya perangkat gate sedang tidak terhubung ke jaringan."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {camera?.name ?? cameraCode}
                  {camera?.gate_location ? ` · ${camera.gate_location}` : ""}
                </h2>
                <p className="text-[11px] font-mono text-[var(--text-dim)] mt-0.5 truncate">
                  {camera?.rtsp_url ?? camera?.ip_host ?? "alamat kamera tidak tercatat"}
                </p>
              </div>
              {camera && (
                <DeviceHealthBadge
                  status={camera.device_status ?? camera.status}
                  lastHeartbeatAt={camera.last_heartbeat_at ?? null}
                  queueDepth={camera.local_queue_depth ?? 0}
                  agentVersion={camera.agent_version}
                />
              )}
            </div>

            <LivePlayer cameraCode={cameraCode} cameraName={camera?.name} />

            <div className="flex items-start gap-2 text-[11px] text-[var(--text-dim)] leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              <p>
                Gambar mentah tanpa anotasi. Hasil deteksi dan pembacaan nomor lambung tidak
                ditayangkan di sini — lihat{" "}
                <Link href="/cctv-history" className="text-amber-500 hover:underline">Riwayat Pembacaan</Link>
                {" "}atau{" "}
                <Link href="/cctv-history" className="text-amber-500 hover:underline">Riwayat Pembacaan</Link>.
              </p>
            </div>
          </div>
        </GuideSwap>
      </GlassCard>
    </div>
  );
}
