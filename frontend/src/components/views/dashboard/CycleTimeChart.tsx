import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { CycleTimePoint } from '../../../lib/types';
import { Clock, Info } from 'lucide-react';

export const CycleTimeChart: React.FC<{ data: CycleTimePoint[] }> = ({ data }) => {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            24h Haulage Cycle Time Analytics
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Rata-rata waktu siklus pengangkutan (Pit to Port) & Batas Limiting ±2σ
          </p>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 rounded-full" />
            <span className="text-slate-300">Aktual</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-amber-400 border border-dashed border-amber-400" />
            <span className="text-slate-400">Target SLA (45m)</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCycle" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[20, 70]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'SLA Target 45m', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
            <Area type="monotone" dataKey="avg_cycle_minutes" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorCycle)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center space-x-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <span>Spike di jam 12:00 disebabkan oleh pergantian shift driver (*shift handover*). SLA kembali normal setelah pukul 14:00.</span>
      </div>
    </div>
  );
};
