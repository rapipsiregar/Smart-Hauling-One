import React, { useState } from 'react';
import { Fuel, Truck, ShieldAlert, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import { FuelSection } from './analytics/FuelSection';
import { OEMBrandSection } from './analytics/OEMBrandSection';
import { AuditLogSection } from './analytics/AuditLogSection';
import { PeakHourSection } from './analytics/PeakHourSection';

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
              Modul Analitik Terintegrasi: Konsumsi Solar & Emisi · Performa Merek Armada · Log Audit Koreksi · Heatmap Jam Puncak
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
      {(activeSection === 'all' || activeSection === 'fleet') && <OEMBrandSection />}
      {(activeSection === 'all' || activeSection === 'audit') && <AuditLogSection />}
      {(activeSection === 'all' || activeSection === 'peak')  && <PeakHourSection />}
    </div>
  );
};
