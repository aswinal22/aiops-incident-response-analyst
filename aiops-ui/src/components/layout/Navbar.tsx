import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { HealthStatus } from '../../lib/types';
import { Zap, Folder, Server, LogOut, ChevronDown, CheckCircle2, AlertTriangle, Key } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, activeProject, activeService, projects, setActiveProject, setActiveService, patStatus, logout } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealth(data);
      } catch {
        setHealth(null);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 border-b border-border bg-surface/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand & Project/Service Switcher */}
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue glow-blue">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-xs tracking-wide text-slate-100 uppercase font-mono block">
              AIOps SRE Studio
            </span>
            <span className="text-[10px] text-slate-400 font-mono -mt-0.5 block">
              24/7 Autonomous Incident Response
            </span>
          </div>
        </Link>

        {/* Project & Service Context Switcher */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#090d16] hover:bg-slate-800/80 border border-slate-800 text-xs font-mono text-slate-300 transition-all"
          >
            <Folder className="w-3.5 h-3.5 text-accent-blue" />
            <span className="text-slate-400 font-semibold truncate max-w-[120px]">
              {activeProject ? activeProject.name : 'Select Project'}
            </span>
            <span className="text-slate-600">❯</span>
            <Server className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-200 font-semibold truncate max-w-[120px]">
              {activeService ? activeService.name : 'Select Service'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500 ml-1" />
          </button>

          {/* Switcher Dropdown */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-2xl p-2 z-50 space-y-2 animate-in fade-in zoom-in-95">
              <div className="text-[10px] uppercase font-mono text-slate-400 px-2 pt-1 font-semibold">
                Select Project & Service:
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {projects.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <div className="text-[11px] font-mono font-bold text-slate-300 px-2 py-1 bg-slate-900/50 rounded flex items-center gap-1.5">
                      <Folder className="w-3 h-3 text-accent-blue" />
                      <span>{p.name}</span>
                    </div>
                    {(p.services || []).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setActiveProject(p);
                          setActiveService(s);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left pl-6 pr-2 py-1.5 rounded text-xs font-mono flex items-center justify-between transition-colors ${
                          activeService?.id === s.id
                            ? 'bg-accent-blue/15 text-accent-blue font-semibold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        {activeService?.id === s.id && <CheckCircle2 className="w-3 h-3 text-accent-blue" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border">
                <Link
                  to="/projects"
                  onClick={() => setIsDropdownOpen(false)}
                  className="block text-center text-xs text-accent-blue hover:underline py-1"
                >
                  Manage Projects & Scopes →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Engine Status, PAT Governance, User Profile */}
      <div className="flex items-center gap-3">
        {/* PAT Governance Status */}
        <Link
          to="/settings"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all ${
            patStatus === 'connected'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
          }`}
        >
          <Key className="w-3 h-3" />
          <span>{patStatus === 'connected' ? 'PAT Active' : 'Connect PAT'}</span>
        </Link>

        {/* Engine 24/7 Status */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border bg-slate-900/60 border-border">
          {health?.status === 'ok' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">Engine 24/7 Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-amber-400 font-medium">Connecting...</span>
            </>
          )}
        </div>

        {/* User Profile & Logout */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-border">
            <div className="w-7 h-7 rounded-full bg-accent-blue/15 border border-accent-blue/30 text-accent-blue flex items-center justify-center font-mono font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden xl:block text-left leading-tight">
              <div className="text-xs font-semibold text-slate-200">{user.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">{user.role || 'SRE Analyst'}</div>
            </div>

            <button
              onClick={logout}
              title="Log out of AIOps Studio"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 text-slate-400 hover:text-rose-300 text-xs transition-colors ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-medium">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
