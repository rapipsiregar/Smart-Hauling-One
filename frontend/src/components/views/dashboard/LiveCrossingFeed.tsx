import React from 'react';
import { CrossingLog } from '../../../lib/types';
import { Radio, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const LiveCrossingFeed: React.FC<{ crossings: CrossingLog[] }> = ({ crossings }) => {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          Live Crossing Feed
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
          GATE SENSORS ACTIVE
        </span>
      </div>

      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {crossings.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                  item.direction === 'INBOUND'
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                }`}
              >
                {item.direction === 'INBOUND' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold font-mono text-white tracking-wide">{item.oht_id}</span>
                </div>
                <p className="text-[11px] text-slate-400">{item.contractor}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end space-x-1">
                <span className="text-xs font-mono font-bold text-cyan-400">{item.confidence}%</span>
                {item.confidence >= 90 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{item.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
