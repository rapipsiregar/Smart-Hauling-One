import React from 'react';
import { Building2, TrendingUp, Truck, RotateCw, Timer, Target, ShieldCheck } from 'lucide-react';
import { mockContractorData, ContractorEfficiency } from '../../lib/api-client';

function StatCell({ label, value, unit, color = 'text-white' }: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      {unit && <div className="text-[9px] text-slate-500 font-mono">{unit}</div>}
      <div className="text-[10px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

function ContractorCard({ c }: { c: ContractorEfficiency }) {
  const isActive = c.totalRitase > 0;
  const utilizationPct = Math.round((c.activeTrucks / c.totalTrucks) * 100);

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-black"
            style={{ backgroundColor: c.color }}
          >
            {c.shortName}
          </div>
          <div>
            <div className="text-sm font-bold text-white">{c.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{c.totalTrucks} unit master · {c.activeTrucks} aktif hari ini</div>
          </div>
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 rounded border font-bold ${
          isActive
            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
            : 'text-slate-500 bg-slate-800 border-slate-600'
        }`}>
          {isActive ? '● AKTIF' : '○ STANDBY'}
        </span>
      </div>

      {/* Utilization Bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
          <span>Utilisasi Armada</span>
          <span style={{ color: c.color }}>{utilizationPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${utilizationPct}%`, backgroundColor: c.color }}
          />
        </div>
      </div>

      {/* KPI Grid */}
      {isActive ? (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#1e293b]">
          <StatCell label="Ritase" value={c.totalRitase} unit="trip" color="text-amber-400" />
          <StatCell label="Cycle Time" value={c.avgCycleMin} unit="menit" color="text-cyan-400" />
          <StatCell label="Akurasi Deteksi" value={`${c.avgConf}%`} color="text-emerald-400" />
          <StatCell label="SLA Comply" value={`${c.slaCompliance}%`} color={c.slaCompliance >= 95 ? 'text-emerald-400' : 'text-rose-400'} />
        </div>
      ) : (
        <div className="pt-2 border-t border-[#1e293b] text-center text-xs text-slate-500 font-mono py-3">
          Tidak ada data ritase aktif hari ini
        </div>
      )}
    </div>
  );
}

export const ContractorView: React.FC = () => {
  const totalRitase = mockContractorData.reduce((s, c) => s + c.totalRitase, 0);
  const totalActive = mockContractorData.reduce((s, c) => s + c.activeTrucks, 0);
  const totalMaster = mockContractorData.reduce((s, c) => s + c.totalTrucks, 0);
  const avgSla = (mockContractorData.filter(c => c.slaCompliance > 0).reduce((s, c) => s + c.slaCompliance, 0) /
    mockContractorData.filter(c => c.slaCompliance > 0).length).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Efisiensi & Kinerja Kontraktor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Perbandingan performa 4 kontraktor hauling: TIA · BIC · PPA · CK — total 276 unit armada
            </p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: RotateCw, label: 'Total Ritase', value: totalRitase, unit: 'trip', color: 'text-amber-400' },
            { icon: Truck,    label: 'Truk Aktif',   value: totalActive, unit: 'unit', color: 'text-emerald-400' },
            { icon: Timer,    label: 'Fleet Master',  value: totalMaster, unit: 'unit', color: 'text-cyan-400' },
            { icon: ShieldCheck, label: 'Avg SLA',   value: `${avgSla}%`, unit: 'comply', color: 'text-indigo-400' },
          ].map(({ icon: Icon, label, value, unit, color }) => (
            <div key={label} className="bg-[#060d1e] border border-[#1e293b] rounded-xl p-3.5 flex items-center gap-3">
              <Icon className={`w-5 h-5 flex-shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-[10px] text-slate-500">{unit} · {label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {mockContractorData.map(c => <ContractorCard key={c.shortName} c={c} />)}
      </div>

      {/* Comparative bar chart (manual) */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Perbandingan Ritase & Utilitas Kontraktor Aktif
          </h3>
        </div>
        <div className="space-y-4">
          {mockContractorData.filter(c => c.totalRitase > 0).map(c => {
            const maxRitase = Math.max(...mockContractorData.map(x => x.totalRitase));
            return (
              <div key={c.shortName}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300">{c.name}</span>
                  <span className="font-mono font-bold" style={{ color: c.color }}>{c.totalRitase} ritase</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(c.totalRitase / maxRitase * 100).toFixed(1)}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
