import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, User, Lock, Mail, ArrowRight, ShieldCheck, UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, demoLogin } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSwitchPrompt, setShowSwitchPrompt] = useState<'to_signup' | 'to_signin' | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowSwitchPrompt(null);

    try {
      if (mode === 'signin') {
        if (!emailOrUsername.trim()) {
          setError('Please enter your email or username.');
          setLoading(false);
          return;
        }
        await login(emailOrUsername.trim(), password);
      } else {
        if (!email.trim() || !username.trim() || !password) {
          setError('Please fill in all required fields.');
          setLoading(false);
          return;
        }
        await signup(email.trim(), username.trim(), password, fullName.trim() || undefined);
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Authentication error';
      setError(msg);

      if (msg.toLowerCase().includes('no account found') || msg.toLowerCase().includes('not found')) {
        setShowSwitchPrompt('to_signup');
      } else if (msg.toLowerCase().includes('already exists')) {
        setShowSwitchPrompt('to_signin');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchToSignup = () => {
    setMode('signup');
    setError(null);
    setShowSwitchPrompt(null);
    if (emailOrUsername.includes('@')) {
      setEmail(emailOrUsername);
      setUsername(emailOrUsername.split('@')[0]);
    } else if (emailOrUsername) {
      setUsername(emailOrUsername);
    }
  };

  const switchToSignin = () => {
    setMode('signin');
    setError(null);
    setShowSwitchPrompt(null);
    if (email) {
      setEmailOrUsername(email);
    }
  };

  const handleQuickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await demoLogin();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* SRE Background Grid & Ambient Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-blue/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 text-accent-blue glow-blue mb-2">
            <Zap className="w-6 h-6 fill-accent-blue/20" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-2 font-mono">
            AIOps Incident Studio
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Autonomous 24/7 Multi-Agent Observability & Root Cause Analysis Platform
          </p>
        </div>

        {/* Login & Sign Up Card */}
        <div className="bg-surface/90 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-2xl space-y-5">
          {/* Tabs: Sign In vs Sign Up */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#090d16] rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={switchToSignin}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'signin'
                  ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold glow-blue'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={switchToSignup}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'signup'
                  ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold glow-blue'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </div>

                {showSwitchPrompt === 'to_signup' && (
                  <button
                    type="button"
                    onClick={switchToSignup}
                    className="text-[11px] text-accent-blue hover:underline block font-semibold pt-1"
                  >
                    → Click here to Create a New Account
                  </button>
                )}

                {showSwitchPrompt === 'to_signin' && (
                  <button
                    type="button"
                    onClick={switchToSignin}
                    className="text-[11px] text-accent-blue hover:underline block font-semibold pt-1"
                  >
                    → Click here to Sign In
                  </button>
                )}
              </div>
            )}

            {mode === 'signin' ? (
              /* Sign In Fields */
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email or Username *</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. alex@acme.corp or alex_sre"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Sign Up Fields */
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name (Optional)</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Morgan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. alex@acme.corp"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username *</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. alex_sre"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Create Password *</label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg glow-blue transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{mode === 'signin' ? 'Authenticating...' : 'Creating Account...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Account & Start'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Evaluation Access */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-surface hover:bg-[#131b2e] border border-slate-700 hover:border-accent-blue/40 text-xs text-slate-300 hover:text-white font-medium transition-all flex items-center justify-center gap-2 group shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Quick Demo Sign In (24h SRE Session)</span>
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>24h Token Protected</span>
            </span>
            <span className="text-slate-500">Supabase & Render</span>
          </div>
        </div>
      </div>
    </div>
  );
};
