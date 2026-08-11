import React, { useState } from 'react';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, Radio, HardDrive, Cpu, Activity } from 'lucide-react';
import { mockVotingFrames, mockCrossings } from '../../lib/api-client';

export function GateConsoleView() {
  const [selectedGate, setSelectedGate] = useState('Gate 01 - Pit North');
  const [verificationFrames] = useState(mockVotingFrames);
  const [isProcessing, setIsProcessing] = useState(false);
  const [simulatedLogs, setSimulatedLogs] = useState(mockCrossings);

  const triggerSimulatedDetection = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const newLog = {
        id: `CRX-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleTimeString(),
        oht_id: 'DT-2152',
        confidence: 99.1,
        direction: 'INBOUND' as const,
        cargo_status: 'LOADED' as const,
        contractor: 'PT Tunas Inti Abadi',
        gate_name: selectedGate,
        is_verified: true,
        cycle_time_minutes: 41,
      };
      setSimulatedLogs([newLog, ...simulatedLogs]);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Gate Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 dark:bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            Konsol Deteksi Gerbang (Edge Gate Console)
          </h2>
          <p className="text-xs text-slate-400">
            Pemantauan langsung 1 gerbang pos lapangan dengan voting konsensus frame-by-frame
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedGate}
            onChange={(e) => setSelectedGate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            <option value="Gate 01 - Pit North">Gerbang CK North (Gate 01)</option>
            <option value="Gate 02 - Port Main">Gerbang PPA North (Gate 02)</option>
            <option value="Gate 03 - South Pit 01">Gerbang South Pit 01</option>
            <option value="Gate 04 - South Pit 02">Gerbang South Pit 02</option>
          </select>

          <button
            onClick={triggerSimulatedDetection}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            {isProcessing ? 'Memproses Deteksi...' : 'Simulasi Uji Deteksi'}
          </button>
        </div>
      </div>

      {/* 4 Status Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Kamera Gerbang</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live RTSP 30 FPS
            </div>
          </div>
          <Camera className="w-7 h-7 text-emerald-400/80" />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Arah Lintasan</div>
            <div className="text-sm font-semibold text-blue-400 mt-1">INBOUND (Masuk Pit)</div>
          </div>
          <Activity className="w-7 h-7 text-blue-400/80" />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Status Sync Pusat</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">Terkirim (HTTP 201)</div>
          </div>
          <CheckCircle2 className="w-7 h-7 text-emerald-400/80" />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Antrean Outbox</div>
            <div className="text-sm font-semibold text-slate-200 mt-1">0 Pending (Lokasi Safe)</div>
          </div>
          <HardDrive className="w-7 h-7 text-slate-400" />
        </div>
      </div>

      {/* Main Grid: Camera Stream + Frame Voting Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Stream Simulation Card */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              Live Camera Stream — CAM 01 Entrance ({selectedGate})
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
              192.168.1.104 (1080p60)
            </span>
          </div>

          <div className="relative aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=1200&q=80"
              alt="Live Truck Camera Feed"
              className="w-full h-full object-cover opacity-80"
            />

            {/* AI Bounding Box Simulation */}
            <div className="absolute top-1/3 left-1/3 w-48 h-24 border-2 border-emerald-400 bg-emerald-500/10 rounded backdrop-blur-[1px] flex flex-col justify-between p-2 animate-pulse">
              <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-1 rounded w-max">
                AI ROI: 99.4%
              </div>
              <div className="text-lg font-mono font-bold text-emerald-300 text-center tracking-widest bg-slate-950/80 rounded py-0.5">
                DT-118
              </div>
            </div>

            {/* Live Overlay Info */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur border border-slate-800 px-3 py-1.5 rounded text-xs font-mono text-slate-300 flex items-center gap-4">
              <span>STREAM LIVE</span>
              <span>1080p</span>
            </div>
          </div>
        </div>

        {/* Temporal Voting Reconciliation Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            Voting Konsensus Deteksi Frame
          </h3>

          <p className="text-xs text-slate-400">
            Hasil voting pembacaan berurutan per frame untuk memfilter silau lampu / stiker palsu:
          </p>

          <div className="space-y-2.5">
            {verificationFrames.map((frame) => (
              <div
                key={frame.frame_index}
                className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
                  frame.is_winner
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400'
                }`}
              >
                <div>
                  <div className="text-[10px] text-slate-500">Frame #{frame.frame_index}</div>
                  <div className="text-sm font-bold mt-0.5">{frame.read_text}</div>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                    frame.is_winner ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {frame.confidence}%
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {frame.is_winner ? '✓ Terpilih' : '✗ Dibuang'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-lg text-xs text-blue-300">
            <strong>Hasil Konsensus Final:</strong> <span className="font-mono text-emerald-400 font-bold">DT-118</span> (Akurasi 99.4% dari 18 frame sampling).
          </div>
        </div>
      </div>

      {/* Local Gate Recent Crossings Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-md font-semibold text-slate-200">Riwayat Penyeberangan Terbaru ({selectedGate})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">ID Transaksi</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">OHT Hull ID</th>
                <th className="p-3">Arah</th>
                <th className="p-3">Akurasi Deteksi</th>
                <th className="p-3">Kontraktor</th>
                <th className="p-3">Status Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {simulatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition">
                  <td className="p-3 font-bold text-slate-200">{log.id}</td>
                  <td className="p-3 text-slate-400">{log.timestamp}</td>
                  <td className="p-3 font-bold text-emerald-400">{log.oht_id}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      log.direction === 'INBOUND' ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'
                    }`}>
                      {log.direction}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-emerald-300">{log.confidence}%</td>
                  <td className="p-3">{log.contractor}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px]">
                      <CheckCircle2 className="w-3 h-3" /> Synced
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
