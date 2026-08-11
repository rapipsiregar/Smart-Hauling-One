import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { mockPeakHours, mockStagnantAlerts } from '../../../lib/api-client';

export function PeakHourSection() {
  const maxCount = Math.max(...mockPeakHours.flatMap(h => [h.gateA, h.gateB, h.gateC, h.gateD]));
  const gates = ['gateA', 'gateB', 'gateC', 'gateD'] as const;
  const gateLabels = ['Gate A (Pit N)', 'Gate B (Port)', 'Gate C (S.Pit01)', 'Gate D (S.Pit02)'];

  function heatColor(val: number): string {
    const ratio = val / maxCount;
    if (ratio > 0.8) return 'bg-rose-500';
    if (ratio > 0.6) return 'bg-orange-500';
    if (ratio > 0.4) return 'bg-amber-500';
    if (ratio > 0.2) return 'bg-yellow-600';
    return 'bg-slate-700';
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Heatmap Jam Puncak Kemacetan Gerbang & Stagnant Alert
          </h3>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded border font-bold text-rose-400 bg-rose-500/10 border-rose-500/30">
          {mockStagnantAlerts.length} Stagnant Alert
        </span>
      </div>

      {mockStagnantAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {mockStagnantAlerts.map((a) => (
            <div
              key={a.truckId}
              className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono ${
                a.status === 'CRITICAL'
                  ? 'bg-rose-950/40 border-rose-500/40'
                  : 'bg-amber-950/40 border-amber-500/40'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.status === 'CRITICAL' ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
              <div className="flex-1">
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-300' : 'text-amber-300'}`}>
                  Unit {a.truckId}
                </span>{' '}
                <span className="text-slate-400">
                  masuk {a.entryGate} pukul {a.entryTime} WITA — belum keluar selama{' '}
                </span>
                <span className={`font-bold ${a.status === 'CRITICAL' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {a.elapsedMinutes} menit
                </span>
                <span className="text-slate-500"> · {a.contractor}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                a.status === 'CRITICAL'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                {a.status}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(14, 1fr)' }}>
            <div />
            {mockPeakHours.map(h => (
              <div key={h.hour} className="text-[9px] text-slate-500 text-center font-mono">{h.hour.replace(':00', '')}</div>
            ))}
          </div>

          {gates.map((gate, gi) => (
            <div key={gate} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '60px repeat(14, 1fr)' }}>
              <div className="text-[9px] text-slate-400 font-mono flex items-center">{gateLabels[gi]}</div>
              {mockPeakHours.map(h => (
                <div
                  key={h.hour}
                  className={`h-6 rounded-sm flex items-center justify-center text-[8px] font-bold text-white/80 ${heatColor(h[gate])}`}
                  title={`${h.hour} — ${gateLabels[gi]}: ${h[gate]} truk`}
                >
                  {h[gate]}
                </div>
              ))}
            </div>
          ))}

          <div className="flex items-center gap-2 mt-3 text-[9px] font-mono text-slate-500">
            <span>Rendah</span>
            <div className="flex gap-0.5">
              {['bg-slate-700', 'bg-yellow-600', 'bg-amber-500', 'bg-orange-500', 'bg-rose-500'].map(c => (
                <div key={c} className={`w-5 h-3 rounded-sm ${c}`} />
              ))}
            </div>
            <span>Tinggi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
