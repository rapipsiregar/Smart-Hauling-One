import React from 'react';
import { Truck, Cpu } from 'lucide-react';
import { mockOEMBreakdown } from '../../../lib/api-client';

export function OEMBrandSection() {
  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Performa & Distribusi Merek Kendaraan (276 Unit Master)
          </h3>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded border font-bold text-amber-400 bg-amber-500/10 border-amber-500/30">
          276 Master Units
        </span>
      </div>

      <div>
        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Distribusi Merek (OEM)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {mockOEMBreakdown.map((o) => (
            <div key={o.brand} className="p-3.5 rounded-xl bg-[#060d1e] border border-[#1e293b] space-y-1">
              <div className="text-xs font-bold text-slate-300">{o.brand}</div>
              <div className="text-xs text-slate-400 font-mono">{o.model}</div>
              <div className="text-xl font-bold font-mono" style={{ color: o.color }}>{o.count} Unit</div>
              <div className="text-[10px]" style={{ color: o.color }}>Akurasi Deteksi: {o.avgConf}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
