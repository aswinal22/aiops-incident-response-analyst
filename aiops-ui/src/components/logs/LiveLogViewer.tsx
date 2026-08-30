import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { LogEntry } from '../../lib/types';
import { Terminal, Shield, AlertOctagon, Pause, Play, Trash2, Search, Filter } from 'lucide-react';

interface LiveLogViewerProps {
  onSimulateError?: (type: string) => void;
}

export const LiveLogViewer: React.FC<LiveLogViewerProps> = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Poll /buffer every 2 seconds
  useEffect(() => {
    if (isPaused) return;

    const fetchLogs = async () => {
      try {
        const res = await api.getBuffer(150);
        if (res?.logs) {
          setLogs(res.logs);
        }
      } catch (err) {
        console.error('Error fetching log buffer:', err);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesQuery =
      filterQuery === '' ||
      log.message?.toLowerCase().includes(filterQuery.toLowerCase()) ||
      log.service?.toLowerCase().includes(filterQuery.toLowerCase());

    const matchesService = selectedService === 'all' || log.service === selectedService;
    return matchesQuery && matchesService;
  });

  const availableServices = Array.from(new Set(logs.map((l) => l.service).filter(Boolean)));

  const containsRedaction = (msg?: string) => msg && msg.includes('[REDACTED_');

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] bg-[#070b14] border border-border rounded-xl overflow-hidden shadow-2xl">
      {/* Terminal Toolbar */}
      <div className="h-12 bg-surface border-b border-border px-4 flex items-center justify-between gap-3 text-xs shrink-0">
        {/* Left: Window Dots & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600"></div>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-slate-300 font-medium">
            <Terminal className="w-4 h-4 text-accent-blue" />
            <span>Stdout Log Drain Stream</span>
          </div>
        </div>

        {/* Middle: Search & Filter */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stream / traceback / PII tokens..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-slate-800 rounded-md pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="bg-[#0a0f1d] border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-accent-blue/50 font-mono"
            >
              <option value="all">All Services</option>
              {availableServices.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
              isPaused
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-all ${
              autoScroll
                ? 'bg-accent-blue/15 text-blue-300 border-accent-blue/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Auto-Scroll
          </button>

          <button
            onClick={() => setLogs([])}
            title="Clear Buffer View"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content Body */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-[#060a12]">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <Terminal className="w-8 h-8 opacity-30 animate-pulse" />
            <p>Waiting for microservice stdout logs...</p>
            <p className="text-[11px] text-slate-600">
              Logs drained via <code className="text-blue-400">POST /ingest-logs</code> will appear here in real time.
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isAnomaly =
              log.is_anomaly ||
              log.message?.includes('ERROR') ||
              log.message?.includes('Exception') ||
              log.message?.includes('Traceback') ||
              log.message?.includes('Simulated Application Failure');

            const hasRedaction = containsRedaction(log.message);

            return (
              <div
                key={index}
                className={`p-2 rounded border transition-all flex flex-col gap-1 ${
                  isAnomaly
                    ? 'bg-rose-950/20 border-rose-800/40 text-rose-200 glow-rose'
                    : 'bg-slate-900/30 border-transparent hover:border-slate-800/60 text-slate-300'
                }`}
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 select-none pb-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{log.timestamp || new Date().toISOString()}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-blue-300 font-semibold">
                      {log.service || 'target-app'}
                    </span>
                    {isAnomaly && (
                      <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                        <AlertOctagon className="w-3 h-3" />
                        ML ANOMALY (CLASS 1)
                      </span>
                    )}
                    {hasRedaction && (
                      <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Shield className="w-3 h-3" />
                        L2 PII REDACTED
                      </span>
                    )}
                  </div>
                </div>

                {/* Log Line Text */}
                <div className="whitespace-pre-wrap break-all leading-relaxed pl-1 font-mono">
                  {log.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

