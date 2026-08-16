"use client";

import React, { useEffect, useState } from "react";
import { Wrench, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";

export default function MaintenancePage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const list = await api.getCameras().catch(() => []);
      setCameras(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-4 border border-[var(--border)] rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            Kesehatan Peralatan & Kamera Pos Gerbang
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Pemantauan status koneksi jaringan, resolusi, dan kesehatan kamera pos dari server
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-[var(--bg-elevated)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-xs px-4 py-2 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {/* Sensor Towers Grid (Real Cameras) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cameras.length > 0 ? (
          cameras.map((c) => (
            <div key={c.camera_code} className="glass-panel border border-[var(--border)] p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {c.camera_code} ({c.name})
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ml-1 uppercase font-bold ${
                  c.status === "online"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : c.status === "maintenance"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}>
                  {c.status}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Lokasi:</span>
                  <span className="text-[var(--text-primary)]">{c.gate_location || "POS"}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Koneksi:</span>
                  <span className="text-emerald-400 font-bold truncate max-w-[120px]">{c.rtsp_url || c.ip_host || "Normal"}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Belum ada kamera pos yang terdaftar di dalam sistem.
          </div>
        )}
      </div>
    </div>
  );
}
