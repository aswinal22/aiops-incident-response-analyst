import React from 'react';
import { ShieldCheck, Lock, Terminal, FileCode, CheckCircle2, ShieldAlert } from 'lucide-react';

export const SecurityAuditView: React.FC = () => {
  const securityLayers = [
    {
      layer: 'Layer 1',
      name: 'Ingress Rate Limiter',
      module: 'aiops-engine/main.py (SlowAPI)',
      spec: '50 requests/minute per client IP',
      description: 'Eliminates Denial-of-Wallet attacks and LLM endpoint flooding by enforcing token bucket rate limiting on /ingest-logs.',
      status: 'Active (HTTP 429 Enforced)',
      icon: ShieldCheck,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
      layer: 'Layer 2',
      name: 'PII & Secret Redactor (Input Guardrail)',
      module: 'aiops-engine/utils/security.py',
      spec: 'Pre-compiled Regex Engine (8 Pattern Groups)',
      description: 'Scrubs AWS keys, JWTs, API tokens, DB passwords in connection URIs, emails, and credit cards before passing to ML or LangGraph.',
      status: 'Active (Zero Input Leakage)',
      icon: Lock,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      layer: 'Layer 3',
      name: 'Prompt Injection Defense & KV Caching',
      module: 'aiops-engine/agents/graph.py',
      spec: '<untrusted_log> Isolation + Static System Prompt',
      description: 'Isolates untrusted logs in strict XML boundaries with explicit negative constraints while enabling Groq KV prompt caching.',
      status: 'Active (Groq Caching Ready)',
      icon: Terminal,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
    {
      layer: 'Layer 4',
      name: 'MCP Sandbox & Sensitive File Blacklist',
      module: 'aiops-engine/mcp_servers/codebase_mcp.py',
      spec: 'Path.resolve().relative_to() + Blacklist',
      description: 'Blocks path traversal attacks (../../../../etc/passwd) and prohibits agent access to .env*, *.pem, *.key, and credentials.',
      status: 'Active (Strict Directory Sandbox)',
      icon: FileCode,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      layer: 'Layer 5',
      name: 'Output Guardrail Secret Scrubber',
      module: 'aiops-engine/agents/graph.py',
      spec: 'sanitize_text() on Final Markdown RCA',
      description: 'Passes the synthesized Root Cause Analysis report through secret sanitization before returning to UI or persisting to DB.',
      status: 'Active (Verified Output)',
      icon: ShieldCheck,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      layer: 'DB Guardrail',
      name: 'AST Read-Only SQL Validator',
      module: 'aiops-engine/utils/security.py (sqlparse)',
      spec: 'SELECT-Only AST & Keyword Blocklist',
      description: 'Parses database query ASTs and blocks DROP, DELETE, INSERT, UPDATE, TRUNCATE, and chained semicolon injection attacks.',
      status: 'Active (Read-Only SELECT)',
      icon: ShieldAlert,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>5-Layer Security Architecture & Guardrail Audit</span>
        </h2>
        <p className="text-xs text-slate-400">
          Defense-in-depth security verification ensuring zero secret leakage, safe MCP tool execution, and prompt isolation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {securityLayers.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <div
              key={idx}
              className="bg-surface border border-border rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${sec.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">{sec.layer}</span>
                    <h3 className="text-xs font-bold text-slate-200">{sec.name}</h3>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  {sec.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{sec.description}</p>

              <div className="bg-[#090d16] p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400 flex flex-col gap-1">
                <div><span className="text-slate-500">Module:</span> <strong className="text-slate-300">{sec.module}</strong></div>
                <div><span className="text-slate-500">Spec:</span> <strong className="text-cyan-400">{sec.spec}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
