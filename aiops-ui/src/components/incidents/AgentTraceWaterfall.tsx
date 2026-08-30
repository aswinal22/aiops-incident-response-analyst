import React from 'react';
import { AgentTrace } from '../../lib/types';
import { formatLatency } from '../../lib/utils';
import { Bot, Code2, Cpu, Wrench } from 'lucide-react';

interface AgentTraceWaterfallProps {
  traces?: AgentTrace[];
}

export const AgentTraceWaterfall: React.FC<AgentTraceWaterfallProps> = ({ traces = [] }) => {
  if (traces.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 text-center text-slate-500 text-xs">
        No agent telemetry traces captured for this incident.
      </div>
    );
  }

  const getNodeIcon = (name: string) => {
    switch (name?.toLowerCase()) {
      case 'log_analyst':
        return <Bot className="w-4 h-4 text-blue-400" />;
      case 'code_investigator':
        return <Code2 className="w-4 h-4 text-purple-400" />;
      case 'rca_synthesizer':
        return <Cpu className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bot className="w-4 h-4 text-slate-400" />;
    }
  };

  const getNodeTitle = (name: string) => {
    switch (name?.toLowerCase()) {
      case 'log_analyst':
        return 'Node 1: Log Analyst Agent';
      case 'code_investigator':
        return 'Node 2: Code Investigator (MCP)';
      case 'rca_synthesizer':
        return 'Node 3: RCA Synthesizer (Groq LLM)';
      default:
        return name;
    }
  };

  const totalLatency = traces.reduce((acc, t) => acc + (t.latency_ms || 0), 0);

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Multi-Agent LangGraph Execution Waterfall</span>
          </h3>
          <p className="text-xs text-slate-400">
            Per-node latency accounting, token consumption, and invoked MCP tools.
          </p>
        </div>
        <div className="text-xs font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
          Total MTTD: <strong className="text-emerald-400">{formatLatency(totalLatency)}</strong>
        </div>
      </div>

      <div className="space-y-3">
        {traces.map((trace) => {
          const percent = totalLatency > 0 ? Math.max(5, Math.round((trace.latency_ms / totalLatency) * 100)) : 100;
          return (
            <div key={trace.id} className="bg-surface-elevated border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  {getNodeIcon(trace.node_name)}
                  <span>{getNodeTitle(trace.node_name)}</span>
                  {trace.model_name && trace.model_name !== 'N/A' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {trace.model_name}
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs font-bold text-slate-300">
                  {formatLatency(trace.latency_ms)}
                </div>
              </div>

              {/* Latency Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Token & Tool Stats */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                <div className="flex items-center gap-3 font-mono">
                  <span>Tokens: In={trace.input_tokens} | Out={trace.output_tokens}</span>
                </div>

                {trace.mcp_tools_invoked && trace.mcp_tools_invoked.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Wrench className="w-3 h-3 text-slate-500" />
                    {trace.mcp_tools_invoked.map((tool, i) => (
                      <span key={i} className="px-1.5 py-0.2 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300 text-[10px] font-mono">
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
