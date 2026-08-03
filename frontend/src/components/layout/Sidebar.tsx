import React from 'react';
import { NavigationTab } from '../../lib/types';
import { User, hasPermission } from '../../lib/auth';
import {
  LayoutDashboard,
  MapPin,
  FileSpreadsheet,
  Truck,
  Radio,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  darkMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Operations Hub', icon: LayoutDashboard },
    { id: 'map', label: 'Site Plan Map', icon: MapPin },
    { id: 'ledger', label: 'Reconciliation Ledger', icon: FileSpreadsheet },
    { id: 'fleet', label: 'Fleet Registry', icon: Truck },
    { id: 'reports', label: 'Reports & Export', icon: FileText },
  ];

  const allowedMenuItems = user
    ? menuItems.filter((item) => hasPermission(user.role, item.id as NavigationTab))
    : menuItems;

  return (
    <aside
      className={`transition-all duration-500 ease-in-out bg-[#0b1120] border-r border-[#1e293b] flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-4 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 transition-opacity duration-500">
            Modul Akses ({allowedMenuItems.length} Diizinkan)
          </div>
        )}

        {allowedMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as NavigationTab)}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all duration-500 group relative cursor-pointer ${
                isActive
                  ? 'nav-pill-active bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-500 ${
                  isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-orange-400'
                }`}
              />
              {!collapsed && <span className="truncate text-left flex-1 font-sans transition-opacity duration-500">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Sidebar */}
      <div className="p-4 border-t border-[#1e293b] flex items-center justify-center">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
