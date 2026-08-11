import React, { useState } from 'react';
import {
  FileText, Download, FileCheck, CheckCircle2, RefreshCw,
  RotateCw, AlertTriangle, ArrowDownLeft, ArrowUpRight, Truck,
} from 'lucide-react';
import { DEMO_SHIFT_REPORT, ShiftReport, formatCycleTime } from '../../lib/shift-report-data';
import { downloadShiftReportXlsx } from '../../lib/shift-xlsx';
import { downloadShiftReportPdf } from '../../lib/shift-pdf';

type ShiftFilter = 'ALL' | 'DAY' | 'NIGHT';

function shiftLabel(f: ShiftFilter) {
  if (f === 'DAY') return 'Shift Siang (06:00–18:00)';
  if (f === 'NIGHT') return 'Shift Malam (18:00–06:00)';
  return 'Semua Shift';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ value, label, sub, color = 'text-amber-400' }: {
  value: string | number; label: string; sub?: string; color?: string;
}) {
  return (
    <div className="kpi-card-ishs p-4 space-y-1 text-center">
      <div className={`text-3xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs font-semibold text-[#0f172a]">{label}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onClear }: { msg: string; onClear: () => void }) {
  return (
    <div
      className="fixed top-20 right-8 z-50 p-4 rounded-xl bg-emerald-900 border border-emerald-500 text-white text-xs font-mono shadow-2xl flex items-center space-x-3 cursor-pointer"
      onClick={onClear}
    >
      <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
      <span className="text-orange-500">{icon}</span>
      <div>
        <h3 className="text-sm font-bold text-[#0f172a] font-mono uppercase tracking-wide">{title}</h3>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const ReportsView: React.FC = () => {
  const [report] = useState<ShiftReport>(DEMO_SHIFT_REPORT);
  const [shift, setShift] = useState<ShiftFilter>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const [building, setBuilding] = useState<'xlsx' | 'pdf' | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleExcel = async () => {
    setBuilding('xlsx');
    try {
      const name = await downloadShiftReportXlsx(report, shiftLabel(shift));
      showToast(`✓ Tersimpan: ${name}`);
    } catch (e) {
      showToast('❌ Ekspor Excel gagal — coba lagi');
    } finally {
      setBuilding(null);
    }
  };

  const handlePdf = async () => {
    setBuilding('pdf');
    try {
      const name = await downloadShiftReportPdf(report, shiftLabel(shift));
      showToast(`✓ PDF diunduh: ${name}`);
    } catch (e) {
      showToast('❌ Ekspor PDF gagal — coba lagi');
    } finally {
      setBuilding(null);
    }
  };

  const accConf = `${(report.avgConfidence * 100).toFixed(1)}%`;

  return (
    <div className="space-y-6 relative">
      {toast && <Toast msg={toast} onClear={() => setToast(null)} />}

      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="banner-dark-navy p-6 rounded-2xl bg-[#0f172a] border border-[#1e293b] shadow-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2 font-mono">
            <FileText className="w-5 h-5 text-orange-500" />
            Laporan Ritase Harian & Shift
          </h2>
          <p className="text-xs text-slate-300 mt-1 font-sans">
            {report.date} · Model: {report.model}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Shift Selector */}
          <select
            value={shift}
            onChange={e => setShift(e.target.value as ShiftFilter)}
            className="px-3 py-2 bg-[#0f172a] border border-[#334155] text-slate-200 text-xs rounded-xl font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">Semua Shift</option>
            <option value="DAY">Shift Siang</option>
            <option value="NIGHT">Shift Malam</option>
          </select>

          {/* Export Buttons */}
          <button
            onClick={handleExcel}
            disabled={!!building}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
          >
            {building === 'xlsx'
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            Unduh Excel
          </button>
          <button
            onClick={handlePdf}
            disabled={!!building}
            className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all cursor-pointer active:scale-95"
          >
            {building === 'pdf'
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <FileCheck className="w-4 h-4" />}
            Cetak PDF
          </button>
        </div>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard value={report.totalRitase} label="Ritase Selesai" sub="trip pulang-pergi" color="text-amber-500" />
        <KpiCard value={report.totalCrossings} label="Total Lintasan" sub="gate crossing events" color="text-cyan-600" />
        <KpiCard value={report.uniqueTrucks} label="Armada Unik" sub="nomor lambung terbaca" color="text-emerald-600" />
        <KpiCard value={accConf} label="Akurasi Deteksi" sub="rata-rata confidence" color={report.avgConfidence >= 0.95 ? 'text-emerald-600' : 'text-rose-500'} />
      </div>

      {/* ── Per Gate Breakdown ───────────────────────────────────────────── */}
      <div className="kpi-card-ishs p-5 space-y-4">
        <SectionHead icon={<RotateCw className="w-4 h-4" />} title="Lintasan Per Gerbang" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {report.perGate.map(g => {
            const total = g.inbound + g.outbound + g.undirected;
            return (
              <div key={g.gate} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs font-bold text-[#0f172a] truncate mb-2">{g.gate}</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between text-emerald-700">
                    <span className="flex items-center gap-1"><ArrowDownLeft className="w-3 h-3" /> Masuk</span>
                    <span className="font-bold">{g.inbound}</span>
                  </div>
                  <div className="flex justify-between text-sky-700">
                    <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Keluar</span>
                    <span className="font-bold">{g.outbound}</span>
                  </div>
                  {g.undirected > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Tanpa Arah</span>
                      <span>{g.undirected}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-1 text-[#0f172a] font-bold">
                    <span>Total</span>
                    <span>{total}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per Truck Table ──────────────────────────────────────────────── */}
      <div className="kpi-card-ishs p-5 space-y-4">
        <SectionHead
          icon={<Truck className="w-4 h-4" />}
          title="Ritase Per Unit Truk"
          sub={`${report.perTruck.length} unit terbaca hari ini`}
        />
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-left text-xs font-mono min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="px-2 py-2">No. Lambung</th>
                <th className="px-2 py-2 text-right">Ritase</th>
                <th className="px-2 py-2 text-right">Masuk</th>
                <th className="px-2 py-2 text-right">Keluar</th>
                <th className="px-2 py-2 text-right">Conf Terbaik</th>
                <th className="px-2 py-2 text-right">Siklus Avg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.perTruck.map(t => (
                <tr key={t.hullId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-2 py-2.5 font-bold text-[#0f172a] flex items-center gap-2">
                    {t.hullId}
                    {!t.registered && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 border border-rose-200">belum terdaftar</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right font-bold text-amber-600">{t.ritase}</td>
                  <td className="px-2 py-2.5 text-right text-emerald-600">{t.inCount}</td>
                  <td className="px-2 py-2.5 text-right text-sky-600">{t.outCount}</td>
                  <td className="px-2 py-2.5 text-right">
                    <span className={`${t.bestConf >= 0.9 ? 'text-emerald-600' : 'text-rose-500'} font-bold`}>
                      {(t.bestConf * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right text-slate-500">{formatCycleTime(t.avgCycleSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Unpaired Crossings ───────────────────────────────────────────── */}
      {report.unpairedCount > 0 && (
        <div className="kpi-card-ishs p-5 space-y-4 border-l-4 border-rose-500">
          <SectionHead
            icon={<AlertTriangle className="w-4 h-4 text-rose-500" />}
            title={`Lintasan Belum Berpasangan (${report.unpairedCount})`}
            sub="Lintasan masuk tanpa keluar pasangan, atau sebaliknya"
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono min-w-[480px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="px-2 py-2">No. Lambung</th>
                  <th className="px-2 py-2">Gerbang</th>
                  <th className="px-2 py-2">Arah</th>
                  <th className="px-2 py-2">Waktu</th>
                  <th className="px-2 py-2">Sebab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.unpaired.map(u => {
                  const REASONS: Record<string, string> = {
                    'missing-out': 'Belum terbaca keluar',
                    'missing-in': 'Tidak ada catatan masuk',
                    'no-direction': 'Arah gate tidak diketahui',
                    'unidentified-hull': 'Nomor lambung tidak terbaca',
                  };
                  return (
                    <tr key={u.id} className="hover:bg-rose-50 transition-colors">
                      <td className="px-2 py-2.5 font-bold text-[#0f172a]">{u.hullId}</td>
                      <td className="px-2 py-2.5 text-slate-500">{u.lane}</td>
                      <td className="px-2 py-2.5 text-slate-500">
                        {u.direction === 'inbound' ? 'Masuk' : u.direction === 'outbound' ? 'Keluar' : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-slate-400">{u.crossedAt}</td>
                      <td className="px-2 py-2.5 text-rose-500">{REASONS[u.reason] ?? u.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
