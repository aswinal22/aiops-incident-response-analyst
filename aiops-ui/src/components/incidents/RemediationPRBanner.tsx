import React, { useState } from 'react';
import { GitPullRequest, ExternalLink, Copy, Check, GitBranch, Eye } from 'lucide-react';

interface RemediationPRBannerProps {
  prUrl: string;
  branch?: string;
  serviceName?: string;
  faultyFile?: string;
  onViewDetails: () => void;
}

export const RemediationPRBanner: React.FC<RemediationPRBannerProps> = ({
  prUrl,
  branch,
  serviceName,
  faultyFile,
  onViewDetails,
}) => {
  const [copied, setCopied] = useState(false);

  if (!prUrl) return null;

  const effectiveBranch = branch || (prUrl.includes('...') ? prUrl.split('...')[1]?.split('?')[0] : 'fix/aiops-remediation');

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#170e30] via-[#10142b] to-[#0a1828] border-2 border-purple-500/50 shadow-xl shadow-purple-950/40 p-4 transition-all">
      {/* Subtle background glow effect */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-indigo-500/15 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner shrink-0">
            <GitPullRequest className="w-5 h-5 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Autonomous Remediation Pull Request Ready</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Active on GitHub
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-mono">
              <span className="flex items-center gap-1 text-[11px] text-purple-300">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>{effectiveBranch}</span>
              </span>
              {faultyFile && (
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  • Target: <span className="text-slate-200">{faultyFile}</span>
                </span>
              )}
              {serviceName && (
                <span className="text-slate-400 text-[11px] hidden md:inline">
                  • Service: <span className="text-slate-200">{serviceName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
          </button>

          <button
            onClick={onViewDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 text-xs font-semibold border border-purple-500/40 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Summary</span>
          </button>

          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-purple-950/50 transition-all transform hover:scale-[1.02]"
          >
            <span>Open on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
