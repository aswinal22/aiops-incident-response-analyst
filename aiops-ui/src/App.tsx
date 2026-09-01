import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { StreamConsolePage } from './pages/StreamConsolePage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { ConnectedReposPage } from './pages/ConnectedReposPage';
import { SecurityPage } from './pages/SecurityPage';
import { BenchmarksPage } from './pages/BenchmarksPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Workspace */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans selection:bg-accent-blue/30 selection:text-white">
                  <Navbar />
                  <div className="flex flex-1">
                    <Sidebar />
                    <main className="flex-1 p-6 max-w-7xl mx-auto w-full overflow-y-auto min-h-[calc(100vh-3.5rem)]">
                      <Routes>
                        <Route path="/" element={<StreamConsolePage />} />
                        <Route path="/incidents" element={<IncidentsPage />} />
                        <Route path="/incidents/:id" element={<IncidentDetailPage />} />
                        <Route path="/repos" element={<ConnectedReposPage />} />
                        <Route path="/security" element={<SecurityPage />} />
                        <Route path="/benchmarks" element={<BenchmarksPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
