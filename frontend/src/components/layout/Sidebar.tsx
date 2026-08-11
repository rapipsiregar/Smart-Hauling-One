import React from 'react';
import { NavigationTab } from '../../lib/types';
import { User, hasPermission } from '../../lib/auth';
import {
  LayoutDashboard, Radio, MapPin, FileSpreadsheet, Truck,
  FileText, Wrench, ChevronLeft, ChevronRight,
  TrendingUp, Building2, RotateCw,
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  darkMode: boolean;
}

interface MenuItem { id: NavigationTab; label: string; icon: React.ElementType; }

interface MenuGroup { category: string; items: MenuItem[]; }

const MENU_GROUPS: MenuGroup[] = [
  {
    category: 'Operasional',
    items: [
      { id: 'dashboard',    label: 'Operations Hub',       icon: LayoutDashboard },
      { id: 'gate_console', label: 'Konsol Gerbang (Edge)',  icon: Radio },
      { id: 'map',          label: 'Site Plan Map',          icon: MapPin },
    ],
  },
  {
    category: 'Armada & Ledger',
    items: [
      { id: 'ledger',     label: 'Reconciliation Ledger', icon: FileSpreadsheet },
      { id: 'fleet',      label: 'Fleet Registry',        icon: Truck },
      { id: 'ritase',     label: 'Ritase & Pit Status',   icon: RotateCw },
      { id: 'contractor', label: 'Efisiensi Kontraktor',  icon: Building2 },
    ],
  },
  {
    category: 'Laporan & Analitik',
    items: [
      { id: 'reports',   label: 'Reports & Shift',        icon: FileText },
      { id: 'analytics', label: 'Advanced Analytics',     icon: TrendingUp },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user, activeTab, setActiveTab, collapsed, setCollapsed,
}) => {
  return (
    <aside
      className={`transition-all duration-500 ease-in-out bg-[#0b1120] border-r border-[#1e293b] flex flex-col justify-between ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      <div className="flex-1 overflow-y-auto py-3 space-y-1">
        {MENU_GROUPS.map((group) => {
          const allowed = group.items.filter(
            item => !user || hasPermission(user.role, item.id)
          );
          if (allowed.length === 0) return null;
          return (
            <div key={group.category}>
              {/* Category Label */}
              {!collapsed && (
                <div className="px-4 pt-3 pb-1 text-[9px] font-mono font-bold uppercase tracking-widest text-slate-600">
                  {group.category}
                </div>
              )}

              {allowed.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <div key={item.id} className="px-2">
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer ${
                        isActive
                          ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/25'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${
                          isActive ? 'text-white scale-110' : 'text-slate-400 group-hover:text-orange-400'
                        }`}
                      />
                      {!collapsed && (
                        <span className="truncate text-left flex-1 font-sans">{item.label}</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer: Collapse Toggle + RBAC Count */}
      <div className="p-3 border-t border-[#1e293b] flex items-center justify-between gap-2">
        {!collapsed && user && (
          <div className="text-[9px] font-mono text-slate-600 truncate">
            {MENU_GROUPS.flatMap(g => g.items).filter(i => hasPermission(user.role, i.id)).length} Modul
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg bg-[#0f172a] border border-[#1e293b] text-slate-400 hover:text-white transition-colors cursor-pointer ml-auto"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
