import React, { useState } from 'react';
import { api } from '../../lib/api';
import { CheckSquare, Square, ShieldAlert, Sparkles, CheckCircle2, GitPullRequest, ExternalLink, GitBranch, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface RemediationActionCenterProps {
  incidentId: string;
  immediateFixes?: Array<{ task: string; done: boolean }>;
  longTermPrevention?: Array<{ recommendation: string; details?: string; done?: boolean }>;
  currentStatus: string;
  prUrl?: string;
  faultyFile?: string;
  serviceName?: string;
  onUpdate?: () => void;
}

export const RemediationActionCenter: React.FC<RemediationActionCenterProps> = ({
  incidentId,
  immediateFixes = [],
  longTermPrevention = [],
  currentStatus,
  prUrl,
  faultyFile,
  serviceName,
  onUpdate,
}) => {
  const [fixes, setFixes] = useState(immediateFixes);
  const [prevention, setPrevention] = useState(longTermPrevention);
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  // GitHub PR creation states
  const [creatingPr, setCreatingPr] = useState(false);
  const [activePrUrl, setActivePrUrl] = useState<string | null>(prUrl || null);
  const [prBranch, setPrBranch] = useState<string | null>(null);
  const [prSuccessMsg, setPrSuccessMsg] = useState<string | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  const handleCreatePR = async () => {
    setCreatingPr(true);
    setPrError(null);
    setPrSuccessMsg(null);
    try {
      const res = await api.createRemediationPR(incidentId);
      if (res.pr_url) {
        setActivePrUrl(res.pr_url);
        if (res.branch) setPrBranch(res.branch);
        setPrSuccessMsg(res.message || 'Remediation Pull Request opened successfully.');
      }
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setPrError(err.message || 'Failed to generate remediation Pull Request.');
    } finally {
      setCreatingPr(false);
    }
  };

  const toggleImmediateFix = async (index: number) => {
    const updated = fixes.map((f, i) => (i === index ? { ...f, done: !f.done } : f));
    setFixes(updated);
    await syncToBackend(updated, prevention, status);
  };

  const togglePrevention = async (index: number) => {
    const updated = prevention.map((p, i) => (i === index ? { ...p, done: !p.done } : p));
    setPrevention(updated);
    await syncToBackend(fixes, updated, status);
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    await syncToBackend(fixes, prevention, newStatus);
  };

  const syncToBackend = async (
    newFixes: typeof fixes,
    newPrevention: typeof prevention,
    newStatus: string
  ) => {
    setSaving(true);
    try {
      await api.updateIncident(incidentId, {
        status: newStatus,
        immediate_fixes: newFixes,
        long_term_prevention: newPrevention,
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error saving remediation state:', err);
    } finally {
      setSaving(false);
    }
  };

  const completedCount = fixes.filter((f) => f.done).length + prevention.filter((p) => p.done).length;
  const totalCount = fixes.length + prevention.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-lg space-y-5">
      {/* Header & Status Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-accent-blue" />
            <span>Interactive Remediation Action Center</span>
          </h3>
          <p className="text-xs text-slate-400">
            Check off fixes as your team mitigates this outage (saved automatically in real-time).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Incident Status:</span>
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={saving}
            className="bg-surface-elevated border border-border rounded-lg px-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-accent-blue font-semibold"
          >
            <option value="Investigating">Investigating</option>
            <option value="Mitigating">Mitigating</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Remediation Progress:</span>
            <span className="text-emerald-400 font-bold">
              {completedCount}/{totalCount} Completed ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Immediate Fixes Checklist */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Immediate Fixes (P0 / P1)</span>
        </h4>
        {fixes.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No explicit immediate tasks defined.</p>
        ) : (
          <div className="space-y-1.5">
            {fixes.map((fix, idx) => (
              <div
                key={idx}
                onClick={() => toggleImmediateFix(idx)}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer select-none transition-all ${
                  fix.done
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400 line-through'
                    : 'bg-surface-elevated hover:bg-surface-hover border-border text-slate-200'
                }`}
              >
                {fix.done ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <span className="text-xs leading-relaxed">{fix.task}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Long-Term Prevention Checklist */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Long-Term Prevention & Hardening</span>
        </h4>
        {prevention.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No long-term prevention tasks defined.</p>
        ) : (
          <div className="space-y-1.5">
            {prevention.map((item, idx) => (
              <div
                key={idx}
                onClick={() => togglePrevention(idx)}
                className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer select-none transition-all ${
                  item.done
                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400 line-through'
                    : 'bg-surface-elevated hover:bg-surface-hover border-border text-slate-200'
                }`}
              >
                {item.done ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="text-xs leading-relaxed">
                  <strong>{item.recommendation}</strong>
                  {item.details && <p className="text-[11px] text-slate-400 mt-0.5">{item.details}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Autonomous GitHub Pull Request Creator (Level 4 AIOps) */}
      <div className="pt-2 border-t border-border">
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#0c1324] via-[#091122] to-[#140f2b] border border-accent-blue/30 shadow-lg space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                  <span>Autonomous Remediation PR</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">Level 4 AIOps</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Generate code patch for <code className="text-purple-300">{faultyFile || 'faulty file'}</code> and open a GitHub Pull Request with RCA report.
                </p>
              </div>
            </div>
          </div>

          {prError && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{prError}</span>
            </div>
          )}

          {activePrUrl ? (
            <div className="space-y-2 pt-1">
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate font-mono text-[11px]">{prSuccessMsg || 'Pull Request Ready'}</span>
                </div>
                {prBranch && (
                  <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded">
                    <GitBranch className="w-3 h-3 text-purple-400" />
                    {prBranch}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={activePrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all font-mono"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>View Pull Request on GitHub</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>

                <button
                  type="button"
                  onClick={handleCreatePR}
                  disabled={creatingPr}
                  title="Re-generate and update PR"
                  className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${creatingPr ? 'animate-spin text-accent-blue' : ''}`} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreatePR}
              disabled={creatingPr}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg glow-blue transition-all disabled:opacity-50 font-mono"
            >
              {creatingPr ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Code Patch & Opening PR...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🚀 Create GitHub Remediation PR</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

