import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Incident } from '../lib/types';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = async () => {
    try {
      const data = await api.getIncidents();
      setIncidents(data || []);
    } catch (err) {
      console.error('Error fetching incidents:', err);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent-blue" />
            <span>Root Cause Analysis (RCA) Incident Studio</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full history of diagnosed microservice outages with generated Markdown reports and telemetry.
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

      <IncidentTable incidents={incidents} onRefresh={fetchIncidents} />
    </div>
  );
};

