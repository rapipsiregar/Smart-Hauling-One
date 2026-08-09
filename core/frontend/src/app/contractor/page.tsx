"use client";

import React from "react";
import { Building2, RotateCw, Truck, Timer, ShieldCheck, TrendingUp } from "lucide-react";

interface ContractorData {
  name: string;
  shortName: string;
  totalTrucks: number;
  activeTrucks: number;
  totalRitase: number;
  avgCycleMin: number;
  avgConf: number;
  slaCompliance: number;
  color: string;
}

const CONTRACTORS: ContractorData[] = [
  { name: "PT Tunas Inti Abadi",        shortName: "TIA", totalTrucks: 148, activeTrucks: 34, totalRitase: 248, avgCycleMin: 42, avgConf: 98.4, slaCompliance: 97.2, color: "#f59e0b" },
  { name: "PT Borneo Indah Cemerlang",  shortName: "BIC", totalTrucks: 96,  activeTrucks: 22, totalRitase: 180, avgCycleMin: 45, avgConf: 96.8, slaCompliance: 94.5, color: "#10b981" },
  { name: "PT Padang Pariaman Abadi",   shortName: "PPA", totalTrucks: 20,  activeTrucks: 6,  totalRitase: 0,   avgCycleMin: 0,  avgConf: 0,    slaCompliance: 0,    color: "#6366f1" },
  { name: "CV Karya Kencana",           shortName: "CK",  totalTrucks: 12,  activeTrucks: 4,  totalRitase: 0,   avgCycleMin: 0,  avgConf: 0,    slaCompliance: 0,    color: "#64748b" },
];

function ContractorCard({ c }: { c: ContractorData }) {
  const isActive = c.totalRitase > 0;
  const utilizationPct = Math.round((c.activeTrucks / c.totalTrucks) * 100);

  return (
    <div className="glass-panel border border-[var(--border)] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-black shrink-0"
            style={{ backgroundColor: c.color }}
          >
            {c.shortName}
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">{c.name}</div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono">
              {c.totalTrucks} unit master · {c.activeTrucks} aktif hari ini
            </div>
          </div>
        </div>
        <span className={`text-[10px] font-mono px-2 py-1 rounded border font-bold ${
          isActive
            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
            : "text-[var(--text-dim)] bg-[var(--bg-elevated)] border-[var(--border)]"
        }`}>
          {isActive ? "● AKTIF" : "○ STANDBY"}
        </span>
      </div>

      {/* Utilization Bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono text-[var(--text-secondary)] mb-1.5">
          <span>Utilisasi Armada</span>
          <span style={{ color: c.color }}>{utilizationPct}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${utilizationPct}%`, backgroundColor: c.color }}
          />
        </div>
      </div>

      {/* KPI Grid */}
      {isActive ? (
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[var(--border)]">
          {[
            { label: "Ritase",      value: c.totalRitase,          unit: "trip",  color: "#f59e0b" },
            { label: "Cycle Time",  value: `${c.avgCycleMin} mnt`, unit: "",      color: "#22d3ee" },
            { label: "OCR Akurasi", value: `${c.avgConf}%`,        unit: "",      color: "#10b981" },
            { label: "SLA Comply",  value: `${c.slaCompliance}%`,  unit: "",      color: c.slaCompliance >= 95 ? "#10b981" : "#f87171" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
              <div className="text-[9px] text-[var(--text-dim)] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-2 border-t border-[var(--border)] text-center text-xs text-[var(--text-dim)] font-mono py-3">
          Tidak ada data ritase aktif hari ini
        </div>
      )}
    </div>
  );
}

export default function ContractorPage() {
  const totalRitase = CONTRACTORS.reduce((s, c) => s + c.totalRitase, 0);
  const totalActive = CONTRACTORS.reduce((s, c) => s + c.activeTrucks, 0);
  const totalMaster = CONTRACTORS.reduce((s, c) => s + c.totalTrucks, 0);
  const activeSla = CONTRACTORS.filter(c => c.slaCompliance > 0);
  const avgSla = activeSla.length
    ? (activeSla.reduce((s, c) => s + c.slaCompliance, 0) / activeSla.length).toFixed(1)
    : "—";

  const maxRitase = Math.max(...CONTRACTORS.map(c => c.totalRitase));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center shadow-lg shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-mono uppercase tracking-wide">
              Efisiensi & Kinerja Kontraktor
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              4 kontraktor hauling: TIA · BIC · PPA · CK — total 276 unit armada
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: RotateCw,    label: "Total Ritase", value: totalRitase, unit: "trip",  color: "text-amber-400" },
            { icon: Truck,       label: "Truk Aktif",   value: totalActive, unit: "unit",  color: "text-emerald-400" },
            { icon: Timer,       label: "Fleet Master", value: totalMaster, unit: "unit",  color: "text-cyan-400" },
            { icon: ShieldCheck, label: "Avg SLA",      value: `${avgSla}%`, unit: "",    color: "text-indigo-400" },
          ].map(({ icon: Icon, label, value, unit, color }) => (
            <div key={label} className="glass-panel border border-[var(--border)] rounded-xl p-3.5 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-[10px] text-[var(--text-dim)]">{unit} · {label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contractor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CONTRACTORS.map(c => <ContractorCard key={c.shortName} c={c} />)}
      </div>

      {/* Ritase Comparison Bar */}
      <div className="glass-panel border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono uppercase tracking-wider">
            Perbandingan Ritase Kontraktor Aktif
          </h3>
        </div>
        <div className="space-y-4">
          {CONTRACTORS.filter(c => c.totalRitase > 0).map(c => (
            <div key={c.shortName}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[var(--text-primary)]">{c.name}</span>
                <span className="font-mono font-bold" style={{ color: c.color }}>{c.totalRitase} ritase</span>
              </div>
              <div className="w-full h-3 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(c.totalRitase / maxRitase * 100).toFixed(1)}%`, backgroundColor: c.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
