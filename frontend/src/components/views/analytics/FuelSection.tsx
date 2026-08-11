import React from 'react';
import { Fuel, Leaf, Flame, AlertTriangle } from 'lucide-react';
import { mockFuelAnalytics } from '../../../lib/api-client';

function SectionHeader({ icon, title, badge, badgeColor = 'amber' }: {
  icon: React.ReactNode; title: string; badge?: string; badgeColor?: string;
}) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-amber-400">{icon}</span>
        <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">{title}</h3>
      </div>
      {badge && (
        <span className={`text-xs font-mono px-2.5 py-1 rounded border font-bold ${colorMap[badgeColor]}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function FuelSection() {
  const f = mockFuelAnalytics;
  const avgLitersPerTrip = 14.5;
  const isTargetMet = avgLitersPerTrip <= 18.0;

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
      <SectionHeader
        icon={<Fuel className="w-4 h-4" />}
        title="Estimasi Konsumsi Solar & Indikator Green Mining"
        badge={isTargetMet ? '✓ Efisien' : '⚠ Di Bawah Target'}
        badgeColor={isTargetMet ? 'emerald' : 'rose'}
      />
      <p className="text-xs text-slate-400 mb-4">
        Kalkulasi berbasis <strong className="text-slate-200">428 ritase</strong> (durasi trip ~45 menit) ×
        konsumsi rata-rata unit (~70 L/jam). Data per-shift (Pagi + Malam).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="p-3.5 rounded-xl bg-[#060d1e] border border-[#1e293b] space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Total Konsumsi Solar
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{f.totalLiters.toLocaleString('id-ID')} L</div>
          <div className="text-[10px] text-slate-500 font-mono">TIA: {f.tiaLiters.toLocaleString('id-ID')} L · BIC: {f.bicLiters.toLocaleString('id-ID')} L</div>
        </div>
        <div className="p-3.5 rounded-xl bg-[#060d1e] border border-[#1e293b] space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Rata-rata Konsumsi per Trip
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {avgLitersPerTrip} L/Trip
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Target SLA: &lt; 18.0 L/Trip</div>
        </div>
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/20 space-y-1">
          <div className="text-xs text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> BBM Terbuang (Idling)
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{f.idlingWasteLiters} L</div>
          <div className="text-[10px] text-rose-400/70 font-mono">{f.idlingWastePct}% dari total – antrean gerbang</div>
        </div>
      </div>

      {/* Contractor fuel split bar */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Distribusi Konsumsi per Kontraktor</div>
        <div className="flex rounded-lg overflow-hidden h-4">
          <div
            className="h-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black"
            style={{ width: `${(f.tiaLiters / f.totalLiters * 100).toFixed(1)}%` }}
          >TIA {(f.tiaLiters / f.totalLiters * 100).toFixed(0)}%</div>
          <div
            className="h-full bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-black"
            style={{ width: `${(f.bicLiters / f.totalLiters * 100).toFixed(1)}%` }}
          >BIC {(f.bicLiters / f.totalLiters * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}
