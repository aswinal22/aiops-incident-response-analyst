import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Sparkles, FileX, Divide, Database, CheckCircle2, AlertCircle } from 'lucide-react';

interface SimulationControlsProps {
  onSuccess?: () => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({ onSuccess }) => {
  const { activeStream } = useAuth();
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  const activeServiceName = activeStream?.name || 'target-app';

  const triggerSimulatedError = async (type: string, name: string) => {
    setLoadingType(type);
    setFeedback(null);

    try {
      await api.simulateError(type, activeServiceName);
      setFeedback({
        status: 'success',
        message: `Simulated [${name}] anomaly emitted for '${activeServiceName}'! LangGraph RCA workflow triggered in background.`,
      });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFeedback({
        status: 'error',
        message: `Failed to simulate error: ${err.message}`,
      });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Sparkles className="w-4 h-4 text-rose-400" />
          <span>Microservice Outage Simulator</span>
          <span className="text-xs px-2 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 text-accent-blue font-mono font-normal">
            Target: {activeServiceName}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Emits raw error tracebacks to stdout</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Error 1: FileNotFoundError */}
        <button
          onClick={() => triggerSimulatedError('file_not_found', 'FileNotFoundError')}
          disabled={loadingType !== null}
          className="p-3.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border hover:border-rose-500/40 text-left transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-300 font-mono flex items-center gap-1.5">
              <FileX className="w-4 h-4 text-rose-400" />
              FileNotFoundError
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-medium">Config Bug</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Triggers missing <code>/app/config/settings.yaml</code> traceback in {activeServiceName}.
          </p>
          <div className="mt-3 text-[11px] text-rose-400 font-medium group-hover:underline">
            {loadingType === 'file_not_found' ? 'Triggering...' : 'Simulate Outage →'}
          </div>
        </button>

        {/* Error 2: ZeroDivisionError */}
        <button
          onClick={() => triggerSimulatedError('zero_division', 'ZeroDivisionError')}
          disabled={loadingType !== null}
          className="p-3.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border hover:border-amber-500/40 text-left transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-300 font-mono flex items-center gap-1.5">
              <Divide className="w-4 h-4 text-amber-400" />
              ZeroDivisionError
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium">Math Bug</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Triggers unhandled division by zero in metric calculation endpoint.
          </p>
          <div className="mt-3 text-[11px] text-amber-400 font-medium group-hover:underline">
            {loadingType === 'zero_division' ? 'Triggering...' : 'Simulate Outage →'}
          </div>
        </button>

        {/* Error 3: Database Connection Timeout */}
        <button
          onClick={() => triggerSimulatedError('database_timeout', 'DBTimeout')}
          disabled={loadingType !== null}
          className="p-3.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border hover:border-purple-500/40 text-left transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-300 font-mono flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-400" />
              DB Connection Timeout
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">Infra Bug</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Simulates pool exhaustion and postgres connection timeout.
          </p>
          <div className="mt-3 text-[11px] text-purple-400 font-medium group-hover:underline">
            {loadingType === 'database_timeout' ? 'Triggering...' : 'Simulate Outage →'}
          </div>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            feedback.status === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.status === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
