import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Terminal,
  Server,
  ShieldCheck,
  Award,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Command Center', icon: Activity },
  { path: '/incidents', label: 'Incident RCA Studio', icon: AlertTriangle },
  { path: '/logs', label: 'Live Log Drain', icon: Terminal },
  { path: '/services', label: 'Service Registry', icon: Server },
  { path: '/security', label: 'Security & Guardrails', icon: ShieldCheck },
  { path: '/benchmarks', label: '4-Tier Benchmarks', icon: Award },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-border gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
          <Zap className="w-5 h-5 fill-accent-blue/20" />
        </div>
        <div>
          <h1 className="font-bold text-sm text-slate-100 tracking-tight flex items-center gap-1.5">
            AIOps Agent <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue font-mono font-medium">SRE</span>
          </h1>
          <p className="text-[11px] text-slate-400">Incident Response Platform</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-accent-blue/15 text-blue-400 border border-accent-blue/25 glow-blue'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/70'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Model & Persistence Badges */}
      <div className="p-4 border-t border-border bg-[#0a0f1d]/50 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">LLM Engine</span>
          <span className="font-mono text-emerald-400 font-medium">Groq (GPT-OSS-120B)</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Persistence</span>
          <span className="font-mono text-cyan-400 font-medium">Supabase PostgreSQL</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">ML Gatekeeper</span>
          <span className="font-mono text-amber-400 font-medium">TF-IDF + LogReg</span>
        </div>
      </div>
    </aside>
  );
};

