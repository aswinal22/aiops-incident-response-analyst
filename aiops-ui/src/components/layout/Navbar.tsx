import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { HealthStatus } from '../../lib/types';
import { Zap, Github, Server, LogOut, ChevronDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StreamSelectorModal } from '../stream/StreamSelectorModal';

export const Navbar: React.FC = () => {
  const { user, activeStream, logout } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

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
    <>
      <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue glow-blue">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-xs tracking-wide text-slate-100 uppercase font-mono block">
                AIOps SRE Platform
              </span>
              <span className="text-[10px] text-slate-400 font-mono -mt-0.5 block">
                Autonomous Incident Response
              </span>
            </div>
          </div>

          {/* Active Stream Pill / Switcher */}
          <div className="hidden sm:flex items-center">
            <button
              onClick={() => setIsSelectorOpen(true)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#090d16] hover:bg-slate-800/80 border border-slate-800 text-xs font-mono text-slate-300 transition-all"
            >
              <Server className="w-3.5 h-3.5 text-accent-blue" />
              <span className="text-slate-500">Stream:</span>
              <span className="text-slate-200 font-semibold truncate max-w-[140px]">
                {activeStream ? activeStream.name : 'Select Stream'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Status Indicators & User Profile */}
        <div className="flex items-center gap-3">
          {/* Engine Health Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border bg-slate-900/60 border-border">
            {health?.status === 'ok' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-emerald-400 font-medium">AIOps Engine Active</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-amber-400 font-medium">Connecting...</span>
              </>
            )}
          </div>

          {/* GitHub User Profile */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-7 h-7 rounded-full border border-slate-700 object-cover"
              />
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-none">{user.name || user.login}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">@{user.login}</div>
              </div>

              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <StreamSelectorModal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} />
    </>
  );
};
