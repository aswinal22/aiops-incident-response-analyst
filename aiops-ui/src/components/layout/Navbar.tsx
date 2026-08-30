import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { HealthStatus } from '../../lib/types';
import { ShieldCheck, Database, Cpu, Radio, Sparkles } from 'lucide-react';

interface NavbarProps {
  onSimulateClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSimulateClick }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-surface/80 backdrop-blur border-b border-border px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Environment Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {isOnline ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
          </span>
          <span className="text-xs font-semibold text-slate-200">
            {isOnline ? 'AIOps Engine Active' : 'Connecting to Engine...'}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-800/40 px-2.5 py-1 rounded border border-slate-700/50">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>ML: <strong className="text-slate-200 font-mono">TF-IDF Active</strong></span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/40 px-2.5 py-1 rounded border border-slate-700/50">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>DB: <strong className="text-slate-200 font-mono">Supabase</strong></span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/40 px-2.5 py-1 rounded border border-slate-700/50">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Guardrails: <strong className="text-slate-200 font-mono">5-Layer L1-L5</strong></span>
          </div>
        </div>
      </div>

      {/* Right: Trigger Simulation & Buffer Counter */}
      <div className="flex items-center gap-3">
        {health && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
            <Radio className="w-3 h-3 text-accent-blue animate-pulse" />
            <span>Buffer: <strong className="text-blue-400">{health.buffer_size}</strong> logs</span>
          </div>
        )}

        {onSimulateClick && (
          <button
            onClick={onSimulateClick}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all glow-rose"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            Simulate Outage
          </button>
        )}
      </div>
    </header>
  );
};
