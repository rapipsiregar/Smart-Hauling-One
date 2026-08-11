import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { LoginView } from './components/views/LoginView';
import { UnauthorizedView } from './components/views/UnauthorizedView';
import { DashboardView } from './components/views/DashboardView';
import { GateConsoleView } from './components/views/GateConsoleView';
import { MapView } from './components/views/MapView';
import { LedgerView } from './components/views/LedgerView';
import { FleetView } from './components/views/FleetView';
import { ReportsView } from './components/views/ReportsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ContractorView } from './components/views/ContractorView';
import { RitaseView } from './components/views/RitaseView';
import { NavigationTab, KPISummary, CrossingLog } from './lib/types';
import { mockKPIs, mockCrossings, mockTrucks, mockCycleTime } from './lib/api-client';
import { User, getStoredUser, setStoredUser, clearStoredUser, hasPermission } from './lib/auth';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser());
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [kpi] = useState<KPISummary>(mockKPIs);
  const [crossings] = useState<CrossingLog[]>(mockCrossings);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [darkMode]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setStoredUser(user);
    const defaultTab = user.role === 'gate_operator' ? 'gate_console' : 'dashboard';
    setActiveTab(defaultTab);
  };

  const handleLogout = () => {
    clearStoredUser();
    setCurrentUser(null);
  };

  const handleSwitchUser = (user: User) => {
    setCurrentUser(user);
    setStoredUser(user);
    const defaultTab = user.role === 'gate_operator' ? 'gate_console' : 'dashboard';
    setActiveTab(defaultTab);
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isAllowed = hasPermission(currentUser.role, activeTab);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${darkMode ? 'bg-[#090d16] text-[#e8eaed]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        activeAlarmsCount={kpi.active_alarms_count}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          user={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          darkMode={darkMode}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {!isAllowed ? (
            <UnauthorizedView user={currentUser} onGoBack={() => setActiveTab('dashboard')} />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  kpi={kpi}
                  crossings={crossings}
                  cycleTimes={mockCycleTime}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}
              {activeTab === 'gate_console' && <GateConsoleView />}
              {activeTab === 'map' && <MapView />}
              {activeTab === 'ledger' && <LedgerView crossings={crossings} />}
              {activeTab === 'fleet' && <FleetView trucks={mockTrucks} />}
              {activeTab === 'reports' && <ReportsView />}
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'contractor' && <ContractorView />}
              {activeTab === 'ritase' && <RitaseView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

