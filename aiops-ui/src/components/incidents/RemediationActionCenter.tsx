import React, { useState } from 'react';
import { api } from '../../lib/api';
import { CheckSquare, Square, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

interface RemediationActionCenterProps {
  incidentId: string;
  immediateFixes?: Array<{ task: string; done: boolean }>;
  longTermPrevention?: Array<{ recommendation: string; details?: string; done?: boolean }>;
  currentStatus: string;
  onUpdate?: () => void;
}

export const RemediationActionCenter: React.FC<RemediationActionCenterProps> = ({
  incidentId,
  immediateFixes = [],
  longTermPrevention = [],
  currentStatus,
  onUpdate,
}) => {
  const [fixes, setFixes] = useState(immediateFixes);
  const [prevention, setPrevention] = useState(longTermPrevention);
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

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
            Check off fixes as your SRE team mitigates this outage (persisted to Supabase).
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
    </div>
  );
};
