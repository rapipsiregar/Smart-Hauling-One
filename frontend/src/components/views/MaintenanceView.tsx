import React, { useState } from 'react';
import { Wrench, Battery, Cpu, AlertOctagon, TrendingUp, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { mockMaintenanceTowers, mockRegressionForecasts } from '../../lib/api-client';

export function MaintenanceView() {
  const [towers, setTowers] = useState(mockMaintenanceTowers);
  const [forecasts] = useState(mockRegressionForecasts);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleWashLens = (towerId: string) => {
    setTowers(towers.map(t => t.id === towerId ? { ...t, lens_clarity_pct: 100 } : t));
    setActionMessage('✅ Simulasi Pembersihan Lensa Optik Berhasil! Lensa dikembalikan ke kejelasan 100%.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleDampenSkids = (towerId: string) => {
    setTowers(towers.map(t => t.id === towerId ? { ...t, vibration_rms: 1.0 } : t));
    setActionMessage('✅ Simulasi Peredaman Skid Hidrolik Berhasil! Getaran diturunkan ke 1.0 mm/s RMS.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleSwapBattery = (towerId: string) => {
    setTowers(towers.map(t => t.id === towerId ? { ...t, battery_health_pct: 100, low_voltage_alert: false } : t));
    setActionMessage('✅ Simulasi Swap Bank Baterai LiFePO4 Berhasil! Kesehatan baterai pulih ke 100%.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            Predictive Asset Maintenance & Edge Telemetry (Teknisi)
          </h2>
          <p className="text-xs text-slate-400">
            Prediksi sisa umur perangkat keras (LiFePO4, Lensa, Suhu) & Pemodelan Regresi Linier OLS
          </p>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs font-semibold animate-pulse">
          {actionMessage}
        </div>
      )}

      {/* Main Maintenance Towers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {towers.map((tower) => (
          <div key={tower.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-semibold text-slate-200">{tower.name}</h3>
                <p className="text-xs text-slate-400">{tower.location}</p>
              </div>

              {tower.low_voltage_alert ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                  <AlertOctagon className="w-3.5 h-3.5" /> Peringatan Tegangan Rendah
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" /> Kondisi Perangkat Prima
                </span>
              )}
            </div>

            {/* Health Metrics Gauges */}
            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Battery className="w-3 h-3 text-emerald-400" /> Baterai LiFePO4
                </div>
                <div className="text-base font-bold text-slate-100 mt-1">{tower.battery_health_pct}%</div>
                <div className="text-[10px] text-slate-500">SOH Baterai</div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-400" /> Kejelasan Lensa
                </div>
                <div className="text-base font-bold text-slate-100 mt-1">{tower.lens_clarity_pct}%</div>
                <div className="text-[10px] text-slate-500">Kamera Optik</div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-amber-400" /> Getaran Skid
                </div>
                <div className={`text-base font-bold mt-1 ${tower.vibration_rms > 3.0 ? 'text-amber-400' : 'text-slate-100'}`}>
                  {tower.vibration_rms} mm/s
                </div>
                <div className="text-[10px] text-slate-500">RMS Stress</div>
              </div>
            </div>

            {/* Field Intervention Action Trigger Buttons */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="text-xs text-slate-400 font-medium">Aksi Intervensi Lapangan Langsung:</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleWashLens(tower.id)}
                  className="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white text-xs rounded-md font-medium transition"
                >
                  🧼 Cuci Lensa Optik (Wash Lens)
                </button>
                <button
                  onClick={() => handleDampenSkids(tower.id)}
                  className="px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white text-xs rounded-md font-medium transition"
                >
                  ⚓ Redam Skid Hidrolik
                </button>
                <button
                  onClick={() => handleSwapBattery(tower.id)}
                  className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs rounded-md font-medium transition"
                >
                  🔋 Swap Bank Baterai
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* OLS Linear Regression Predictive Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            Pemodelan Regresi Linier OLS & Proyeksi Kegagalan (OLS Forecast)
          </h3>
          <span className="text-xs font-mono text-purple-300 bg-purple-950/40 px-2 py-1 rounded border border-purple-800/40">
            Model: y = mx + c
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Nama Tower</th>
                <th className="p-3">Parameter Terukur</th>
                <th className="p-3">Kemiringan (Slope m)</th>
                <th className="p-3">Intersep (c)</th>
                <th className="p-3">Akurasi R² Score</th>
                <th className="p-3">Sisa Waktu ke Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {forecasts.map((f, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition">
                  <td className="p-3 font-bold text-slate-200">{f.tower_name}</td>
                  <td className="p-3 text-slate-300">{f.metric}</td>
                  <td className="p-3 text-purple-300">+{f.slope_m} / jam</td>
                  <td className="p-3 text-slate-400">{f.intercept_c}</td>
                  <td className="p-3 font-bold text-emerald-400">{f.r2_score}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      f.hours_to_limit < 48 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      ⏳ ~{f.hours_to_limit} Jam Lagi
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
