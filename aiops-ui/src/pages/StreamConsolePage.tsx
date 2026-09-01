import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Incident } from '../lib/types';
import { ActiveStreamHeader } from '../components/stream/ActiveStreamHeader';
import { LiveLogViewer } from '../components/logs/LiveLogViewer';
import { SimulationControls } from '../components/logs/SimulationControls';
import { MetricCards } from '../components/dashboard/MetricCards';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { Terminal, ShieldCheck, Cpu, AlertOctagon, RefreshCw } from 'lucide-react';

export const StreamConsolePage: React.FC = () => {
  const { activeProject, activeService } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  const activeServiceName = activeService?.name;

  const fetchIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const data = await api.getIncidents(activeServiceName);
      setIncidents(data || []);
    } catch (err) {
      console.error('Error fetching stream incidents:', err);
    } finally {
      setLoadingIncidents(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, [activeServiceName]);

  return (
    <div className="space-y-6">
      {/* Active Project & Service Stream Header */}
      <ActiveStreamHeader />

      {/* Top Metrics Row */}
      <MetricCards incidents={incidents} />

      {/* Live Stream Error Simulation Bar */}
      <SimulationControls onSuccess={fetchIncidents} />

      {/* Main Terminal Stdout Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-blue" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              Live Ingestion Log Drain
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Layer 2 PII Scrubbing Active</span>
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>Scikit-Learn Gatekeeper</span>
            </span>
          </div>
        </div>

        <LiveLogViewer />
      </div>

      {/* Recent Stream Incidents */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-slate-200 font-mono">
              24/7 Outage History & RCA Reports ({incidents.length})
            </h3>
          </div>

          <button
            onClick={fetchIncidents}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-slate-400 text-xs border border-border"
          >
            <RefreshCw className={`w-3 h-3 ${loadingIncidents ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <IncidentTable incidents={incidents} />
      </div>
    </div>
  );
};
