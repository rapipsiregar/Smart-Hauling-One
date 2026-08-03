import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { User } from '../../lib/auth';

interface UnauthorizedViewProps {
  user: User;
  onGoBack: () => void;
}

export const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({ user, onGoBack }) => {
  return (
    <div className="p-12 rounded-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl max-w-xl mx-auto text-center space-y-6 my-12">
      <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-xl shadow-rose-900/20">
        <ShieldAlert className="w-8 h-8 animate-pulse" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800">
          ERROR 403 — UN-AUTHORIZED ACCESS
        </span>
        <h2 className="text-2xl font-extrabold text-white tracking-tight pt-2">Akses Modul Ditolak</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Akun Anda saat ini terdaftar sebagai role <span className="text-cyan-400 font-mono font-bold uppercase">{user.roleTitle}</span> dan tidak memiliki wewenang untuk mengakses halaman ini.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 max-w-sm mx-auto space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Nama User:</span>
          <span>{user.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Hak Akses:</span>
          <span className="text-amber-400">Terbatas (RBAC Protected)</span>
        </div>
      </div>

      <button
        onClick={onGoBack}
        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all inline-flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Operations Hub
      </button>
    </div>
  );
};
