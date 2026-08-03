import React, { useState } from 'react';
import { MapPin, Truck, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';

export const MapView: React.FC = () => {
  const [selectedTruck, setSelectedTruck] = useState<string>('DT-118');

  const trucks = [
    { id: 'DT-118', model: 'CAT 777E', zone: 'Pit North Gate 01', status: 'ONLINE', accuracy: '99.4%', driver: 'Budi Santoso', time: '16:42:15 WITA' },
    { id: 'DT-204', model: 'Komatsu HD785', zone: 'Pit North Gate 02', status: 'ONLINE', accuracy: '97.8%', driver: 'Ahmad Rizal', time: '16:38:04 WITA' },
    { id: 'DT-089', model: 'CAT 777D', zone: 'Port Main Gate', status: 'ONLINE', accuracy: '88.2%', driver: 'Dedi Kurniawan', time: '16:31:50 WITA' },
    { id: 'DT-312', model: 'Volvo FMX 480', zone: 'Port Stockpile Roadway', status: 'ONLINE', accuracy: '98.9%', driver: 'Eko Prasetyo', time: '16:25:12 WITA' },
    { id: 'DT-105', model: 'CAT 777E', zone: 'Port Main Gate 02', status: 'ONLINE', accuracy: '99.1%', driver: 'Rudi Hartono', time: '16:19:44 WITA' },
  ];

  const currentDetail = trucks.find((t) => t.id === selectedTruck) || trucks[0];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide flex items-center gap-2">
              <MapPin className="w-5 h-5 text-orange-500" />
              Interactive Site Plan & Corridor Tracking
            </h2>
            <p className="text-xs text-slate-300 font-sans mt-0.5">
              Pelacakan armada real-time (Inside Yard vs Outside Roadway) & Sensor Status Gate 01 & Gate 02
            </p>
          </div>
          <span className="px-3 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold w-fit">
            GATE SENSORS ONLINE
          </span>
        </div>
      </div>

      {/* Main Grid: Corridor Map & Detail Telemetry (Clean White Cards in Light Mode) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Site Plan Corridor Map Container (Clean White Card) */}
        <div className="lg:col-span-2 kpi-card-ishs p-6 border-b-4 border-orange-500 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zone Alpha: Pit North */}
            <div className="p-5 rounded-xl bg-slate-50 border-2 border-dashed border-cyan-400/40 space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-cyan-100 text-cyan-800 font-extrabold border border-cyan-300">
                  INSIDE YARD (PIT NORTH)
                </span>
                <span className="text-slate-500 font-bold">18 Armada</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {trucks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTruck(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTruck === t.id
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-md ring-2 ring-cyan-400'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Truck className={`w-4 h-4 ${selectedTruck === t.id ? 'text-white' : 'text-cyan-600'}`} />
                      <span className="font-bold text-xs font-mono">{t.id}</span>
                    </div>
                    <div className={`text-[10px] font-mono mt-1 ${selectedTruck === t.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {t.model}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-mono text-slate-400 text-center">Zone Alpha — Active Loading</div>
            </div>

            {/* Zone Bravo: Port Roadway */}
            <div className="p-5 rounded-xl bg-slate-50 border-2 border-dashed border-emerald-400/40 space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                  PORT STOCKPILE ROADWAY
                </span>
                <span className="text-slate-500 font-bold">16 Armada</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {trucks.slice(3, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTruck(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedTruck === t.id
                        ? 'bg-cyan-600 text-white border-cyan-500 shadow-md ring-2 ring-cyan-400'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Truck className={`w-4 h-4 ${selectedTruck === t.id ? 'text-white' : 'text-cyan-600'}`} />
                      <span className="font-bold text-xs font-mono">{t.id}</span>
                    </div>
                    <div className={`text-[10px] font-mono mt-1 ${selectedTruck === t.id ? 'text-cyan-100' : 'text-slate-500'}`}>
                      {t.model}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-mono text-slate-400 text-center">Zone Bravo — Unloading Way</div>
            </div>
          </div>
        </div>

        {/* Detail Telemetry Panel (Clean White Card) */}
        <div className="kpi-card-ishs p-6 border-b-4 border-cyan-500 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              Detail Lokasi & Telemetri
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-cyan-700 font-mono">{currentDetail.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono">PT Tunas Inti Abadi — {currentDetail.model}</p>
            </div>

            <div className="space-y-3 text-xs font-mono pt-2 border-t border-slate-100">
              <div className="flex justify-between text-slate-600">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Lintasan Terakhir:</span>
                <span className="font-bold text-[#0f172a]">{currentDetail.time}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Lokasi Saat Ini:</span>
                <span className="font-bold text-cyan-700">{currentDetail.zone}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Status Data:</span>
                <span className="font-bold text-emerald-600">Valid & Terkunci</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pengemudi:</span>
                <span className="font-bold text-[#0f172a]">{currentDetail.driver}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Validated by Gate 01 Sensors
          </div>
        </div>
      </div>
    </div>
  );
};
