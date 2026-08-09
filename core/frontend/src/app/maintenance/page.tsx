"use client";

import React, { useState } from "react";
import { Wrench, Battery, Cpu, Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export default function MaintenancePage() {
  const [interventions, setInterventions] = useState([
    { id: "MNT-101", gate: "Gate 01", type: "Cuci Lensa Optik", status: "Selesai", date: "16:40:00" },
    { id: "MNT-102", gate: "Gate 02", type: "Redam Skid Hidrolik", status: "Dalam Proses", date: "16:41:30" },
  ]);

  const handleAction = (type: string, gate: string) => {
    const newMnt = {
      id: `MNT-${Math.floor(100 + Math.random() * 900)}`,
      gate,
      type,
      status: "Dikirim ke Field Node",
      date: new Date().toLocaleTimeString(),
    };
    setInterventions([newMnt, ...interventions]);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-4 border border-[var(--border)] rounded-xl">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-500" />
            Asset Maintenance & Prediksi Degradasi OLS
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Pemantauan telemetri kesehatan edge tower (Baterai LiFePO4, Kejernihan Lensa, Vibrasi Skid)
          </p>
        </div>

        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          4 Tower Online
        </span>
      </div>

      {/* Sensor Towers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { name: "Tower Gate 01", battery: "98%", soh: "96.4%", clarity: "94%", rms: "0.04g", status: "Optimal" },
          { name: "Tower Gate 02", battery: "92%", soh: "94.1%", clarity: "88%", rms: "0.08g", status: "Optimal" },
          { name: "Tower Gate 03", battery: "84%", soh: "89.2%", clarity: "76%", rms: "0.15g", status: "Perlu Dibersihkan" },
          { name: "Tower Gate 04", battery: "78%", soh: "87.0%", clarity: "81%", rms: "0.11g", status: "Optimal" },
        ].map((t) => (
          <div key={t.name} className="glass-panel border border-[var(--border)] p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[var(--text-primary)]">{t.name}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${t.status === 'Optimal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {t.status}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Baterai LiFePO4:</span>
                <span className="text-emerald-400 font-bold">{t.battery} (SOH {t.soh})</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Kejernihan Lensa:</span>
                <span className="text-amber-400 font-bold">{t.clarity}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Vibrasi RMS:</span>
                <span className="text-[var(--text-primary)]">{t.rms}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border)] flex gap-2">
              <button
                onClick={() => handleAction("Cuci Lensa Optik", t.name)}
                className="flex-1 py-1 text-[10px] font-mono bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded border border-amber-500/20"
              >
                Cuci Lensa
              </button>
              <button
                onClick={() => handleAction("Redam Skid Hidrolik", t.name)}
                className="flex-1 py-1 text-[10px] font-mono bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/20"
              >
                Redam Skid
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Interventions Log */}
      <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Riwayat Intervensi Lapangan
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                <th className="pb-2">ID Intervensi</th>
                <th className="pb-2">Lokasi Tower</th>
                <th className="pb-2">Jenis Tindakan</th>
                <th className="pb-2">Waktu Trigger</th>
                <th className="pb-2">Status Execution</th>
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
      </div>
    </div>
  );
}
