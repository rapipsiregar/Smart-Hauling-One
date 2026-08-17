"use client";

import React, { useRef, useState } from "react";
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
  const [hideOverlay, setHideOverlay] = useState(false);

  const isLive = state === "live" || hideOverlay;

  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-[var(--border)] group">
      {state !== "live" && (
        <img
          src="/placeholder-cctv.jpg"
          alt="CCTV Preview"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
            hideOverlay ? "opacity-100 blur-0" : "opacity-40 blur-[0.5px]"
          }`}
        />
      )}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className={`w-full h-full object-contain ${state === "live" ? "opacity-100" : "opacity-0"}`}
      />

      {isLive && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-mono font-bold text-rose-400 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE
        </span>
      )}

      {state !== "live" && (
        <button
          onClick={() => setHideOverlay(!hideOverlay)}
          className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800/90 backdrop-blur-sm text-[10px] font-mono text-slate-200 hover:text-white border border-slate-700 transition-all duration-200 opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {hideOverlay ? "Tampilkan Status" : "Sembunyikan Status"}
        </button>
      )}

      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/30">
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
      <Notice icon={<Loader2 className="w-6 h-6 animate-spin" />} tone="text-slate-400">
        <p className="text-sm font-semibold text-white">Menyambungkan ke {label}…</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Perangkat gate mulai mengirim gambar setelah menerima perintah dari server.
        </p>
      </Notice>
    );
  }

  if (state === "unreachable") {
    return (
      <Notice icon={<WifiOff className="w-6 h-6" />} tone="text-rose-400">
        <p className="text-sm font-semibold text-white">Perangkat tidak terjangkau</p>
        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed max-w-sm">
          Sesi berhasil dibuka di server, tetapi {label} tidak mengirim gambar. Perangkat edge-nya
          kemungkinan mati atau kehilangan koneksi — periksa statusnya di halaman Perangkat Edge.
        </p>
        <RetryButton onRetry={onRetry} />
      </Notice>
    );
  }

  if (state === "unsupported") {
    return (
      <Notice icon={<PlugZap className="w-6 h-6" />} tone="text-slate-500">
        <p className="text-sm font-semibold text-white">Tayangan langsung belum tersedia</p>
        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed max-w-sm">
          Endpoint <span className="font-mono text-slate-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-800">/api/cameras/…/live/start</span> belum terpasang di
          backend, dan relay media (WebRTC) belum dijalankan. Halaman ini akan langsung berfungsi
          begitu keduanya aktif.
        </p>
      </Notice>
    );
  }

  return (
    <Notice icon={<AlertCircle className="w-6 h-6" />} tone="text-rose-400">
      <p className="text-sm font-semibold text-white">Gagal menayangkan</p>
      <p className="text-[11px] text-slate-300 mt-1 font-mono break-all max-w-sm">{message}</p>
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
      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 border border-slate-700 bg-slate-900/60 text-slate-200 font-semibold text-xs rounded-lg hover:text-amber-500 hover:border-amber-500/40 transition-colors cursor-pointer"
    >
      <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
    </button>
  );
}
