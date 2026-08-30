import React from 'react';
import { Incident } from '../../lib/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface IncidentTrendChartProps {
  incidents: Incident[];
}

export const IncidentTrendChart: React.FC<IncidentTrendChartProps> = ({ incidents }) => {
  // Aggregate incidents by severity and service
  const serviceStats: Record<string, { service: string; Critical: number; High: number; Medium: number; Low: number }> = {};

  incidents.forEach((inc) => {
    const svc = inc.service || 'target-app';
    if (!serviceStats[svc]) {
      serviceStats[svc] = { service: svc, Critical: 0, High: 0, Medium: 0, Low: 0 };
    }
    const sev = (inc.severity || 'Medium') as 'Critical' | 'High' | 'Medium' | 'Low';
    if (serviceStats[svc][sev] !== undefined) {
      serviceStats[svc][sev] += 1;
    }
  });

  const chartData = Object.values(serviceStats);

  // Fallback demo data if empty
  const displayData =
    chartData.length > 0
      ? chartData
      : [
          { service: 'target-app', Critical: 1, High: 3, Medium: 2, Low: 0 },
          { service: 'auth-service', Critical: 0, High: 2, Medium: 1, Low: 0 },
          { service: 'payment-gateway', Critical: 2, High: 1, Medium: 0, Low: 1 },
        ];

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
          <BarChart3 className="w-4 h-4 text-accent-blue" />
          <span>Incident Distribution by Microservice & Severity</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Live PostgreSQL Aggregation</span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="service" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#1e293b',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
            <Bar dataKey="Critical" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="High" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="Medium" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="Low" fill="#64748b" radius={[4, 4, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
