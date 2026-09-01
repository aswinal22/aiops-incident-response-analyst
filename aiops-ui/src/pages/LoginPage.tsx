import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Github, Key, Lock, User, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Zap, ExternalLink } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithPat, loginWithCredentials } = useAuth();

  const [authMode, setAuthMode] = useState<'github_pat' | 'credentials'>('github_pat');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<{ name: string; avatar_url: string; login: string } | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handlePatValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      setError('Please enter your GitHub Personal Access Token (PAT).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let ghUser;
      if (authMode === 'credentials') {
        if (!username.trim()) {
          setError('Please enter your username.');
          setLoading(false);
          return;
        }
        ghUser = await loginWithCredentials(username, password, githubPat);
      } else {
        ghUser = await loginWithPat(githubPat);
      }

      setVerifiedUser(ghUser);
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background SRE Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-blue/10 border border-accent-blue/30 text-accent-blue glow-blue mb-2">
            <Zap className="w-6 h-6 fill-accent-blue/20" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-2">
            AIOps Incident Studio
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Autonomous Multi-Agent Observability & Root Cause Analysis Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface/90 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl space-y-5">
          {/* Auth Mode Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#090d16] rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode('github_pat');
                setError(null);
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                authMode === 'github_pat'
                  ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold glow-blue'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub PAT Access</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('credentials');
                setError(null);
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                authMode === 'credentials'
                  ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold glow-blue'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Username + Git</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handlePatValidation} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {verifiedUser && (
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
                <img
                  src={verifiedUser.avatar_url}
                  alt={verifiedUser.name}
                  className="w-8 h-8 rounded-full border border-emerald-500/50"
                />
                <div>
                  <div className="font-semibold">{verifiedUser.name}</div>
                  <div className="text-[10px] text-emerald-400 font-mono">@{verifiedUser.login} (Verified)</div>
                </div>
                <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-400" />
              </div>
            )}

            {authMode === 'credentials' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username / Email</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. alex@acme.corp"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Mandatory GitHub PAT Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>GitHub Personal Access Token (PAT) *</span>
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=AIOps-Incident-Studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-accent-blue hover:underline flex items-center gap-0.5"
                >
                  <span>Generate Token</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="relative">
                <Github className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="ghp_************************************"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Required for MCP agents to inspect repository commits, pull diffs, and pinpoint faulty lines of code.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !!verifiedUser}
              className="w-full py-2.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg glow-blue transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validating GitHub Access...</span>
                </>
              ) : (
                <>
                  <span>Authenticate & Launch Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Security Guarantee */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fernet AES-128 Encrypted</span>
            </span>
            <span className="text-slate-500">Read-Only Scopes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
