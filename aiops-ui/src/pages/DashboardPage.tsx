import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Incident } from '../lib/types';
import { MetricCards } from '../components/dashboard/MetricCards';
import { IncidentTrendChart } from '../components/dashboard/IncidentTrendChart';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { SimulationControls } from '../components/logs/SimulationControls';
import { Activity, RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const data = await api.getIncidents();
      setIncidents(data || []);
    } catch (err) {
      console.error('Error loading incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-accent-blue" />
            <span>Incident Command Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time observability, autonomous LangGraph root cause analysis, and microservice triage.
          </p>
        </div>

        <button
          onClick={fetchIncidents}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs font-medium border border-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <MetricCards incidents={incidents} />

      {/* Simulation Controls */}
      <SimulationControls onSuccess={fetchIncidents} />

      {/* Charts & Graphs */}
      <IncidentTrendChart incidents={incidents} />

      {/* Live Incidents Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-200">Recent Outages & AI Investigations</h2>
        <IncidentTable incidents={incidents} onRefresh={fetchIncidents} />
      </div>
    </div>
  );
};

