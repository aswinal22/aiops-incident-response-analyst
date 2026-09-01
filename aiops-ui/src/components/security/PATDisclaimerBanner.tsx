import React from 'react';
import { ShieldCheck, Lock, UserCheck, ExternalLink } from 'lucide-react';

export const PATDisclaimerBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/30 text-xs text-blue-200 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-accent-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block text-slate-100">Least-Privilege Security Notice</span>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Our platform operates strictly in <strong>Read-Only</strong> mode. Please generate a GitHub PAT with only{' '}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-accent-blue">Contents: Read</code> permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-accent-blue/30 rounded-2xl p-5 shadow-xl space-y-4 bg-gradient-to-r from-accent-blue/5 via-transparent to-purple-500/5">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue glow-blue">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>GitHub PAT Security & Governance Disclaimer</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-medium">
              Read-Only Recommended
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Adhere to the Principle of Least Privilege for autonomous multi-agent code analysis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Guardrail 1: Read-Only Token */}
        <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono text-[11px]">
            <Lock className="w-3.5 h-3.5 text-accent-blue" />
            <span>1. Strict Read-Only Scopes</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Please generate a Fine-Grained PAT with only <strong>Contents: Read</strong> and <strong>Metadata: Read</strong>. Never grant write or admin permissions.
          </p>
        </div>

        {/* Guardrail 2: Platform Inherent Safety */}
        <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. Inherent Safe Execution</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Our LangGraph agents only execute read endpoints and AST-validated SQL. The engine has zero capability to commit, push, modify, or delete code.
          </p>
        </div>

        {/* Guardrail 3: Dedicated Service Account */}
        <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-200 font-semibold font-mono text-[11px]">
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Dedicated Service User</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            For corporate auditability, we recommend creating a dedicated bot account (e.g. <code>aiops-bot</code>) so all inspection queries are isolated in audit logs.
          </p>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800/80">
        <span className="text-slate-400 text-[11px] font-mono">
          Tokens are encrypted at rest using <strong>Fernet AES-128</strong> in Supabase PostgreSQL.
        </span>
        <a
          href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=AIOps-Incident-Studio-ReadOnly"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue hover:underline flex items-center gap-1 font-medium text-[11px]"
        >
          <span>Generate Read-Only Token on GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};
