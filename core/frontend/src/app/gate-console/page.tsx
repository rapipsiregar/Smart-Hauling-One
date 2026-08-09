"use client";

import React, { useState } from "react";
import { Camera, CheckCircle2, RefreshCw, Radio, HardDrive, Cpu, Activity } from "lucide-react";
import { CheckpointsTable } from "@/components/checkpoints/checkpoints-table";

export default function GateConsolePage() {
  const [selectedGate, setSelectedGate] = useState("CP 01 - KGB - IUP TIA");
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState([
    { id: "CRX-9942", timestamp: "16:42:15", oht_id: "DT-118", confidence: 99.4, direction: "INBOUND", cargo: "LOADED", status: "Synced" },
    { id: "CRX-9941", timestamp: "16:38:04", oht_id: "DT-204", confidence: 97.8, direction: "OUTBOUND", cargo: "EMPTY", status: "Synced" },
    { id: "CRX-9940", timestamp: "16:31:50", oht_id: "DT-089", confidence: 88.2, direction: "INBOUND", cargo: "LOADED", status: "Pending" },
  ]);


  const triggerDetection = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const newLog = {
        id: `CRX-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleTimeString(),
        oht_id: "DT-2152",
        confidence: 99.1,
        direction: "INBOUND",
        cargo: "LOADED",
        status: "Synced",
      };
      setSimulatedLogs([newLog, ...simulatedLogs]);
    }, 1000);
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
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-2 font-medium"
          >
            <option value="CP 01 - KGB - IUP TIA">CP 01 – Area Selatan (KGB - IUP TIA)</option>
            <option value="CP 02 - KGU CK - BIB">CP 02 – Area Utara (KGU CK - BIB)</option>
            <option value="CP 03 - PPA - BIB">CP 03 – Area Utara (PPA - BIB)</option>
            <option value="CP 04 - Exc WS CK – IUP TIA">CP 04 – Area Selatan (Exc WS CK – IUP TIA)</option>
          </select>

          <button
            onClick={triggerDetection}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
            {isProcessing ? "Memproses..." : "Uji Deteksi Manual"}
          </button>
        </div>
      </div>

      {/* 4 Status Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Kamera RTSP</div>
            <div className="text-xs font-semibold text-emerald-500 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live 30 FPS
            </div>
          </div>
          <Camera className="w-6 h-6 text-emerald-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Arah Gerbang</div>
            <div className="text-xs font-semibold text-amber-500 mt-1">INBOUND (Masuk Pit)</div>
          </div>
          <Activity className="w-6 h-6 text-amber-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Status Sync</div>
            <div className="text-xs font-semibold text-emerald-500 mt-1">Terkirim (HTTP 201)</div>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-500/80" />
        </div>

        <div className="glass-panel border border-[var(--border)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">Outbox Pending</div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-1">0 Pending</div>
          </div>
          <HardDrive className="w-6 h-6 text-[var(--text-dim)]" />
        </div>
      </div>

      {/* Camera Stream & Frame Voting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-500" />
              Stream Kamera Live — CAM 01 Entrance ({selectedGate})
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              192.168.1.104
            </span>
          </div>

          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[var(--border)] flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80"
              alt="Live Truck Stream"
              className="w-full h-full object-cover opacity-80"
            />

            <div className="absolute top-1/3 left-1/3 w-48 h-24 border-2 border-emerald-500 bg-emerald-500/10 rounded flex flex-col justify-between p-2 animate-pulse">
              <div className="text-[10px] font-mono text-emerald-300 bg-black/80 px-1 rounded w-max">
                SAM3 ROI: 99.4%
              </div>
              <div className="text-base font-mono font-bold text-emerald-300 text-center tracking-widest bg-black/80 rounded py-0.5">
                DT-118
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            Tingkat Akurasi Sampel Pembacaan Kamera
          </h3>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex justify-between">
              <span>Gambar Tangkapan #1 — DT-118</span>
              <span className="font-bold">99.4% Terbaca ✓</span>
            </div>
            <div className="p-2.5 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex justify-between">
              <span>Gambar Tangkapan #2 — DT-118</span>
              <span className="font-bold">98.2% Terbaca ✓</span>
            </div>
            <div className="p-2.5 rounded border bg-rose-500/10 border-rose-500/30 text-rose-400 flex justify-between opacity-60">
              <span>Gambar Tangkapan #3 — DT-110</span>
              <span className="font-bold">54.1% Buram ✗</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            <strong>Hasil Kesimpulan:</strong> Nomor lambung <strong>DT-118</strong> terverifikasi cocok 95% dari 18 tangkapan gambar.
          </div>
        </div>
      </div>

      {/* Check Points Specification Table */}
      <CheckpointsTable />
    </div>
  );
}
