import React, { useState, useEffect } from 'react';
import { User, DEMO_USERS } from '../../lib/auth';
import { isLiveModeEnabled, toggleLiveMode } from '../../lib/api-client';
import { Clock, Sun, Moon, Cpu, LogOut, Menu, UserCheck, ToggleLeft, ToggleRight } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onSwitchUser?: (u: User) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeAlarmsCount: number;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onSwitchUser,
  darkMode,
  setDarkMode,
  onToggleSidebar,
}) => {
  const [time, setTime] = useState<string>('');
  const [isLiveMode, setIsLiveMode] = useState<boolean>(isLiveModeEnabled());

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleMode = () => {
    const next = !isLiveMode;
    setIsLiveMode(next);
    toggleLiveMode(next);
  };

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

      {/* Right Controls: Mode Switcher, Role Selector, Clock & Profile */}
      <div className="flex items-center space-x-3">
        {/* Dual Mode Switcher Toggle */}
        <button
          onClick={handleToggleMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
            isLiveMode
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-blue-950/60 border-blue-500/50 text-blue-300'
          }`}
          title="Toggle antara Mode Demo dan Backend Live"
        >
          {isLiveMode ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-blue-400" />}
          <span>{isLiveMode ? 'LIVE BACKEND' : 'DEMO MODE'}</span>
        </button>

        {/* Quick Role Switcher Dropdown */}
        {user && onSwitchUser && (
          <div className="hidden lg:flex items-center space-x-1.5 bg-[#0f172a] border border-[#1e293b] rounded-lg px-2 py-1 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={user.id}
              onChange={(e) => {
                const target = DEMO_USERS.find(u => u.id === e.target.value);
                if (target) onSwitchUser(target);
              }}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {DEMO_USERS.map(u => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                  Switch: {u.roleTitle}
                </option>
              ))}
            </select>
          </div>
        )}

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

