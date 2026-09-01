import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GitBranch, Server, Copy, Check, ChevronDown, ExternalLink, Activity } from 'lucide-react';

interface ActiveStreamHeaderProps {
  onOpenSelector: () => void;
}

export const ActiveStreamHeader: React.FC<ActiveStreamHeaderProps> = ({ onOpenSelector }) => {
  const { activeStream } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!activeStream) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200">No Log Stream Selected</h3>
            <p className="text-[11px] text-slate-400">Select a repository or paste a log drain URL to start monitoring</p>
          </div>
        </div>
        <button
          onClick={onOpenSelector}
          className="px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue"
        >
          Select Stream
        </button>
      </div>
    );
  }

  const drainUrl = `${window.location.origin}${activeStream.log_drain_url}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(drainUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Stream Identity */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold font-mono text-sm shrink-0">
          <Activity className="w-5 h-5 text-accent-blue animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
              Active Stream
            </span>
            <h2 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-1.5">
              {activeStream.name}
            </h2>
            <button
              onClick={onOpenSelector}
              className="inline-flex items-center gap-1 text-[11px] text-accent-blue hover:text-blue-300 font-medium px-2 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 transition-colors"
            >
              <span>Switch</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
            {activeStream.repo_url && (
              <a
                href={activeStream.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-purple-300 hover:underline"
              >
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  {activeStream.repo_owner}/{activeStream.repo_name}
                </span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Monitoring
            </span>
          </div>
        </div>
      </div>

      {/* Webhook Drain Copier */}
      <div className="flex items-center gap-2 bg-[#090d16] border border-slate-800 p-2 rounded-lg font-mono text-xs max-w-md w-full md:w-auto">
        <span className="text-slate-500 text-[11px] shrink-0">Webhook:</span>
        <span className="text-slate-300 text-[11px] truncate flex-1">{activeStream.log_drain_url}</span>
        <button
          onClick={copyUrl}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[10px] flex items-center gap-1 px-1.5"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};
