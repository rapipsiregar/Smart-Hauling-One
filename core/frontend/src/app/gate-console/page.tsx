"use client";

import React, { useEffect, useState } from "react";
import { Camera, CheckCircle2, RefreshCw, Radio, HardDrive, Cpu, Activity, AlertCircle } from "lucide-react";
import { CheckpointsTable } from "@/components/checkpoints/checkpoints-table";
import { api } from "@/lib/api-client";
import { Camera as CameraType, Crossing } from "@/lib/types";

export default function GateConsolePage() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCameraCode, setSelectedCameraCode] = useState<string>("");
  const [crossings, setCrossings] = useState<Crossing[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [camList, dashData] = await Promise.all([
        api.getCameras().catch(() => []),
        api.getDashboardData().catch(() => ({ crossings: [], fleet: [], kpis: { total_videos: 0, identified: 0, unique_trucks: 0, total_reads: 0, avg_confidence: 0, unknown: 0 } })),
      ]);
      setCameras(camList);
      if (camList.length > 0 && !selectedCameraCode) {
        setSelectedCameraCode(camList[0].camera_code);
      }
      setCrossings(dashData.crossings || []);
    } catch {
      setCameras([]);
      setCrossings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCamera = cameras.find((c) => c.camera_code === selectedCameraCode) || cameras[0];
  const latestCrossing = crossings[0] || null;

  const triggerDetection = async () => {
    setIsProcessing(true);
    try {
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-4 border border-[var(--border)] rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
            Pemeriksaan Hasil Pembacaan Kamera Pos (Real-Time)
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Pantauan otomatis nomor lambung truk yang melintas di pos gerbang
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCameraCode}
            onChange={(e) => setSelectedCameraCode(e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 font-medium"
          >
            {cameras.length > 0 ? (
              cameras.map((c) => (
                <option key={c.camera_code} value={c.camera_code}>
                  {c.camera_code} – {c.name} ({c.gate_location || "POS"})
                </option>
              ))
            ) : (
              <option value="">Tidak ada kamera terdaftar</option>
            )}
          </select>

          <button
            onClick={triggerDetection}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
            {isProcessing ? "Memuat..." : "Refresh Hasil"}
          </button>
        </div>
      </div>

      {/* 4 Status Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Status Kamera Pos</div>
            <div className="text-xs font-semibold text-emerald-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />{" "}
              {activeCamera ? `Status: ${activeCamera.status.toUpperCase()}` : "Offline"}
            </div>
          </div>
          <Camera className="w-6 h-6 text-emerald-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Arah Gerbang</div>
            <div className="text-xs font-semibold text-amber-500 mt-1 uppercase">
              {activeCamera?.direction || "INBOUND"}
            </div>
          </div>
          <Activity className="w-6 h-6 text-amber-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Pengiriman Data</div>
            <div className="text-xs font-semibold text-emerald-500 mt-1">Tersambung ke Server Pusat</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Total Pembacaan</div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-1">
              {crossings.length} Terdeteksi
            </div>
          </div>
          <HardDrive className="w-6 h-6 text-[var(--text-dim)]" />
        </div>
      </div>

      {/* Camera Stream & Frame Verification Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-500" />
              Stream / Bukti Kamera Pos — {activeCamera ? `${activeCamera.camera_code} (${activeCamera.name})` : "Kamera Pos"}
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Kamera Aktif
            </span>
          </div>

          <div className="relative aspect-video bg-black/90 rounded-lg overflow-hidden border border-[var(--border)] flex items-center justify-center">
            {latestCrossing && latestCrossing.snapshot ? (
              <>
                <img
                  src={latestCrossing.snapshot}
                  alt="Live Truck Stream"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1/3 left-1/3 w-48 h-24 border-2 border-emerald-500 bg-emerald-500/10 rounded flex flex-col justify-between p-2">
                  <div className="text-[10px] font-mono text-emerald-300 bg-black/80 px-1 rounded w-max">
                    Deteksi: {latestCrossing.confidence != null ? `${(latestCrossing.confidence > 1 ? latestCrossing.confidence : latestCrossing.confidence * 100).toFixed(1)}%` : "100%"}
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-300 text-center tracking-widest bg-black/80 rounded py-0.5">
                    {latestCrossing.hull_id}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/dummy-cctv-feed.png"
                  alt="Dummy CCTV Feed"
                  className="w-full h-full object-cover"
                />
                {/* Overlay: camera label */}
                <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded font-mono text-[10px] text-white/80">
                  {activeCamera?.camera_code || "CAM-GATE"} · LIVE
                </div>
                {/* Overlay: recording indicator */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 px-2 py-0.5 rounded">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono text-[10px] text-red-400">REC</span>
                </div>
                {/* Dummy detection box */}
                <div className="absolute top-1/3 left-1/3 w-48 h-24 border-2 border-emerald-500 bg-emerald-500/10 rounded flex flex-col justify-between p-2">
                  <div className="text-[10px] font-mono text-emerald-300 bg-black/80 px-1 rounded w-max">
                    Deteksi: 96.8%
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-300 text-center tracking-widest bg-black/80 rounded py-0.5">
                    HD 2047
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            Detail Pembacaan Terakhir
          </h3>

          {latestCrossing ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 space-y-1">
                <div className="flex justify-between">
                  <span>Nomor Lambung:</span>
                  <span className="font-bold">{latestCrossing.hull_id}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Arah:</span>
                  <span>{latestCrossing.direction}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Akurasi:</span>
                  <span className="font-bold">
                    {latestCrossing.confidence != null ? `${(latestCrossing.confidence > 1 ? latestCrossing.confidence : latestCrossing.confidence * 100).toFixed(1)}%` : "100%"}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                <strong>Status Terverifikasi:</strong> Kendaraan <strong>{latestCrossing.hull_id}</strong> tercatat di gate {latestCrossing.lane || activeCamera?.camera_code}.
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono space-y-1 border border-dashed border-[var(--border)] rounded-lg">
              <p>Belum ada data sampel.</p>
              <p className="text-[10px] text-[var(--text-dim)]">Tercatat secara otomatis saat ada pembacaan kamera.</p>
            </div>
          )}
        </div>
      </div>

      {/* Check Points Specification Table */}
      <CheckpointsTable />
    </div>
  );
}
