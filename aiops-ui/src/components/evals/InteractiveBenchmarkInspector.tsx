import React, { useState } from 'react';
import { BenchmarkScenario, GOLDEN_BENCHMARK_SCENARIOS } from '../../data/goldenBenchmarks';
import { RCAMarkdown } from '../incidents/RCAMarkdown';
import {
  Cpu,
  Database,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Terminal,
  Activity,
  Award,
  Layers,
  Sparkles,
  GitCommit,
  Zap,
} from 'lucide-react';

export const InteractiveBenchmarkInspector: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<BenchmarkScenario>(GOLDEN_BENCHMARK_SCENARIOS[0]);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3 | 4>(1);
  const [search, setSearch] = useState('');

  const filteredScenarios = GOLDEN_BENCHMARK_SCENARIOS.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.exception_type.toLowerCase().includes(search.toLowerCase()) ||
      s.scenario_id.toLowerCase().includes(search.toLowerCase())
  );

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-400';
      case 'high':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      case 'medium':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      default:
        return 'bg-slate-500/15 border-slate-500/30 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue glow-blue">
            <Award className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
              <span>Interactive 4-Tier Evaluation Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                Log-Driven Inspector
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Select an error log to step through all 4 investigation tiers sequentially to audit, inspect, and validate multi-agent accuracy.
            </p>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Error Logs & Incident Scenarios (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-accent-blue" />
              <span>Error Log Scenarios ({filteredScenarios.length})</span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Search error scenarios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#090d16] border border-border rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
          />

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {filteredScenarios.map((sc) => {
              const isSelected = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    setSelectedScenario(sc);
                    setActiveTier(1);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all space-y-2 ${
                    isSelected
                      ? 'bg-accent-blue/10 border-accent-blue/50 ring-1 ring-accent-blue/30 shadow-lg'
                      : 'bg-surface border-border hover:border-slate-700 hover:bg-surface-elevated'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-accent-blue">{sc.scenario_id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold uppercase ${getSeverityBadge(sc.severity)}`}>
                      {sc.severity}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-100 line-clamp-1">{sc.title}</div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="text-purple-300">[{sc.exception_type}]</span>
                    <span>•</span>
                    <span className="text-slate-400">{sc.service}</span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 line-clamp-1 bg-[#090d16] p-1.5 rounded border border-slate-900">
                    {sc.trigger_log.split('\n')[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive 4-Tier Stepper (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Selected Scenario Header & Tier Stepper Tabs */}
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-accent-blue">{selectedScenario.scenario_id}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-xs font-mono text-purple-300">[{selectedScenario.exception_type}]</span>
                </div>
                <h2 className="text-sm font-bold text-slate-100 font-mono mt-0.5">{selectedScenario.title}</h2>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">
                  Target: <strong className="text-slate-200">{selectedScenario.service}</strong>
                </span>
              </div>
            </div>

            {/* Stepper Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => setActiveTier(1)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeTier === 1
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-md ring-1 ring-cyan-500/30'
                    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tier 1: ML</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Gatekeeper (&lt;1ms)</div>
              </button>

              <button
                onClick={() => setActiveTier(2)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeTier === 2
                    ? 'bg-purple-500/15 border-purple-500/50 text-purple-300 shadow-md ring-1 ring-purple-500/30'
                    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  <span>Tier 2: Tools</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Buffer & MCP Code</div>
              </button>

              <button
                onClick={() => setActiveTier(3)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeTier === 3
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tier 3: RCA</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">LLM Judge (4.9/5)</div>
              </button>

              <button
                onClick={() => setActiveTier(4)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  activeTier === 4
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 shadow-md ring-1 ring-rose-500/30'
                    : 'bg-[#090d16] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Tier 4: Latency</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Pipeline SLAs</div>
              </button>
            </div>
          </div>

          {/* Tier Content Panels */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl min-h-[500px]">
            {/* ============================================================ */}
            {/* TIER 1: ML ANOMALY CLASSIFIER */}
            {/* ============================================================ */}
            {activeTier === 1 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                      Tier 1: ML Anomaly Classifier Gatekeeper
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                    Latency: {selectedScenario.tier1_ml.latency_ms} ms
                  </span>
                </div>

                {/* Raw Input Log */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>1. Ingested Stdout Log Stream:</span>
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3 h-3" />
                      Layer 2 Sanitizer Verified
                    </span>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[#080d1a] border border-slate-800 text-xs font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedScenario.trigger_log}
                  </pre>
                </div>

                {/* ML Inference Metrics Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="bg-[#090d16] border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">PREDICTED CLASS</div>
                    <div className="text-rose-400 font-bold text-sm flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{selectedScenario.tier1_ml.prediction}</span>
                    </div>
                  </div>

                  <div className="bg-[#090d16] border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">ML CONFIDENCE SCORE</div>
                    <div className="text-emerald-400 font-bold text-sm">
                      {(selectedScenario.tier1_ml.confidence * 100).toFixed(2)}%
                    </div>
                  </div>

                  <div className="bg-[#090d16] border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">INFERENCE SPEED</div>
                    <div className="text-cyan-400 font-bold text-sm">
                      {selectedScenario.tier1_ml.latency_ms} ms
                    </div>
                  </div>
                </div>

                {/* Model Details & Gatekeeper Action */}
                <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs font-mono space-y-2">
                  <div className="text-slate-300">
                    <strong className="text-cyan-400">Classifier Architecture:</strong> {selectedScenario.tier1_ml.vectorizer} + {selectedScenario.tier1_ml.model_name}
                  </div>
                  <div className="text-slate-300">
                    <strong className="text-cyan-400">Keywords Triggered:</strong> {selectedScenario.tier1_ml.keywords_detected.join(', ')}
                  </div>
                  <div className="text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Gatekeeper Decision: {selectedScenario.tier1_ml.gatekeeper_action}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TIER 2: AGENT BUFFER RECALL & MCP CODEBASE TOOLS */}
            {/* ============================================================ */}
            {activeTier === 2 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                      Tier 2: Node 1 Ring Buffer & Node 2 MCP Code Investigator
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    Buffer Recall: 100%
                  </span>
                </div>

                {/* Ring Buffer Correlated Event Trail */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Correlated Ring Buffer Logs ({selectedScenario.tier2_agent.correlated_logs.length} entries recalled)</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedScenario.tier2_agent.correlated_logs.map((log, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-[#080d1a] border border-slate-800 text-xs font-mono flex items-center gap-3">
                        <span className="text-slate-500 text-[10px]">{log.timestamp}</span>
                        <span className="text-slate-300 truncate">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MCP Codebase Tools Called */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-slate-300 font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-accent-blue" />
                    <span>MCP Codebase & GitHub Tools Invoked</span>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-[#090d16] text-slate-400 text-[11px] border-b border-border">
                        <tr>
                          <th className="p-2.5">MCP Tool</th>
                          <th className="p-2.5">Arguments</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Latency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-surface">
                        {selectedScenario.tier2_agent.mcp_tools_called.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="p-2.5 text-accent-blue font-semibold">{t.tool}</td>
                            <td className="p-2.5 text-slate-400">{t.args}</td>
                            <td className="p-2.5 text-emerald-400">{t.status}</td>
                            <td className="p-2.5 text-cyan-400">{t.latency_ms} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Faulty Code Inspection Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 font-bold flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Faulty Source Code ({selectedScenario.faulty_file}:{selectedScenario.faulty_line})</span>
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <GitCommit className="w-3 h-3" />
                      Commit {selectedScenario.tier2_agent.git_commit_sha}
                    </span>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-[#080d1a] border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {selectedScenario.code_snippet}
                  </pre>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TIER 3: LLM-AS-A-JUDGE RCA REPORT SCORECARD */}
            {/* ============================================================ */}
            {activeTier === 3 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                      Tier 3: LLM-as-a-Judge 5-Dimension RCA Scorecard
                    </h3>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    Judge Score: {selectedScenario.tier3_rca.judge_score} / 5.0
                  </span>
                </div>

                {/* 5-Dimension Rubric Score Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <div className="text-slate-500 text-[10px]">ROOT CAUSE</div>
                    <div className="text-emerald-400 font-bold">{selectedScenario.tier3_rca.rubric_scores.root_cause_accuracy} / 5.0</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <div className="text-slate-500 text-[10px]">CODE GROUNDING</div>
                    <div className="text-emerald-400 font-bold">{selectedScenario.tier3_rca.rubric_scores.code_grounding} / 5.0</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <div className="text-slate-500 text-[10px]">MARKDOWN FORMAT</div>
                    <div className="text-emerald-400 font-bold">{selectedScenario.tier3_rca.rubric_scores.format_compliance} / 5.0</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <div className="text-slate-500 text-[10px]">REMEDIATION</div>
                    <div className="text-emerald-400 font-bold">{selectedScenario.tier3_rca.rubric_scores.remediation_clarity} / 5.0</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl text-center space-y-1">
                    <div className="text-slate-500 text-[10px]">SECURITY SCRUBBED</div>
                    <div className="text-emerald-400 font-bold">{selectedScenario.tier3_rca.rubric_scores.security_pii_scrubbed} / 5.0</div>
                  </div>
                </div>

                {/* Judge Reasoning */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-200/90 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Award className="w-3.5 h-3.5" />
                    <span>Evaluator Judge Evaluation:</span>
                  </div>
                  <p>{selectedScenario.tier3_rca.judge_reasoning}</p>
                </div>

                {/* Rendered RCA Report */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-mono text-slate-300 font-bold">Generated 5-Section Markdown RCA Report:</div>
                  <div className="p-5 rounded-xl bg-[#080d1a] border border-slate-800">
                    <RCAMarkdown markdown={selectedScenario.tier3_rca.rca_markdown} />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* TIER 4: LATENCY & PIPELINE SLAS */}
            {/* ============================================================ */}
            {activeTier === 4 && (
              <div className="space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-rose-400" />
                    <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                      Tier 4: Pipeline Latency Breakdown & Telemetry
                    </h3>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold">
                    Total: {(selectedScenario.tier4_latency.total_pipeline_ms / 1000).toFixed(2)}s
                  </span>
                </div>

                {/* Latency Waterfall Bars */}
                <div className="space-y-3 font-mono text-xs">
                  {selectedScenario.tier4_latency.breakdown.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>{item.stage}</span>
                        <span className="font-bold" style={{ color: item.color }}>
                          {item.latency_ms < 1000 ? `${item.latency_ms} ms` : `${(item.latency_ms / 1000).toFixed(2)} s`}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max((item.latency_ms / selectedScenario.tier4_latency.total_pipeline_ms) * 100, 2)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Token Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-3">
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">INPUT TOKENS</div>
                    <div className="text-purple-300 font-bold text-sm">{selectedScenario.tier4_latency.input_tokens}</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">OUTPUT TOKENS</div>
                    <div className="text-rose-300 font-bold text-sm">{selectedScenario.tier4_latency.output_tokens}</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">CACHED PROMPT TOKENS</div>
                    <div className="text-emerald-400 font-bold text-sm">{selectedScenario.tier4_latency.cached_tokens}</div>
                  </div>
                  <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="text-slate-500 text-[10px]">ESTIMATED COST</div>
                    <div className="text-cyan-400 font-bold text-sm">{selectedScenario.tier4_latency.estimated_cost_usd}</div>
                  </div>
                </div>

                {/* MTTR SLA Impact */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono space-y-2">
                  <div className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>MTTR SLA Performance Comparison:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 pt-1">
                    <div>
                      <span className="text-slate-500">Autonomous AIOps MTTR:</span>{' '}
                      <strong className="text-emerald-400">~5.1 seconds</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Average Human SRE MTTR:</span>{' '}
                      <strong className="text-rose-400">30 - 45 minutes</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Navigation Footer */}
            <div className="pt-6 mt-6 border-t border-border flex items-center justify-between font-mono text-xs">
              <button
                disabled={activeTier === 1}
                onClick={() => setActiveTier((prev) => (Math.max(prev - 1, 1) as 1 | 2 | 3 | 4))}
                className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-slate-300 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous Tier</span>
              </button>

              <div className="text-slate-500 text-[11px]">
                Tier {activeTier} of 4 • {activeTier === 1 ? 'ML Classifier' : activeTier === 2 ? 'Buffer & Tools' : activeTier === 3 ? 'RCA Report' : 'Latency SLAs'}
              </div>

              <button
                disabled={activeTier === 4}
                onClick={() => setActiveTier((prev) => (Math.min(prev + 1, 4) as 1 | 2 | 3 | 4))}
                className="px-3.5 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white font-semibold disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors glow-blue"
              >
                <span>Next Tier</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
