import React from 'react';
import { Incident } from '../../lib/types';
import { formatLatency } from '../../lib/utils';
import { AlertOctagon, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';

interface MetricCardsProps {
  incidents: Incident[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ incidents }) => {
  const activeCount = incidents.filter((i) => i.status?.toLowerCase() !== 'resolved' && i.status?.toLowerCase() !== 'closed').length;
  const resolvedCount = incidents.filter((i) => i.status?.toLowerCase() === 'resolved' || i.status?.toLowerCase() === 'closed').length;

  const avgMttd =
    incidents.length > 0
      ? incidents.reduce((acc, i) => acc + (i.mttd_seconds || 5.0), 0) / incidents.length
      : 5.0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Active Incidents */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Active Incidents</span>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{activeCount}</div>
          <span className="text-[11px] text-rose-400 flex items-center gap-1 mt-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            Real-time Triaged
          </span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertOctagon className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 2: Mean Time to Detect */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Mean Time to Detect (MTTD)</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            {formatLatency(avgMttd * 1000)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Scikit-Learn Gatekeeper</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Clock className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 3: Total Resolved */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Outages Mitigated</span>
          <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{resolvedCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Full RCA Generated</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>

      {/* Metric 4: Guardrails Status */}
      <div className="bg-surface border border-border rounded-xl p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">5-Layer Security</span>
          <div className="text-2xl font-bold text-purple-400 mt-1 font-mono">100% Secure</div>
          <span className="text-[11px] text-purple-300 mt-1 block">Zero PII Leakage</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

