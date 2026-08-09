import React, { useState } from 'react';
import {
  Fuel, Leaf, Flame, Truck, Calendar, Cpu,
  ShieldAlert, Clock, AlertTriangle, Activity, CheckCircle2,
  TrendingUp, BarChart3,
} from 'lucide-react';
import {
  mockFuelAnalytics, mockFleetAgeBuckets, mockOEMBreakdown,
  mockAuditLogs, mockPeakHours, mockStagnantAlerts,
} from '../../lib/api-client';

// ─── Sub-component: Section Header ───────────────────────────────────────────
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

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ─── 1. Fuel Analytics Section ────────────────────────────────────────────────
function FuelSection() {
  const f = mockFuelAnalytics;
  const efficiency = f.tonPerLiter >= f.targetTonPerLiter;
  return (
    <Card>
      <SectionHeader
        icon={<Fuel className="w-4 h-4" />}
        title="Estimasi Konsumsi Solar & Indikator Green Mining"
        badge={efficiency ? '✓ Efisien' : '⚠ Di Bawah Target'}
        badgeColor={efficiency ? 'emerald' : 'rose'}
      />
      <p className="text-xs text-slate-400 mb-4">
        Kalkulasi berbasis <strong className="text-slate-200">428 ritase</strong> (durasi trip ~45 menit) ×
        konsumsi rata-rata <strong className="text-slate-200">CAT 777E (~70 L/jam)</strong>. Data per-shift (Pagi + Malam).
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
            <Leaf className="w-3.5 h-3.5 text-emerald-400" /> Rasio Efisiensi Ton/Liter
          </div>
          <div className={`text-2xl font-bold font-mono ${efficiency ? 'text-emerald-400' : 'text-rose-400'}`}>
            {f.tonPerLiter.toFixed(2)} Ton/L
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Target SLA: &gt; {f.targetTonPerLiter} Ton/L</div>
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
    </Card>
  );
}

// ─── 2. Fleet Age & OEM Breakdown ─────────────────────────────────────────────
function FleetAgeSection() {
  return (
    <Card>
      <SectionHeader
        icon={<Truck className="w-4 h-4" />}
        title="Distribusi Usia Armada & Performa OEM Brand (276 Unit Master)"
        badge="276 Master Units"
        badgeColor="amber"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Age breakdown */}
        <div>
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Calendar className="w-3.5 h-3.5 text-amber-400" /> Kategori Usia Armada
          </div>
          <div className="space-y-3">
            {mockFleetAgeBuckets.map((b, i) => {
              const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
              const textColors = ['text-emerald-400', 'text-amber-400', 'text-rose-400'];
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className={textColors[i]}>{b.label}</span>
                    <span className="text-slate-300 font-mono font-bold">{b.count} Unit ({b.pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full ${colors[i]} rounded-full transition-all duration-700`} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* OEM breakdown */}
        <div>
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Distribusi Merek (OEM)
          </div>
          <div className="grid grid-cols-2 gap-2">
            {mockOEMBreakdown.map((o) => (
              <div key={o.brand} className="p-3 rounded-xl bg-[#060d1e] border border-[#1e293b] space-y-1">
                <div className="text-[10px] text-slate-400">{o.model}</div>
                <div className="text-base font-bold font-mono" style={{ color: o.color }}>{o.count} Unit</div>
                <div className="text-[10px]" style={{ color: o.color }}>Avg Conf: {o.avgConf}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── 3. Audit Override Log ────────────────────────────────────────────────────
function AuditLogSection() {
  return (
    <Card>
      <SectionHeader
        icon={<ShieldAlert className="w-4 h-4" />}
        title="Histori Audit Koreksi Manual OCR (Override Log)"
        badge={`${mockAuditLogs.length} Koreksi Hari Ini`}
        badgeColor="amber"
      />
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
              <th className="pb-2 pr-3">Raw OCR (AI)</th>
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
    </Card>
  );
}

// ─── 4. Peak Hour Heatmap + Stagnant Alerts ────────────────────────────────────
function PeakHourSection() {
  const maxCount = Math.max(...mockPeakHours.flatMap(h => [h.gateA, h.gateB, h.gateC, h.gateD]));
  const gates = ['gateA', 'gateB', 'gateC', 'gateD'] as const;
  const gateLabels = ['Gate A (Pit N)', 'Gate B (Port)', 'Gate C (S.Pit01)', 'Gate D (S.Pit02)'];

  function heatColor(val: number): string {
    const ratio = val / maxCount;
    if (ratio > 0.8) return 'bg-rose-500';
    if (ratio > 0.6) return 'bg-orange-500';
    if (ratio > 0.4) return 'bg-amber-500';
    if (ratio > 0.2) return 'bg-yellow-600';
    return 'bg-slate-700';
  }

  return (
    <Card>
      <SectionHeader
        icon={<Clock className="w-4 h-4" />}
        title="Heatmap Jam Puncak Kemacetan Gerbang & Stagnant Alert"
        badge={`${mockStagnantAlerts.length} Stagnant Alert`}
        badgeColor="rose"
      />

      {/* Stagnant Alerts */}
      {mockStagnantAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {mockStagnantAlerts.map((a) => (
            <div
              key={a.truckId}
              className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono ${
                a.status === 'CRITICAL'
                  ? 'bg-rose-950/40 border-rose-500/40'
                  : 'bg-amber-950/40 border-amber-500/40'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.status === 'CRITICAL' ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
              <div className="flex-1">
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-300' : 'text-amber-300'}`}>
                  Unit {a.truckId}
                </span>{' '}
                <span className="text-slate-400">
                  masuk {a.entryGate} pukul {a.entryTime} WITA — belum keluar selama{' '}
                </span>
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {a.elapsedMinutes} menit
                </span>
                <span className="text-slate-500"> · {a.contractor}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                a.status === 'CRITICAL'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Gate labels */}
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(14, 1fr)' }}>
            <div />
            {mockPeakHours.map(h => (
              <div key={h.hour} className="text-[9px] text-slate-500 text-center font-mono">{h.hour.replace(':00', '')}</div>
            ))}
          </div>

          {gates.map((gate, gi) => (
            <div key={gate} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(14, 1fr)' }}>
              <div className="text-[9px] text-slate-400 font-mono flex items-center">{gateLabels[gi]}</div>
              {mockPeakHours.map(h => (
                <div
                  key={h.hour}
                  className={`h-6 rounded-sm flex items-center justify-center text-[8px] font-bold text-white/80 ${heatColor(h[gate])}`}
                  title={`${h.hour} — ${gateLabels[gi]}: ${h[gate]} truk`}
                >
                  {h[gate]}
                </div>
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-2 mt-3 text-[9px] font-mono text-slate-500">
            <span>Rendah</span>
            <div className="flex gap-0.5">
              {['bg-slate-700', 'bg-yellow-600', 'bg-amber-500', 'bg-orange-500', 'bg-rose-500'].map(c => (
                <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
              ))}
            </div>
            <span>Tinggi</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main AnalyticsView ───────────────────────────────────────────────────────
export const AnalyticsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'all' | 'fuel' | 'fleet' | 'audit' | 'peak'>('all');

  const tabs = [
    { id: 'all',   label: 'Semua',          icon: BarChart3 },
    { id: 'fuel',  label: 'Solar & Emisi',  icon: Fuel },
    { id: 'fleet', label: 'Armada & OEM',   icon: Truck },
    { id: 'audit', label: 'Audit Log',      icon: ShieldAlert },
    { id: 'peak',  label: 'Jam Puncak',     icon: Clock },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Advanced Analytics Dashboard
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              4 Modul Analytics Baru: Fuel & Green Mining · Fleet Age & OEM · OCR Audit Log · Peak Hour Heatmap
            </p>
          </div>
        </div>

        {/* Tab Filter */}
        <div className="flex flex-wrap gap-2 mt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSection === id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-[#060d1e] border border-[#1e293b] text-slate-400 hover:text-white hover:border-indigo-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {(activeSection === 'all' || activeSection === 'fuel')  && <FuelSection />}
      {(activeSection === 'all' || activeSection === 'fleet') && <FleetAgeSection />}
      {(activeSection === 'all' || activeSection === 'audit') && <AuditLogSection />}
      {(activeSection === 'all' || activeSection === 'peak')  && <PeakHourSection />}
    </div>
  );
};
