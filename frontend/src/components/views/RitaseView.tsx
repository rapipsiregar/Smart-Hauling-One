import React, { useState } from 'react';
import {
  RotateCw, Mountain, Truck, AlertTriangle,
  ArrowDownLeft, ArrowUpRight, RefreshCw,
} from 'lucide-react';
import { DEMO_SHIFT_REPORT, DEMO_PIT_OCCUPANCY, formatCycleTime } from '../../lib/shift-report-data';
import { mockStagnantAlerts } from '../../lib/api-client';

function StatCard({ icon, value, label, unit, accent }: {
  icon: React.ReactNode; value: number | string; label: string; unit: string; accent: string;
}) {
  return (
    <div className="kpi-card-ishs p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-3xl font-bold font-mono ${accent}`}>{value}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">{unit}</p>
        </div>
        <span className={accent}>{icon}</span>
      </div>
      <p className="text-sm font-semibold text-[#0f172a]">{label}</p>
    </div>
  );
}

export const RitaseView: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const report = DEMO_SHIFT_REPORT;
  const pit = DEMO_PIT_OCCUPANCY;

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-amber-500" />
            Ritase & Posisi Armada
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Satu ritase = satu lintasan masuk dipasangkan dengan satu lintasan keluar. Data hari ini: {report.date}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e293b] text-xs font-semibold hover:border-amber-500 hover:text-amber-500 text-slate-400 transition-colors disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<RotateCw className="w-5 h-5" />}
          value={report.totalRitase}
          label="Ritase Selesai"
          unit="ritase"
          accent="text-amber-500"
        />
        <StatCard
          icon={<Mountain className="w-5 h-5" />}
          value={pit.insideCount}
          label="Truk Di Dalam Area"
          unit="unit"
          accent="text-emerald-400"
        />
        <StatCard
          icon={<Truck className="w-5 h-5" />}
          value={report.totalCrossings}
          label="Total Lintasan"
          unit="lintasan"
          accent="text-sky-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          value={report.unpairedCount}
          label="Lintasan Belum Berpasangan"
          unit="lintasan"
          accent={report.unpairedCount > 0 ? 'text-rose-400' : 'text-slate-500'}
        />
      </div>

      {/* Stagnant Alerts */}
      {mockStagnantAlerts.length > 0 && (
        <div className="space-y-2">
          {mockStagnantAlerts.map(a => (
            <div
              key={a.truckId}
              className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono ${
                a.status === 'CRITICAL'
                  ? 'bg-rose-950/40 border-rose-500/40'
                  : 'bg-amber-950/40 border-amber-500/40'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.status === 'CRITICAL' ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
              <div className="flex-1 text-slate-300">
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-300' : 'text-amber-300'}`}>
                  ⚠ Alert Stagnan: Unit {a.truckId}
                </span>
                {' — '}masuk {a.entryGate} pukul {a.entryTime} WITA, belum keluar selama{' '}
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {a.elapsedMinutes} menit
                </span>
                <span className="text-slate-500"> · {a.contractor}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                a.status === 'CRITICAL'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Two-column: Pit Status + Per Truck */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Pit Occupancy */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mountain className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Posisi Truk</h3>
            <span className="ml-auto text-[10px] font-mono text-slate-500">
              {pit.insideCount} di dalam · {pit.outsideCount} di luar
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left min-w-[320px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-[#1e293b]">
                  <th className="pb-2 pr-3">No. Lambung</th>
                  <th className="pb-2 pr-3">Masuk Lewat</th>
                  <th className="pb-2 pr-3">Waktu</th>
                  <th className="pb-2 text-right">Conf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {pit.inside.map(t => (
                  <tr key={t.hullId} className="text-slate-300 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-3 font-bold text-white">{t.hullId}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{t.lastGate ?? '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-400">{t.lastCrossedAt ?? '—'}</td>
                    <td className="py-2.5 text-right">
                      {t.confidence != null ? (
                        <span className={`font-bold ${t.confidence >= 0.9 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(t.confidence * 100).toFixed(1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per Truck Ritase */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <RotateCw className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">Ritase per Truk</h3>
            <span className="ml-auto text-[10px] font-mono text-slate-500">dipasangkan secara kronologis</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left min-w-[320px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-[#1e293b]">
                  <th className="pb-2 pr-3">No. Lambung</th>
                  <th className="pb-2 pr-3 text-right">Ritase</th>
                  <th className="pb-2 pr-3 text-right">IN</th>
                  <th className="pb-2 pr-3 text-right">OUT</th>
                  <th className="pb-2 text-right">Siklus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e293b]">
                {report.perTruck.filter(t => t.ritase > 0).map(t => (
                  <tr key={t.hullId} className="text-slate-300 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-3 font-bold text-white">
                      {t.hullId}
                      {!t.registered && (
                        <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">belum terdaftar</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-amber-400">{t.ritase}</td>
                    <td className="py-2.5 pr-3 text-right text-emerald-400">{t.inCount}</td>
                    <td className="py-2.5 pr-3 text-right text-sky-400">{t.outCount}</td>
                    <td className="py-2.5 text-right text-slate-400">{formatCycleTime(t.avgCycleSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gate Panel */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">Lintasan per Gerbang</h3>
          <span className="ml-auto text-[10px] font-mono text-slate-500">arah dari registri kamera</span>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {report.perGate.map(g => (
            <div key={g.gate} className="rounded-xl border border-[#1e293b] p-3 bg-[#060d1e]">
              <p className="text-xs font-bold text-white truncate mb-2">{g.gate}</p>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ArrowDownLeft className="w-3.5 h-3.5" /> masuk
                  <span className="ml-auto">{g.inbound}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400">
                  <ArrowUpRight className="w-3.5 h-3.5" /> keluar
                  <span className="ml-auto">{g.outbound}</span>
                </div>
                {g.undirected > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <AlertTriangle className="w-3 h-3" /> tanpa arah
                    <span className="ml-auto">{g.undirected}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
