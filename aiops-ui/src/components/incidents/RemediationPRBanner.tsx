import React, { useState } from 'react';
import { GitPullRequest, ExternalLink, Copy, Check, GitBranch, Eye, Sparkles, RefreshCw, FolderGit2 } from 'lucide-react';

interface RemediationPRBannerProps {
  prUrl: string;
  branch?: string;
  repoUrl?: string;
  serviceName?: string;
  faultyFile?: string;
  onViewDetails: () => void;
  onCreatePR?: () => void;
  isCreatingPR?: boolean;
}

export const RemediationPRBanner: React.FC<RemediationPRBannerProps> = ({
  prUrl,
  branch,
  repoUrl = 'https://github.com/aswinal22/aiops-incident-response-analyst',
  serviceName,
  faultyFile,
  onViewDetails,
  onCreatePR,
  isCreatingPR = false,
}) => {
  const [copied, setCopied] = useState(false);

  const effectiveBranch = branch || (prUrl && prUrl.includes('...') ? prUrl.split('...')[1]?.split('?')[0] : 'fix/aiops-remediation');
  const isDirectPR = prUrl && prUrl.includes('/pull/');

  const copyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(prUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1b1035] via-[#121633] to-[#0d1c2e] border-2 border-purple-500/60 shadow-2xl shadow-purple-950/50 p-4 sm:p-5 transition-all">
      {/* Subtle background glow effect */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left info */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 border border-purple-400/50 flex items-center justify-center text-purple-300 shadow-inner shrink-0">
            <GitPullRequest className="w-5 h-5 animate-pulse text-purple-200" />
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Autonomous Remediation Pull Request</span>
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {isDirectPR ? 'PR Active on GitHub' : 'PR Ready to Review'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 font-mono">
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-blue-300 hover:text-blue-200 hover:underline transition-colors"
              >
                <FolderGit2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{repoUrl.replace('https://github.com/', '')}</span>
              </a>

              <span className="flex items-center gap-1 text-[11px] text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                <span>{effectiveBranch}</span>
              </span>

              {faultyFile && (
                <span className="text-slate-400 text-[11px]">
                  • Patched File: <span className="text-slate-200 font-semibold">{faultyFile}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto justify-start lg:justify-end pt-1 lg:pt-0">
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Link'}</span>
          </button>

          <button
            type="button"
            onClick={onViewDetails}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 text-xs font-bold border border-purple-500/50 shadow-sm transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>PR Summary Pop-up</span>
          </button>

          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-purple-950/60 transition-all transform hover:scale-[1.02]"
          >
            <span>Open Pull Request on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
