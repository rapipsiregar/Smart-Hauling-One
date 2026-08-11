"use client";

import React, { useState } from "react";
import { ShieldAlert, UserCheck, CheckCircle, Clock } from "lucide-react";

export function AuditOverrideLogWidget() {
  const [logs] = useState([
    {
      id: "OVR-801",
      timestamp: "16:31:50",
      gate: "CP 01 (KGB - IUP TIA)",
      aiRaw: "DT-089 (Conf: 54.1%)",
      correctedHull: "DT-089",
      auditor: "Siti Rahma (Auditor)",
      reason: "Lensa Terhalang Debu Tebal (Di-override Sesuai Log Fisik)",
      status: "Approved",
    },
    {
      id: "OVR-802",
      timestamp: "15:12:04",
      gate: "CP 02 (KGU CK - BIB)",
      aiRaw: "HD-215Z (Conf: 68.2%)",
      correctedHull: "HD-2152",
      auditor: "Budi Santoso (Supervisor)",
      reason: "Koreksi Optik Karakter Z menjadi Angka 2 (Master Match)",
      status: "Approved",
    },
    {
      id: "OVR-803",
      timestamp: "14:05:22",
      gate: "CP 03 (PPA - BIB)",
      aiRaw: "DT-10I (Conf: 61.0%)",
      correctedHull: "DT-105",
      auditor: "Siti Rahma (Auditor)",
      reason: "Koreksi Huruf I menjadi Angka 5 (Ambiguity Resolved)",
      status: "Approved",
    },
  ]);

  return (
    <div className="glass-panel border border-[var(--border)] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Histori Audit Koreksi Manual (Manual Override Audit Log)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Rekam jejak audit saat hasil pembacaan AI di bawah 90% dan memerlukan intervensi manual pengguna
          </p>
        </div>
        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
          3 Log Audit Hari Ini
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="pb-2">ID Audit</th>
              <th className="pb-2">Waktu</th>
              <th className="pb-2">Gerbang</th>
              <th className="pb-2">Hasil Raw AI</th>
              <th className="pb-2">Hasil Koreksi</th>
              <th className="pb-2">Auditor Pengubah</th>
              <th className="pb-2">Alasan Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="py-2.5 text-amber-400 font-bold">{log.id}</td>
                <td className="py-2.5 text-[var(--text-secondary)]">{log.timestamp}</td>
                <td className="py-2.5">{log.gate}</td>
                <td className="py-2.5 text-rose-400">{log.aiRaw}</td>
                <td className="py-2.5 text-emerald-400 font-bold">{log.correctedHull}</td>
                <td className="py-2.5 text-amber-300">{log.auditor}</td>
                <td className="py-2.5 text-[var(--text-secondary)] truncate max-w-xs">{log.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
