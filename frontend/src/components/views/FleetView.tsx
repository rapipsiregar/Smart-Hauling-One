import React, { useState } from 'react';
import { TruckAsset } from '../../lib/types';
import { Truck, CheckCircle2, Search, Filter } from 'lucide-react';

export const FleetView: React.FC<{ trucks: TruckAsset[] }> = ({ trucks }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'MAINTENANCE'>('ALL');

  const filtered = trucks.filter((t) => {
    const matchesSearch = t.oht_id.toLowerCase().includes(search.toLowerCase()) || t.model.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white space-y-3">
        <div className="flex items-center space-x-2">
          <Truck className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wide">
            Fleet Registry & Asset Management
          </h2>
        </div>
        <p className="text-xs text-slate-300 font-sans">
          Inventarisasi armada Off-Highway Truck (OHT) dan total ritase harian
        </p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari ID Lambung atau Model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-[#0b1120] border border-[#1e293b] rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#0b1120] border border-[#1e293b] rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">Semua Status Armada</option>
              <option value="ACTIVE">Hanya Status ACTIVE</option>
              <option value="MAINTENANCE">Hanya Status MAINTENANCE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid Cards (Clean White Surface in Light Mode) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((t) => (
          <div key={t.id} className="kpi-card-ishs p-5 space-y-4 border-b-4 border-orange-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                  <Truck className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a] font-mono tracking-tight">{t.oht_id}</h3>
                  <p className="text-xs text-slate-500 font-mono">{t.model}</p>
                </div>
              </div>

              <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-extrabold border ${
                t.status === 'ACTIVE'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                ● {t.status}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 text-xs font-mono">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Ritase Hari Ini</div>
              <div className="text-lg font-bold text-orange-600">{t.total_ritase_today} Trips</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
