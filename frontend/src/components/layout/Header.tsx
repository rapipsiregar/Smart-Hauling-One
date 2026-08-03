import React, { useState, useEffect } from 'react';
import { User } from '../../lib/auth';
import { Clock, Sun, Moon, Cpu, LogOut, Menu } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeAlarmsCount: number;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  darkMode,
  setDarkMode,
  onToggleSidebar,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format time specifically for Asia/Makassar (WITA timezone UTC+8)
      setTime(now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-[#1e293b] bg-[#0b1120] px-6 flex items-center justify-between sticky top-0 z-30 text-white transition-colors shadow-md">
      {/* Left Branding & Burger Menu Toggle */}
      <div className="flex items-center space-x-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl bg-[#0f172a] border border-[#1e293b] text-slate-300 hover:text-orange-400 hover:border-orange-500 transition-colors cursor-pointer"
            title="Toggle Sidebar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              INTEGRATED SMART HAULING SYSTEM
            </h1>
            <p className="text-xs text-slate-400 font-mono">PT TIA & PT BIC Coal Mine Logistics</p>
          </div>
        </div>
      </div>

      {/* Right Metrics & Profile */}
      <div className="flex items-center space-x-4">
        {/* Live Clock specifically formatted in WITA Timezone (Asia/Makassar) */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-xs font-mono text-cyan-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{time || '20:05:00'} WITA</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg bg-[#0f172a] border border-[#1e293b] hover:border-cyan-500 text-slate-300 hover:text-cyan-400 transition-colors cursor-pointer"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-cyan-400" />}
        </button>

        {/* User Profile Badge & Logout */}
        {user && (
          <div className="flex items-center space-x-3 pl-3 border-l border-[#1e293b]">
            <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-cyan-500/50" />
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-white truncate max-w-[130px] font-sans">{user.name}</div>
              <div className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider font-bold">
                ● {user.role.replace('_', ' ')}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-[#0f172a] border border-[#1e293b] hover:border-rose-500 text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
