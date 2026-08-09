"use client";

import React, { useRef } from "react";
import { Loader2, WifiOff, AlertCircle, PlugZap, RefreshCw } from "lucide-react";
import { useLiveSession, LiveState } from "@/lib/use-live-session";

/**
 * PAGE-009's player (`docs/design_system.md` §7.11).
 *
 * Deliberately has **no overlay controls** — no bounding boxes, no hull-ID
 * readout, no "show detections" toggle. This stream is the unmodified camera
 * output by design (`docs/edge-system/PRD.md` Goal 7); that data does not exist
 * on this path and must not be faked onto it. Readings live in the crossing
 * feed instead.
 */
export function LivePlayer({ cameraCode, cameraName }: { cameraCode: string; cameraName?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, message, retry } = useLiveSession(cameraCode, videoRef);

  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-[var(--border)]">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`w-full h-full object-contain ${state === "live" ? "opacity-100" : "opacity-0"}`}
      />

      {state === "live" && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono font-bold text-rose-400">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
        </span>
      )}

      {state !== "live" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <StateNotice state={state} cameraCode={cameraCode} cameraName={cameraName} message={message} onRetry={retry} />
        </div>
      )}
    </div>
  );
}

function StateNotice({
  state, cameraCode, cameraName, message, onRetry,
}: {
  state: LiveState;
  cameraCode: string;
  cameraName?: string;
  message: string | null;
  onRetry: () => void;
}) {
  const label = cameraName ? `${cameraCode} — ${cameraName}` : cameraCode;

  if (state === "starting" || state === "connecting") {
    return (
      <Notice icon={<Loader2 className="w-6 h-6 animate-spin" />} tone="text-[var(--text-secondary)]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Menyambungkan ke {label}…</p>
        <p className="text-[11px] text-[var(--text-dim)] mt-1">
          Perangkat gate mulai mengirim gambar setelah menerima perintah dari server.
        </p>
      </Notice>
    );
  }

  if (state === "unreachable") {
    return (
      <Notice icon={<WifiOff className="w-6 h-6" />} tone="text-rose-400">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Perangkat tidak terjangkau</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed max-w-sm">
          Sesi berhasil dibuka di server, tetapi {label} tidak mengirim gambar. Perangkat edge-nya
          kemungkinan mati atau kehilangan koneksi — periksa statusnya di halaman Perangkat Edge.
        </p>
        <RetryButton onRetry={onRetry} />
      </Notice>
    );
  }

  if (state === "unsupported") {
    return (
      <Notice icon={<PlugZap className="w-6 h-6" />} tone="text-[var(--text-dim)]">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Tayangan langsung belum tersedia</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed max-w-sm">
          Endpoint <span className="font-mono">/api/cameras/…/live/start</span> belum terpasang di
          backend, dan relay media (WebRTC) belum dijalankan. Halaman ini akan langsung berfungsi
          begitu keduanya aktif.
        </p>
      </Notice>
    );
  }

  return (
    <Notice icon={<AlertCircle className="w-6 h-6" />} tone="text-rose-400">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Gagal menayangkan</p>
      <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-mono break-all max-w-sm">{message}</p>
      <RetryButton onRetry={onRetry} />
    </Notice>
  );
}

function Notice({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className={`flex justify-center mb-3 ${tone}`}>{icon}</div>
      {children}
    </div>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-xs rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
    </button>
  );
}
