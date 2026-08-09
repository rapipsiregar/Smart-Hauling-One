"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mountain, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { DEMO_PROFILES, UserProfile } from "@/components/navigation-data";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<UserProfile>(DEMO_PROFILES[0]);
  const [email, setEmail] = useState(DEMO_PROFILES[0].email);
  const [password, setPassword] = useState("password123");

  const handleSelectProfile = (p: UserProfile) => {
    setSelectedProfile(p);
    setEmail(p.email);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(selectedProfile);
    router.push(selectedProfile.defaultLanding);
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0d14] text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      {/* Glow effect background */}
      <div className="absolute w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
        {/* Left Branding Box */}
        <div className="flex flex-col justify-between p-6 glass-panel border border-[var(--border)] rounded-2xl bg-slate-900/60 backdrop-blur-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
                <Mountain className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-wide font-sans uppercase">
                  INTEGRATED SMART HAULING SYSTEM
                </h1>
                <p className="text-xs text-amber-400/90 font-mono font-medium">PT TIA & PT BIC Coal Logistics</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-2">
              Sistem Pengendalian Otomatisasi Ritase Tambang, Deteksi Kamera AI OCR & Telemetri Edge Node.
            </p>
          </div>

          {/* Isolated Account Selection */}
          <div className="space-y-3 pt-6 border-t border-slate-800">
            <span className="text-[11px] font-bold font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-amber-400" /> Pilih Akun Pengguna Ter-Isolasi:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_PROFILES.map((p) => {
                const isSelected = selectedProfile.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProfile(p)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-amber-500/15 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10"
                        : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-bold text-amber-400">
                        {p.avatarText}
                      </div>
                      <div>
                        <div className="text-xs font-bold font-sans text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-amber-400/90 font-mono uppercase font-bold">{p.roleTitle}</div>
                      </div>
                    </div>
                    {isSelected && <ShieldCheck className="w-4 h-4 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Form Box */}
        <div className="p-8 glass-panel border border-slate-800 rounded-2xl bg-slate-900/80 backdrop-blur-xl flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight font-sans">Otentikasi Akun</h2>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Masuk dengan kredensial ter-isolasi untuk mengakses konsol ISHS sesuai hak akses peran Anda.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5 font-bold">Email Akun</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 block mb-1.5 font-bold">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="flex justify-between text-slate-200">
                <span>Hak Akses Peran:</span>
                <span className="text-amber-400 font-bold uppercase">{selectedProfile.roleTitle}</span>
              </div>
              <p className="text-[10px] text-slate-400">Target Halaman: <span className="text-emerald-400">{selectedProfile.defaultLanding}</span></p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wider uppercase font-mono shadow-lg shadow-amber-500/20 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              MASUK KE KONSOL ISHS <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          <div className="text-[11px] text-slate-500 text-center font-mono border-t border-slate-800/80 pt-3">
            ISHS Account Authentication Engine — Enterprise Isolation Mode
          </div>
        </div>
      </div>
    </div>
  );
}
