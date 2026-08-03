import React from 'react';
import { mockTowers } from '../../lib/api-client';
import { Radio, Battery, Sun, Wifi } from 'lucide-react';

export const TelemetryView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white space-y-3">
        <div className="flex items-center space-x-2">
          <Radio className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
            Solar Skidding Towers Telemetry
          </h2>
        </div>
        <p className="text-xs text-slate-300 font-sans">
          Monitoring IoT telemetry real-time daya solar panel, status SOC baterai, & kekuatan sinyal UHF mesh di area pertambangan
        </p>
      </div>

      {/* Grid Cards (Clean White Surface in Light Mode) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {mockTowers.map((tower) => (
          <div key={tower.tower_id} className="kpi-card-ishs p-5 space-y-4 border-b-4 border-emerald-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#0f172a] font-mono">{tower.name}</h3>
                <p className="text-xs text-slate-500 font-mono">{tower.location}</p>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ● ONLINE
              </span>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100 text-xs font-mono">
              {/* Battery SOC */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 flex items-center gap-1">
                    <Battery className="w-3.5 h-3.5 text-emerald-600" /> Baterai LiFePO4
                  </span>
                  <span className="font-bold text-[#0f172a]">{tower.battery_soc}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div style={{ width: `${tower.battery_soc}%` }} className="h-full bg-emerald-500 rounded-full" />
                </div>
              </div>

              {/* Solar Input Voltage */}
              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-1 text-slate-600">
                  <Sun className="w-3.5 h-3.5 text-amber-500" /> Status Panel Surya
                </span>
                <span className="font-bold text-emerald-600">
                  {tower.pv_voltage > 12 ? 'Mengisi Daya (Normal)' : 'Siaga'}
                </span>
              </div>

              {/* Signal UHF */}
              <div className="flex justify-between items-center text-slate-700">
                <span className="flex items-center gap-1 text-slate-600">
                  <Wifi className="w-3.5 h-3.5 text-blue-500" /> Kekuatan Sinyal
                </span>
                <span className="font-bold text-emerald-700">
                  {tower.signal_dbm >= -70 ? 'Sangat Baik' : 'Cukup Baik'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
