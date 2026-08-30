import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Incident } from '../../lib/types';
import { formatDate, formatLatency, getSeverityBadge, getStatusBadge } from '../../lib/utils';
import { AlertTriangle, Clock, ArrowRight, Search, Filter } from 'lucide-react';

interface IncidentTableProps {
  incidents: Incident[];
  onRefresh?: () => void;
}

export const IncidentTable: React.FC<IncidentTableProps> = ({ incidents }) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      search === '' ||
      inc.service?.toLowerCase().includes(search.toLowerCase()) ||
      inc.incident_summary?.toLowerCase().includes(search.toLowerCase()) ||
      inc.detected_exception?.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || inc.severity?.toLowerCase() === severityFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || inc.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-border flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0a0f1d]/50">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by summary, service, or exception..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-accent-blue/50"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-accent-blue/50"
          >
            <option value="all">All Statuses</option>
            <option value="investigating">Investigating</option>
            <option value="mitigating">Mitigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-[#0a0f1d] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-3 px-4">Detected At</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Service</th>
              <th className="py-3 px-4">Exception & Summary</th>
              <th className="py-3 px-4">MTTD</th>
              <th className="py-3 px-4 text-right">RCA Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No incidents diagnosed yet. Trigger a simulated outage to watch the AI agents in action!
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-surface-hover/50 transition-colors group">
                  <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                    {formatDate(inc.created_at)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getSeverityBadge(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${getStatusBadge(inc.status)}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                    {inc.service}
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    <div className="font-semibold text-rose-300 font-mono text-[11px] mb-0.5">
                      {inc.detected_exception}
                    </div>
                    <div className="text-slate-300 line-clamp-1 text-xs">
                      {inc.incident_summary}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{formatLatency((inc.mttd_seconds || 5.0) * 1000)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded bg-accent-blue/15 hover:bg-accent-blue/25 text-blue-300 font-medium text-xs border border-accent-blue/30 transition-all group-hover:glow-blue"
                    >
                      <span>Investigate</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
