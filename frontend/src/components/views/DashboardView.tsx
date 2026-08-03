import React, { useState } from 'react';
import { KPISummary, CrossingLog, NavigationTab } from '../../lib/types';
import { KPISummaries } from './dashboard/KPISummaries';
import { Modal } from '../common/Modal';
import { Clock, ShieldCheck, Info, Radio, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DashboardViewProps {
  kpi: KPISummary;
  crossings: CrossingLog[];
  cycleTimes?: any[];
  onNavigate?: (tab: NavigationTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpi,
  crossings,
  onNavigate,
}) => {
  const [selectedCrop, setSelectedCrop] = useState<CrossingLog | null>(null);

  return (
    <div className="space-y-6">
      {/* Mining Operations Hub Banner */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white space-y-2">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-md">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide flex items-center gap-2">
              Mining Operations Hub <span className="text-[10px] px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-bold">● REAL-TIME DISPATCH</span>
            </h2>
            <p className="text-xs text-slate-300 font-sans mt-0.5">
              Monitoring PT Tunas Inti Abadi & PT Borneo Indah Cemerlang Haulage Corridor
            </p>
          </div>
        </div>
      </div>

      {/* Interactive 2 KPI Cards (Total Ritase & Truk Aktif) */}
      <KPISummaries
        kpi={kpi}
        onNavigate={onNavigate}
      />

      {/* Main Grid: 24h Cycle Time Analytics & Live Crossing Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 24h Hauling Cycle Time Analytics Chart */}
        <div className="lg:col-span-2 kpi-card-ishs p-6 space-y-4 flex flex-col justify-between border border-slate-200">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-wider font-mono flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-600" />
                  24h Hauling Cycle Time Analytics
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Rata-rata waktu siklus pengangkutan (Pit to Port) & Batas Toleransi
                </p>
              </div>

              <div className="flex items-center space-x-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-700 font-bold">
                  <span className="w-3 h-0.5 bg-cyan-500 inline-block" /> Aktual
                </span>
                <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Target SLA (45m)
                </span>
              </div>
            </div>

            {/* Cycle Time Chart Graphic Simulation */}
            <div className="h-56 relative bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-1/2 left-0 right-0 border-b-2 border-dashed border-amber-500/70 z-10 flex justify-end pr-4">
                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                  SLA Target 45m
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 top-8 opacity-20 bg-gradient-to-t from-cyan-500 to-transparent pointer-events-none" />

              <svg className="w-full h-full overflow-visible z-0" viewBox="0 0 500 150">
                <path
                  d="M 0 100 Q 125 80 250 30 T 500 90"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="3"
                />
              </svg>

              <div className="flex justify-between text-[10px] font-mono text-slate-500 z-20 pt-2 border-t border-slate-200">
                <span>06:00</span>
                <span>08:00</span>
                <span>10:00</span>
                <span>12:00</span>
                <span>14:00</span>
                <span>16:00</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono flex items-center gap-2 font-medium">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Spike di jam 12:00 disebabkan oleh pergantian shift driver (*shift handover*). SLA kembali normal setelah pukul 14:00.</span>
          </div>
        </div>

        {/* Right Column: Live Crossing Feed */}
        <div className="kpi-card-ishs p-6 space-y-4 flex flex-col justify-between border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-wider font-mono flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600" />
                Live Crossing Feed
              </h3>
              <span className="px-2.5 py-1 rounded text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                GATE SENSORS ACTIVE
              </span>
            </div>

            <div className="space-y-3">
              {crossings.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedCrop(item)}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-400 transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {item.direction === 'INBOUND' ? (
                        <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-cyan-600" />
                      )}
                      <span className="text-xs font-mono font-extrabold text-[#0f172a]">{item.oht_id}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      item.confidence >= 90 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {item.confidence >= 90 ? 'Terverifikasi' : 'Perlu Review'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-600">
                    <span>{item.contractor}</span>
                    <span className="text-slate-400">{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-500 text-center">
            Log Transaksi Verified by AI Engine
          </div>
        </div>
      </div>

      {/* Proof Crop Modal with 0.5s Enter & Exit Animations */}
      <Modal isOpen={selectedCrop !== null} onClose={() => setSelectedCrop(null)}>
        {selectedCrop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-[#0f172a] font-mono">Bukti AI Crop — {selectedCrop.oht_id}</h3>
              <button onClick={() => setSelectedCrop(null)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>
            {selectedCrop.crop_image_url && (
              <img src={selectedCrop.crop_image_url} alt="Crop Bukti" className="w-full h-48 object-cover rounded-xl border border-slate-200" />
            )}
            <div className="text-xs text-slate-700 space-y-1 font-mono">
              <p>Status Validasi: <span className="text-emerald-600 font-bold">Terverifikasi Otomatis</span></p>
              <p>Gerbang: <span className="text-slate-600">{selectedCrop.gate_name}</span></p>
              <p>Arah: <span className="text-cyan-700 font-bold">{selectedCrop.direction}</span></p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
