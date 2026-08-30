import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { LogsPage } from './pages/LogsPage';
import { ServicesPage } from './pages/ServicesPage';
import { SecurityPage } from './pages/SecurityPage';
import { BenchmarksPage } from './pages/BenchmarksPage';
import { api } from './lib/api';

export const App: React.FC = () => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleGlobalSimulate = async () => {
    try {
      await api.simulateError('file_not_found', 'target-app');
      setToastMessage('Simulated outage triggered! LangGraph RCA in progress.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage(`Simulation error: ${err.message}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-background text-slate-100 font-sans">
        {/* Persistent Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar onSimulateClick={handleGlobalSimulate} />

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="bg-rose-500/20 border-b border-rose-500/40 text-rose-200 px-6 py-2 text-xs font-mono flex items-center justify-between animate-in slide-in-from-top-2">
              <span>⚡ {toastMessage}</span>
              <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* Router Outlet */}
          <main className="flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/benchmarks" element={<BenchmarksPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
};
