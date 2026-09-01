import React from 'react';
import { NavLink } from 'react-router-dom';
import { Terminal, AlertOctagon, GitBranch, Shield, Activity, Settings, ExternalLink } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Live Stream Console', icon: Terminal },
  { to: '/incidents', label: 'Incident RCA Studio', icon: AlertOctagon },
  { to: '/repos', label: 'Connected Repos', icon: GitBranch },
  { to: '/security', label: '5-Layer Security', icon: Shield },
  { to: '/benchmarks', label: 'Evals & Benchmarks', icon: Activity },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-56 border-r border-border bg-[#070b14]/90 flex flex-col justify-between p-3 shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
      <div className="space-y-1">
        <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Platform Workspace
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-accent-blue/15 text-blue-300 font-semibold border border-accent-blue/30 glow-blue'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-elevated'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-border space-y-2">
        <div className="p-2.5 rounded-xl bg-surface-elevated border border-border/60 text-[11px] font-mono space-y-1">
          <div className="text-slate-400 flex items-center justify-between">
            <span>Model:</span>
            <span className="text-emerald-400 font-semibold">Scikit-Learn ML</span>
          </div>
          <div className="text-slate-400 flex items-center justify-between">
            <span>Agents:</span>
            <span className="text-purple-400 font-semibold">LangGraph Groq</span>
          </div>
        </div>

        <a
          href="https://github.com/aswinal22/aiops-incident-response-analyst"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 py-1 transition-colors"
        >
          <span>AIOps Platform v1.0</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </aside>
  );
};
