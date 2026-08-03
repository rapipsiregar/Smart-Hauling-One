import React, { useState } from 'react';
import { FileText, Download, FileCheck, BarChart3, CheckCircle2 } from 'lucide-react';
import { mockCrossings, mockKPIs, mockTrucks, mockTowers } from '../../lib/api-client';
import { exportToExcel, exportToPDF } from '../../lib/export-utils';

export const ReportsView: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>('ALL');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportExcel = () => {
    exportToExcel(mockCrossings, {
      kpi: mockKPIs,
      trucks: mockTrucks,
      towers: mockTowers,
      filenamePrefix: 'ISHS_Shift_Report',
    });
    showToast('Laporan Excel (.xls) terpisah kolom & multi-seksi berhasil diunduh!');
  };

  const handleExportPDF = () => {
    exportToPDF(mockCrossings, {
      kpi: mockKPIs,
      trucks: mockTrucks,
      towers: mockTowers,
    });
    showToast('Jendela Cetak PDF Laporan Eksekutif telah dibuka!');
  };

  // Dynamic trips based on user shift selection
  const getTrips = () => {
    if (selectedShift === 'DAY') return { tia: 132, bic: 99, total: 231 };
    if (selectedShift === 'NIGHT') return { tia: 116, bic: 81, total: 197 };
    return { tia: 248, bic: 180, total: 428 };
  };

  const data = getTrips();
  const tiaPct = Math.round((data.tia / data.total) * 100) || 50;
  const bicPct = Math.round((data.bic / data.total) * 100) || 50;

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 p-4 rounded-xl bg-emerald-900 border border-emerald-500 text-white text-xs font-mono shadow-2xl flex items-center space-x-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-mono">
            <FileText className="w-5 h-5 text-orange-500" />
            Reports & Exporter Laporan
          </h2>
          <p className="text-xs text-slate-300 mt-1 font-sans">
            Ekspor laporan manajemen lengkap (KPI, Rekapitulasi Kontraktor, & Audit Trail) ke format Excel dan PDF
          </p>
        </div>

        {/* 2 Export Format Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" /> Unduh Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all cursor-pointer active:scale-95"
          >
            <FileCheck className="w-4 h-4" /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      {/* Contractor Ritase Barchart Simulation with Shift Filter Dropdown */}
      <div className="kpi-card-ishs p-6 border-b-4 border-orange-500 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2 font-mono">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            Rekapitulasi Ritase Per Kontraktor
          </h3>

          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-[#0f172a] font-mono font-bold focus:outline-none focus:border-orange-500 shadow-sm"
          >
            <option value="ALL">Semua Shift</option>
            <option value="DAY">Shift Siang (Day Shift)</option>
            <option value="NIGHT">Shift Malam (Night Shift)</option>
          </select>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-700 mb-1">
              <span className="font-bold">PT Tunas Inti Abadi (TIA)</span>
              <span className="text-cyan-700 font-bold">{data.tia} Trips ({tiaPct}%)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                style={{ width: `${tiaPct}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-slate-700 mb-1">
              <span className="font-bold">PT Borneo Indah Cemerlang (BIC)</span>
              <span className="text-emerald-700 font-bold">{data.bic} Trips ({bicPct}%)</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                style={{ width: `${bicPct}%` }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
