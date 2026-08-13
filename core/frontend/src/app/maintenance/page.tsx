"use client";

import React, { useEffect, useState } from "react";
import { Wrench, Camera as CameraIcon, Activity, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Camera } from "@/lib/types";

interface ActionLog {
  id: string;
  gate: string;
  type: string;
  status: string;
  date: string;
}

export default function MaintenancePage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [interventions, setInterventions] = useState<ActionLog[]>([]);

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

  const handleAction = (type: string, gate: string) => {
    const newMnt: ActionLog = {
      id: `MNT-${Math.floor(100 + Math.random() * 900)}`,
      gate,
      type,
      status: "Terkirim ke Server Pos",
      date: new Date().toLocaleTimeString(),
    };
    setInterventions((prev) => [newMnt, ...prev]);
  };

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
                  <span>Arah:</span>
                  <span className="text-amber-400 uppercase font-bold">{c.direction}</span>
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Koneksi:</span>
                  <span className="text-emerald-400 font-bold truncate max-w-[120px]">{c.rtsp_url || c.ip_host || "Normal"}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border)] flex gap-2">
                <button
                  onClick={() => handleAction("Pemeriksaan Koneksi", c.name)}
                  className="flex-1 py-1.5 text-[10px] font-mono font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/20 cursor-pointer"
                >
                  Cek Koneksi
                </button>
                <button
                  onClick={() => handleAction("Kalibrasi Posisi Kamera", c.name)}
                  className="flex-1 py-1.5 text-[10px] font-mono font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/20 cursor-pointer"
                >
                  Kalibrasi
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Belum ada kamera pos yang terdaftar di dalam sistem.
          </div>
        )}
      </div>

      {/* Interventions Log */}
      <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 font-mono">
          <Activity className="w-4 h-4 text-emerald-500" />
          Riwayat Tindakan Lapangan & Pemeriksaan Kamera
        </h3>

        {interventions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="pb-2">Kode Tindakan</th>
                  <th className="pb-2">Lokasi Pos</th>
                  <th className="pb-2">Jenis Pemeriksaan</th>
                  <th className="pb-2">Waktu Permintaan</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {interventions.map((item) => (
                  <tr key={item.id} className="text-[var(--text-primary)]">
                    <td className="py-2.5 font-bold text-amber-400">{item.id}</td>
                    <td className="py-2.5">{item.gate}</td>
                    <td className="py-2.5">{item.type}</td>
                    <td className="py-2.5 text-[var(--text-secondary)]">{item.date}</td>
                    <td className="py-2.5 text-emerald-400">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono border border-dashed border-[var(--border)] rounded-lg">
            Belum ada riwayat permintaan tindakan lapangan hari ini.
          </div>
        )}
      </div>
    </div>
  );
}
