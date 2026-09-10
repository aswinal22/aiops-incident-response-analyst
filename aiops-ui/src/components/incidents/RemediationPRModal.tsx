import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GitPullRequest, ExternalLink, Copy, Check, X, GitBranch, FileCode, CheckCircle2, ShieldCheck, Sparkles, FolderGit2 } from 'lucide-react';

interface RemediationPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  prUrl: string;
  branch?: string;
  repoUrl?: string;
  serviceName?: string;
  faultyFile?: string;
  incidentSummary?: string;
  immediateFixes?: Array<{ task: string; done?: boolean }>;
}

const cleanTaskText = (text: string): string => {
  if (!text) return '';
  return text.replace(/^(\d+[\.\)]\s*|\-\s+|\*\s+)/, '').trim();
};

export const RemediationPRModal: React.FC<RemediationPRModalProps> = ({
  isOpen,
  onClose,
  prUrl,
  branch,
  repoUrl = 'https://github.com/aswinal22/aiops-incident-response-analyst',
  serviceName,
  faultyFile,
  incidentSummary,
  immediateFixes = [],
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedBranch, setCopiedBranch] = useState(false);

  if (!isOpen || !prUrl) return null;

  const effectiveBranch = branch || (prUrl.includes('...') ? prUrl.split('...')[1]?.split('?')[0] : 'fix/aiops-remediation');

  const copyToClipboard = (text: string, type: 'url' | 'branch') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedBranch(true);
      setTimeout(() => setCopiedBranch(false), 2000);
    }
  };

  // Filter and clean immediate fixes for preview
  const validFixes = immediateFixes
    .filter((f) => {
      if (!f || typeof f.task !== 'string') return false;
      const t = f.task.trim();
      return (
        !t.startsWith('```') &&
        !t.startsWith('|') &&
        !t.startsWith('POOL =') &&
        !t.startsWith('timeout=') &&
        !t.startsWith('dsn=') &&
        t.length > 3
      );
    })
    .slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-purple-500/50 rounded-2xl max-w-xl w-full p-6 shadow-2xl shadow-purple-950/70 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
              <GitPullRequest className="w-5 h-5 animate-pulse text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">Autonomous Remediation PR</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span>Target Service:</span>
                <span className="text-purple-300 font-mono font-medium">{serviceName || 'target-app'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Banner */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-emerald-950/20 border border-purple-500/30 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Remediation Branch & PR Created Successfully</span>
          </div>
          <p className="text-[11px] text-slate-300 pl-6 leading-relaxed">
            The AI code investigator synthesized a targeted fix patch, generated a clean Git branch, and populated the PR with the complete 5-section RCA report.
          </p>
        </div>

        {/* PR Details Grid */}
        <div className="space-y-2.5 text-xs font-mono">
          {/* Branch Row */}
          <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">Branch:</span>
              <span className="text-purple-300 font-bold truncate text-[11px]">{effectiveBranch}</span>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(effectiveBranch, 'branch')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 shrink-0 transition-colors"
            >
              {copiedBranch ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedBranch ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Faulty File Row */}
          {faultyFile && (
            <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Patched File:</span>
                <span className="text-slate-200 font-bold truncate text-[11px]">{faultyFile}</span>
              </div>
            </div>
          )}

          {/* PR URL Direct Box */}
          <div className="p-3 rounded-lg bg-[#0b101c] border border-purple-500/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300">GitHub Pull Request URL:</span>
              <button
                type="button"
                onClick={() => copyToClipboard(prUrl, 'url')}
                className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-purple-100 transition-colors"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? 'Copied Link' : 'Copy Link'}</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-300 break-all font-mono select-all bg-slate-900/90 p-2.5 rounded border border-slate-800 leading-relaxed">
              {prUrl}
            </div>
          </div>
        </div>

        {/* Fix Preview with Rich ReactMarkdown */}
        {validFixes.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-purple-300">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Included Fix Highlights:</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2 text-xs text-slate-300 pr-1">
              {validFixes.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-[11px] leading-relaxed p-2.5 rounded-lg bg-surface-elevated/90 border border-border"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <span className="inline">{children}</span>,
                        strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded bg-slate-900 text-purple-300 font-mono text-[10px] border border-purple-500/20">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {cleanTaskText(f.task)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-surface-hover border border-border transition-colors"
          >
            Close
          </button>

          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-purple-950/60 transition-all transform hover:scale-[1.02]"
          >
            <span>Open Pull Request on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
