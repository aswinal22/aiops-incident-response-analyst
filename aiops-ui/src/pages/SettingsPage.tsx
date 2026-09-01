import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PATDisclaimerBanner } from '../components/security/PATDisclaimerBanner';
import { validateGitHubPat } from '../lib/github';
import { Key, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Lock, Database } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { githubPat, patStatus, saveGitHubPat } = useAuth();
  const [tokenInput, setTokenInput] = useState(githubPat || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string; user?: any } | null>(null);

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    try {
      const ghUser = await validateGitHubPat(tokenInput.trim());
      await saveGitHubPat(tokenInput.trim());
      setTestResult({
        status: 'success',
        message: `Token verified successfully for @${ghUser.login}! Ready for autonomous code investigation.`,
        user: ghUser,
      });
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Token validation failed. Please check permissions.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Key className="w-5 h-5 text-accent-blue" />
          <span>Security & Integration Settings</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage GitHub Personal Access Tokens (PAT), audit service accounts, and verify 5-layer platform guardrails.
        </p>
      </div>

      {/* Prominent Security Disclaimer */}
      <PATDisclaimerBanner />

      {/* PAT Management Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
              <span>GitHub Integration Token</span>
              {patStatus === 'connected' ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  Active & Verified
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
                  Not Configured
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Allows the Code Investigator agent to fetch git commit diffs and inspect faulty source files.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveAndTest} className="space-y-4 max-w-xl">
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                testResult.status === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.status === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span>{testResult.message}</span>
                {testResult.user && (
                  <div className="text-[11px] text-emerald-400 font-mono">
                    Owner: {testResult.user.name} (@{testResult.user.login})
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              GitHub Personal Access Token (Read-Only)
            </label>
            <input
              type="password"
              placeholder="ghp_************************************"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Stored with <strong>Fernet AES-128 encryption</strong> in PostgreSQL and decrypted only in RAM during multi-agent triage.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={testing || !tokenInput.trim()}
              className="px-4 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing Token...' : 'Validate & Save Token'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security Guardrails Architecture Summary */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold text-slate-100 font-mono flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Active 5-Layer Security & Sandbox Controls</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
          <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
            <div className="text-accent-blue font-semibold">Layer 1: Ingress Limiter</div>
            <div className="text-slate-400 text-[11px]">SlowAPI 50 req/min rate limit per IP</div>
          </div>

          <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
            <div className="text-purple-400 font-semibold">Layer 2: PII Redactor</div>
            <div className="text-slate-400 text-[11px]">Regex scrubbing for AWS, JWT, API keys</div>
          </div>

          <div className="bg-[#090d16] border border-slate-800 p-3 rounded-xl space-y-1">
            <div className="text-emerald-400 font-semibold">Layer 3: AST SQL Guard</div>
            <div className="text-slate-400 text-[11px]">sqlparse SELECT-only AST validator</div>
          </div>
        </div>
      </div>
    </div>
  );
};
