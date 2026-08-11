import React, { useState } from 'react';
import { CrossingLog } from '../../lib/types';
import { Modal } from '../common/Modal';
import { FileSpreadsheet, Lock, Eye, Filter } from 'lucide-react';

export const LedgerView: React.FC<{ crossings: CrossingLog[] }> = ({ crossings }) => {
  const [selectedCrop, setSelectedCrop] = useState<CrossingLog | null>(null);
  const [filterContractor, setFilterContractor] = useState<string>('ALL');

  const filtered = crossings.filter(
    (c) => filterContractor === 'ALL' || c.contractor === filterContractor
  );

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#0f172a] uppercase tracking-wide flex items-center gap-2 font-mono">
            <FileSpreadsheet className="w-5 h-5 text-orange-500" />
            RECONCILIATION LEDGER & AUDIT TRAIL
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log transaksi lintasan truk dengan penguncian verifikasi AI & bukti foto crop.
          </p>
        </div>

        {/* Contractor Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterContractor}
            onChange={(e) => setFilterContractor(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-[#0f172a] font-mono font-bold focus:outline-none focus:border-orange-500 shadow-sm"
          >
            <option value="ALL">Semua Subkontraktor</option>
            <option value="PT Tunas Inti Abadi">PT Tunas Inti Abadi</option>
            <option value="PT Borneo Indah Cemerlang">PT Borneo Indah Cemerlang</option>
          </select>
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="kpi-card-ishs p-6 border border-slate-200 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="p-3">TX ID</th>
                <th className="p-3">TIMESTAMP (WITA)</th>
                <th className="p-3">OHT ID</th>
                <th className="p-3">KONTRAKTOR</th>
                <th className="p-3">ARAH</th>
                <th className="p-3 text-center">VERIFIKASI AI</th>
                <th className="p-3 text-center">BUKTI CROP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-bold text-slate-400">{item.id}</td>
                  <td className="p-3 text-slate-600">{item.timestamp}</td>
                  <td className="p-3 font-extrabold text-[#0f172a]">{item.oht_id}</td>
                  <td className="p-3 text-slate-700">{item.contractor}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${item.direction === 'INBOUND' ? 'bg-emerald-100 text-emerald-800' : 'bg-cyan-100 text-cyan-800'}`}>
                      {item.direction}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {item.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        <Lock className="w-3 h-3 text-emerald-600" /> LOCKED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300">
                        UNVERIFIED
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setSelectedCrop(item)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
                      title="Lihat Bukti Foto Crop AI"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <p>Keyakinan Deteksi: <span className="text-emerald-600 font-bold">{selectedCrop.confidence}%</span></p>
              <p>Gerbang: <span className="text-slate-600">{selectedCrop.gate_name}</span></p>
              <p>Arah: <span className="text-cyan-700 font-bold">{selectedCrop.direction}</span></p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
