import React from 'react';
import { KPISummary, NavigationTab } from '../../../lib/types';
import { Truck, Activity, ExternalLink } from 'lucide-react';

interface KPISummariesProps {
  kpi: KPISummary;
  onNavigate?: (tab: NavigationTab) => void;
}

export const KPISummaries: React.FC<KPISummariesProps> = ({
  kpi,
  onNavigate,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {/* Card 1: TOTAL RITASE HARI INI -> Navigate to Reports */}
      <div
        onClick={() => onNavigate && onNavigate('reports')}
        className="kpi-card-ishs p-6 space-y-4 flex flex-col justify-between hover:-translate-y-1 hover:border-blue-500 hover:shadow-xl transition-all duration-200 cursor-pointer group relative border border-slate-200"
        title="Klik untuk melihat detail Laporan Ritase Harian & Shift"
      >
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 uppercase tracking-wider font-bold mb-3">
            <span className="group-hover:text-blue-600 transition-colors text-sm font-extrabold">TOTAL RITASE HARI INI</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold text-[#0f172a] font-mono">428</span>
            <span className="text-sm font-bold text-slate-500 font-mono">Trips</span>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
          <span className="text-emerald-600 font-extrabold text-sm">+14.2% vs kemarin</span>
          <span className="text-slate-400 group-hover:text-blue-600 flex items-center gap-1 font-extrabold">
            Lihat Laporan <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Card 2: TRUK AKTIF DI KORIDOR -> Navigate to Fleet */}
      <div
        onClick={() => onNavigate && onNavigate('fleet')}
        className="kpi-card-ishs p-6 space-y-4 flex flex-col justify-between hover:-translate-y-1 hover:border-emerald-500 hover:shadow-xl transition-all duration-200 cursor-pointer group relative border border-slate-200"
        title="Klik untuk melihat status Armada"
      >
        <div>
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 uppercase tracking-wider font-bold mb-3">
            <span className="group-hover:text-emerald-600 transition-colors text-sm font-extrabold">TRUK AKTIF DI KORIDOR</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-extrabold text-[#0f172a] font-mono">34</span>
            <span className="text-sm font-bold text-slate-500 font-mono">Units</span>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500 font-bold">Armada Beroperasi</span>
          <span className="text-slate-400 group-hover:text-emerald-600 flex items-center gap-1 font-extrabold">
            Inspeksi Armada <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
