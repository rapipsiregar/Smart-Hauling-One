import React, { useState } from 'react';
import { User, DEMO_USERS } from '../../lib/auth';
import { HardHat, CheckCircle2, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [selectedRoleUser, setSelectedRoleUser] = useState<User>(DEMO_USERS[0]);
  const [email, setEmail] = useState(DEMO_USERS[0].email);
  const [password, setPassword] = useState('password123');

  const handleSelectDemoUser = (u: User) => {
    setSelectedRoleUser(u);
    setEmail(u.email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(selectedRoleUser);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden selection:bg-orange-500 selection:text-white">
      {/* Background Subtle Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        {/* Left Panel (Branding & Demo Account Selector) */}
        <div className="space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/20">
                <HardHat className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2 font-sans uppercase">
                  INTEGRATED SMART HAULING SYSTEM <span className="text-xs px-2.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 font-mono font-bold">ISHS v2.4</span>
                </h1>
                <p className="text-xs text-slate-500 font-mono">PT Tunas Inti Abadi & PT BIC Coal Mine Logistics</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pt-2 font-sans">
              Sistem Pengendalian Otomatisasi Ritase Tambang, Deteksi Kamera AI OCR, & Manajemen Telemetri Solar Tower.
            </p>
          </div>

          {/* Quick Demo Account Selector Cards (Clean White Cards in Light Mode) */}
          <div className="space-y-3">
            <span className="text-xs font-bold font-mono text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" /> Pilih Akun Demo (RBAC Role):
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMO_USERS.map((u) => {
                const isSelected = selectedRoleUser.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectDemoUser(u)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 relative cursor-pointer ${
                      isSelected
                        ? 'bg-white border-2 border-orange-500 text-[#0f172a] shadow-md shadow-orange-500/10 ring-1 ring-orange-500'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-orange-400 hover:bg-orange-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <img src={u.avatarUrl} alt={u.name} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold truncate font-sans text-[#0f172a]">{u.name.split(' ')[0]}</div>
                        <div className="text-[10px] text-orange-600 font-mono uppercase font-extrabold truncate">{u.role.replace('_', ' ')}</div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-orange-600 absolute top-2 right-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel (Authentication Form Card in Light Mode) */}
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#0f172a] tracking-tight font-sans">Otentikasi Pengguna</h2>
            <p className="text-xs text-slate-500 mt-1 font-sans">Masuk dengan kredensial akun Anda untuk mengakses control room ISHS.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-600 block mb-1.5 font-bold">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0f172a] font-mono focus:outline-none focus:border-orange-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-600 block mb-1.5 font-bold">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#0f172a] font-mono focus:outline-none focus:border-orange-500 focus:bg-white"
                  required
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
              <div className="flex justify-between text-slate-700">
                <span>Role Terpilih:</span>
                <span className="text-orange-600 font-extrabold uppercase">{selectedRoleUser.role}</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate">{selectedRoleUser.roleTitle}</p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs tracking-wider uppercase font-mono shadow-lg shadow-orange-600/30 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              MASUK KE SYSTEM CONTROL ROOM <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <div className="text-[11px] text-slate-400 text-center font-mono border-t border-slate-100 pt-3">
            Integrated Smart Hauling System (ISHS) — Enterprise RBAC v1.0
          </div>
        </div>
      </div>
    </div>
  );
};
