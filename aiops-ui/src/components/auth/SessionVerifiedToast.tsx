import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, X, Clock, Server } from 'lucide-react';

export interface SessionToastData {
  username: string;
  name?: string;
  expiresInHours?: number;
  isBackendVerified?: boolean;
}

interface SessionVerifiedToastProps {
  toast: SessionToastData | null;
  onClose: () => void;
}

export const SessionVerifiedToast: React.FC<SessionVerifiedToastProps> = ({ toast, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Allow exit transition
      }, 4000); // Stays for 4 seconds as requested

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [toast, onClose]);

  if (!toast && !visible) return null;

  const displayName = toast?.name || toast?.username || 'SRE Analyst';
  const hoursLeft = toast?.expiresInHours ? Math.round(toast.expiresInHours) : 24;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ease-out transform ${
        visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-4 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#0b1220]/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl p-4 text-slate-200">
        {/* Ambient emerald glow */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>Session Verified</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                24h Token Valid
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Welcome back, <strong className="text-white font-medium">{displayName}</strong>! Active session confirmed by AIOps backend.
            </p>

            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>~{hoursLeft}h remaining</span>
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Server className="w-3 h-3 text-blue-400" />
                <span>Cloud Session Active</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 200);
            }}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800/60 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
