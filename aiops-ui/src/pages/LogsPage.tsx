import React from 'react';
import { LiveLogViewer } from '../components/logs/LiveLogViewer';
import { SimulationControls } from '../components/logs/SimulationControls';
import { Terminal } from 'lucide-react';

export const LogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent-blue" />
            <span>Live Microservice Stdout Log Drain</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time stdout log ingestion stream with Scikit-Learn microsecond anomaly classification and PII redaction.
          </p>
        </div>
      </div>

      <SimulationControls />

      <LiveLogViewer />
    </div>
  );
};
