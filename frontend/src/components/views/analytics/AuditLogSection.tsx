import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { mockAuditLogs } from '../../../lib/api-client';

export function AuditLogSection() {
  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Histori Audit Koreksi Manual (Override Log)
          </h3>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded border font-bold text-amber-400 bg-amber-500/10 border-amber-500/30">
          {mockAuditLogs.length} Koreksi Hari Ini
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Rekam jejak audit saat hasil pembacaan AI di bawah 90% kepercayaan dan memerlukan intervensi manual oleh supervisor/auditor.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-[#1e293b] text-slate-500">
              <th className="pb-2 pr-3">ID Audit</th>
              <th className="pb-2 pr-3">Waktu</th>
              <th className="pb-2 pr-3">Gerbang</th>
              <th className="pb-2 pr-3">Deteksi Raw (AI)</th>
              <th className="pb-2 pr-3">Conf%</th>
              <th className="pb-2 pr-3">Dikoreksi Jadi</th>
              <th className="pb-2 pr-3">Auditor</th>
              <th className="pb-2">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {mockAuditLogs.map((log) => (
              <tr key={log.id} className="text-slate-300 hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 pr-3 text-amber-400 font-bold">{log.id}</td>
                <td className="py-2.5 pr-3 text-slate-400">{log.timestamp}</td>
                <td className="py-2.5 pr-3 text-slate-300">{log.gate}</td>
                <td className="py-2.5 pr-3 text-rose-400 font-bold">{log.rawOcr}</td>
                <td className="py-2.5 pr-3">
                  <span className="text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded text-[10px]">{log.rawConf}%</span>
                </td>
                <td className="py-2.5 pr-3 text-emerald-400 font-bold">{log.corrected}</td>
                <td className="py-2.5 pr-3 text-cyan-300">{log.auditor}</td>
                <td className="py-2.5 text-slate-400 text-[10px] max-w-[200px] truncate">{log.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
