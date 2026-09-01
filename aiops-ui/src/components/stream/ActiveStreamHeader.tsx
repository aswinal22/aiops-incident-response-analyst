import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Folder, GitBranch, Server, Copy, Check, ExternalLink, Activity } from 'lucide-react';

export const ActiveStreamHeader: React.FC = () => {
  const { activeProject, activeService } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!activeProject || !activeService) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Folder className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200">No Microservice Stream Selected</h3>
            <p className="text-[11px] text-slate-400">Select a project and scoped microservice to start live monitoring</p>
          </div>
        </div>
        <Link
          to="/projects"
          className="px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue"
        >
          Select or Create Project
        </Link>
      </div>
    );
  }

  const drainUrl = `${window.location.origin}/ingest-logs/${activeService.id || activeService.name}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(drainUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Stream Identity */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold font-mono text-sm shrink-0 glow-blue">
          <Activity className="w-6 h-6 text-accent-blue animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
              Live Monitor
            </span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-100 font-mono">
              <span className="text-accent-blue">{activeProject.name}</span>
              <span className="text-slate-600">/</span>
              <span>{activeService.name}</span>
            </div>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-accent-blue font-medium px-2 py-0.5 rounded bg-surface-elevated border border-border transition-colors ml-1"
            >
              <span>Manage Scopes</span>
            </Link>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
            {activeService.repo_url && (
              <a
                href={activeService.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-purple-300 hover:underline"
              >
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {activeService.repo_owner}/{activeService.repo_name}
                </span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              24/7 Engine Drain Active
            </span>
          </div>
        </div>
      </div>

      {/* Webhook Drain Copier */}
      <div className="flex items-center gap-2 bg-[#090d16] border border-slate-800 p-2 rounded-xl font-mono text-xs max-w-md w-full md:w-auto">
        <span className="text-slate-500 text-[11px] shrink-0">Log Drain:</span>
        <span className="text-slate-300 text-[11px] truncate flex-1">{`/ingest-logs/${activeService.id || activeService.name}`}</span>
        <button
          onClick={copyUrl}
          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[10px] flex items-center gap-1 px-2 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
