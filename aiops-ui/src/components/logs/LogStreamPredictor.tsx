import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  Sparkles,
  Terminal,
  Globe,
  Link2,
  Copy,
  Check,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Cpu,
  ShieldCheck,
  Flame,
  FileText,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogStreamPredictorProps {
  onSuccess?: () => void;
}

export const LogStreamPredictor: React.FC<LogStreamPredictorProps> = ({ onSuccess }) => {
  const { activeService } = useAuth();
  const [activeTab, setActiveTab] = useState<'predict' | 'url' | 'webhook' | 'simulate'>('predict');
  
  // Tab 1: Live Predictor State
  const [logInput, setLogInput] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<{
    prediction: string;
    confidence?: number;
    log_id?: string;
    incident_id?: string;
    rca_report?: string;
  } | null>(null);

  // Tab 2: Remote URL Ingestion State
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlResult, setUrlResult] = useState<{
    total_processed: number;
    anomalies_detected: number;
    results: Array<{ message: string; prediction: string; confidence?: number; incident_id?: string }>;
  } | null>(null);

  // Tab 3: Webhook Copier State
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // General error/status
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeServiceName = activeService?.name || 'target-app';
  const serviceId = activeService?.id || activeService?.name || 'target-app';

  // Calculate live webhook URL
  const backendBase = (import.meta.env.VITE_API_URL || 'https://aiops-incident-response-analyst.onrender.com').replace(/\/$/, '');
  const webhookUrl = `${backendBase}/ingest-logs/${serviceId}`;

  const curlCommand = `curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"service": "${activeServiceName}", "message": "INFO: [${activeServiceName}] Processed GET /api/v1/health status 200 OK"}'`;

  // Sample Presets for Log Predictor
  const samplePresets = [
    {
      label: 'Healthy Normal 200',
      type: 'normal',
      text: `[INFO] [${activeServiceName}] Processed HTTP GET /api/v1/orders 200 OK (latency: 18ms, user_id: 881)`,
    },
    {
      label: 'Database Timeout Error',
      type: 'error',
      text: `[ERROR] [${activeServiceName}] TimeoutError: Database pool connection timed out after 30000ms: host=db-replica-1.internal:5432
Traceback (most recent call last):
  File "/app/${activeServiceName}/db/pool.py", line 47, in acquire_connection
    raise TimeoutError("Database connection timed out after 30000ms: host=db-replica-1.internal:5432")
TimeoutError: Database pool connection timed out after 30000ms`,
    },
    {
      label: 'Missing Config Bug',
      type: 'error',
      text: `[ERROR] [${activeServiceName}] FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path.
Traceback (most recent call last):
  File "/app/${activeServiceName}/main.py", line 39, in load_config
    raise FileNotFoundError("Configuration file '/app/config/settings.yaml' not found in path.")
FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path.`,
    },
    {
      label: 'Zero Division Math Bug',
      type: 'error',
      text: `[ERROR] [${activeServiceName}] ZeroDivisionError: division by zero in calculate_user_discount
Traceback (most recent call last):
  File "/app/${activeServiceName}/calculator.py", line 43, in calculate_user_discount
    return total_amount / discount_factor
ZeroDivisionError: division by zero`,
    },
  ];

  // Handle Log Predict & Stream
  const handlePredictAndStream = async () => {
    if (!logInput.trim()) {
      setErrorMsg('Please enter or select a log message to stream.');
      return;
    }
    setErrorMsg(null);
    setIsPredicting(true);
    setPredictionResult(null);

    try {
      const res = await api.ingestLog(logInput, activeServiceName, serviceId);
      setPredictionResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to stream and analyze log.');
    } finally {
      setIsPredicting(false);
    }
  };

  // Handle Ingest From URL
  const handleIngestFromUrl = async () => {
    if (!urlInput.trim()) {
      setErrorMsg('Please enter a valid HTTP/HTTPS log stream URL.');
      return;
    }
    setErrorMsg(null);
    setIsFetchingUrl(true);
    setUrlResult(null);

    try {
      const res = await api.ingestFromUrl(urlInput.trim(), activeServiceName);
      setUrlResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch and analyze logs from URL.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'curl') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-mono font-bold text-xs">
            <Cpu className="w-4 h-4 text-accent-blue" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>Log Stream Controller & AI Anomaly Detector</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/20 text-accent-blue font-mono">
                Target: {activeServiceName}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Stream live logs, analyze anomalies with ML in microseconds, and inspect remote log stream URLs.
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#090d16] p-1 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => {
              setActiveTab('predict');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'predict'
                ? 'bg-accent-blue text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Stream & Predict</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('url');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'url'
                ? 'bg-accent-blue text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Remote URL Stream</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('webhook');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'webhook'
                ? 'bg-accent-blue text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Log Drain Webhook</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('simulate');
              setErrorMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'simulate'
                ? 'bg-rose-500 text-white shadow'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Chaos Outage</span>
          </button>
        </div>
      </div>

      {/* Tab 1: AI Stream & Predict */}
      {activeTab === 'predict' && (
        <div className="space-y-3">
          {/* Quick Preset Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-mono">Quick Presets:</span>
            {samplePresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setLogInput(preset.text)}
                className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-all ${
                  preset.type === 'normal'
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Log Message Input */}
          <div className="relative">
            <textarea
              rows={4}
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              placeholder="Paste raw microservice log line, stdout output, or Python/Node traceback..."
              className="w-full bg-[#090d16] border border-border rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent-blue/50"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Layer 2 PII Sanitized before ML evaluation</span>
            </div>

            <button
              onClick={handlePredictAndStream}
              disabled={isPredicting}
              className="px-4 py-2 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isPredicting ? 'animate-spin' : ''}`} />
              <span>{isPredicting ? 'Analyzing with ML & Agents...' : 'Stream & Predict Log with AI'}</span>
            </button>
          </div>

          {/* Real-time AI Prediction Output Card */}
          {predictionResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
                predictionResult.prediction === 'Anomaly'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {predictionResult.prediction === 'Anomaly' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="font-bold font-mono">
                    AI ML Classification: {predictionResult.prediction}
                  </span>
                  {predictionResult.confidence !== undefined && predictionResult.confidence !== null && (
                    <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-mono">
                      Confidence: {(predictionResult.confidence * 100).toFixed(1)}%
                    </span>
                  )}
                </div>

                {predictionResult.incident_id && (
                  <Link
                    to={`/incidents/${predictionResult.incident_id}`}
                    className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white font-medium text-[11px] flex items-center gap-1 shadow transition-colors"
                  >
                    <span>Inspect AI RCA Report</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <p className="text-[11px] text-slate-300">
                {predictionResult.prediction === 'Anomaly'
                  ? '⚠️ Anomaly detected in stdout stream! LangGraph multi-agent RCA workflow triggered and recorded in Supabase incidents.'
                  : '✅ Log is normal and healthy. Appended to the in-memory circular ring buffer and streamed to live console.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Remote URL Stream */}
      {activeTab === 'url' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300">
            Provide any public HTTP/HTTPS URL pointing to a raw log file, container stdout log stream, or remote text dump:
          </p>

          <div className="flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://raw.githubusercontent.com/org/repo/main/logs/service.log"
              className="flex-1 bg-[#090d16] border border-border rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-accent-blue/50"
            />
            <button
              onClick={handleIngestFromUrl}
              disabled={isFetchingUrl}
              className="px-4 py-2 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue flex items-center gap-2 shrink-0 transition-all disabled:opacity-50"
            >
              <Globe className={`w-4 h-4 ${isFetchingUrl ? 'animate-spin' : ''}`} />
              <span>{isFetchingUrl ? 'Fetching & Streaming...' : 'Fetch & Predict Stream'}</span>
            </button>
          </div>

          {/* Quick Sample URL Button */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-mono">Sample URL:</span>
            <button
              onClick={() =>
                setUrlInput(
                  'https://raw.githubusercontent.com/aswinal22/aiops-incident-response-analyst/main/aiops-engine/ml/logs_dataset.csv'
                )
              }
              className="text-[11px] text-accent-blue hover:underline font-mono"
            >
              Load Ground Truth Dataset Sample
            </button>
          </div>

          {/* URL Results */}
          {urlResult && (
            <div className="p-4 rounded-xl bg-surface-elevated border border-border text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-200">
                    Processed: <span className="font-mono text-accent-blue">{urlResult.total_processed}</span> logs
                  </span>
                  <span className="font-semibold text-rose-300">
                    Anomalies: <span className="font-mono text-rose-400">{urlResult.anomalies_detected}</span> detected
                  </span>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
                {urlResult.results.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded flex items-center justify-between gap-2 ${
                      item.prediction === 'Anomaly'
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                        : 'bg-slate-900 text-slate-300'
                    }`}
                  >
                    <span className="truncate flex-1">{item.message}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        item.prediction === 'Anomaly' ? 'bg-rose-500/30 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {item.prediction}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Log Drain Webhook Details */}
      {activeTab === 'webhook' && (
        <div className="space-y-4">
          <div className="bg-[#090d16] border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-mono">
                <Link2 className="w-4 h-4 text-accent-blue" />
                <span>Dedicated Microservice Log Drain Endpoint</span>
              </div>
              <button
                onClick={() => copyToClipboard(webhookUrl, 'url')}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copied URL' : 'Copy URL'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-accent-blue select-all break-all border border-slate-800">
              {webhookUrl}
            </div>
          </div>

          <div className="bg-[#090d16] border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 font-mono">cURL Verification Snippet</span>
              <button
                onClick={() => copyToClipboard(curlCommand, 'curl')}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCurl ? 'Copied cURL' : 'Copy cURL'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-black/60 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
              {curlCommand}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 4: Chaos Outage Simulator */}
      {activeTab === 'simulate' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={async () => {
                try {
                  const res = await api.simulateError('file_not_found', activeServiceName);
                  setPredictionResult(res);
                  if (onSuccess) onSuccess();
                } catch (e: any) {
                  setErrorMsg(e.message);
                }
              }}
              className="p-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-rose-500/40 text-left transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-rose-300 font-mono">FileNotFoundError</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">Config Bug</span>
              </div>
              <p className="text-[11px] text-slate-400">Missing settings.yaml traceback</p>
              <div className="mt-2 text-[11px] text-rose-400 font-medium hover:underline">Simulate Outage →</div>
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await api.simulateError('zero_division', activeServiceName);
                  setPredictionResult(res);
                  if (onSuccess) onSuccess();
                } catch (e: any) {
                  setErrorMsg(e.message);
                }
              }}
              className="p-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-amber-500/40 text-left transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-amber-300 font-mono">ZeroDivisionError</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Math Bug</span>
              </div>
              <p className="text-[11px] text-slate-400">Unhandled division by zero</p>
              <div className="mt-2 text-[11px] text-amber-400 font-medium hover:underline">Simulate Outage →</div>
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await api.simulateError('database_timeout', activeServiceName);
                  setPredictionResult(res);
                  if (onSuccess) onSuccess();
                } catch (e: any) {
                  setErrorMsg(e.message);
                }
              }}
              className="p-3.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border hover:border-purple-500/40 text-left transition-all"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-purple-300 font-mono">DB Timeout</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">Infra Bug</span>
              </div>
              <p className="text-[11px] text-slate-400">Database connection timeout 30000ms</p>
              <div className="mt-2 text-[11px] text-purple-400 font-medium hover:underline">Simulate Outage →</div>
            </button>
          </div>
        </div>
      )}

      {/* Error Message Display */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
