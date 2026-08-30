import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Incident } from '../lib/types';
import { formatDate, formatLatency, getSeverityBadge, getStatusBadge } from '../lib/utils';
import { RCAMarkdown } from '../components/incidents/RCAMarkdown';
import { RemediationActionCenter } from '../components/incidents/RemediationActionCenter';
import { AgentTraceWaterfall } from '../components/incidents/AgentTraceWaterfall';
import { ArrowLeft, Clock, Server, FileCode, AlertOctagon, RefreshCw } from 'lucide-react';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIncident = async () => {
    if (!id) return;
    try {
      const data = await api.getIncidentById(id);
      setIncident(data);
    } catch (err) {
      console.error('Error fetching incident detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-accent-blue" />
        Loading Incident RCA Report & Telemetry...
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl space-y-3">
        <h2 className="text-sm font-bold text-rose-400">Incident Not Found</h2>
        <p className="text-xs text-slate-400">Could not locate incident record with ID: {id}</p>
        <Link to="/incidents" className="inline-block text-xs text-accent-blue hover:underline">
          &larr; Back to Incidents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Incidents</span>
        </Link>

        <button
          onClick={fetchIncident}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs border border-border"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Incident Hero Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded border text-xs font-semibold ${getSeverityBadge(incident.severity)}`}>
                {incident.severity}
              </span>
              <span className={`px-2.5 py-0.5 rounded border text-xs font-medium ${getStatusBadge(incident.status)}`}>
                {incident.status}
              </span>
              <span className="text-xs font-mono text-slate-400">ID: {incident.id}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-100 mt-1">
              {incident.incident_summary || incident.detected_exception}
            </h1>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono pt-1">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">Service</span>
              <strong className="text-slate-200">{incident.service}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">Exception</span>
              <strong className="text-rose-300">{incident.detected_exception}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">Faulty File</span>
              <strong className="text-slate-300">{incident.faulty_file}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">MTTD / Created</span>
              <strong className="text-emerald-400">{formatDate(incident.created_at)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: RCA Markdown Report + Remediation Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 5-Section RCA Markdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-lg">
            <RCAMarkdown content={incident.rca_report_markdown} />
          </div>

          {/* Agent Trace Latency Waterfall */}
          <AgentTraceWaterfall traces={incident.traces} />
        </div>

        {/* Right 1 Col: Interactive Remediation & Status Updates */}
        <div className="space-y-6">
          <RemediationActionCenter
            incidentId={incident.id}
            immediateFixes={incident.immediate_fixes}
            longTermPrevention={incident.long_term_prevention}
            currentStatus={incident.status}
            onUpdate={fetchIncident}
          />
        </div>
      </div>
    </div>
  );
};

