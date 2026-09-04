import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck } from 'lucide-react';
import { SessionVerifiedToast } from './SessionVerifiedToast';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, sessionToast, dismissToast } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-accent-blue/20 border-t-accent-blue rounded-full animate-spin" />
          <ShieldCheck className="w-5 h-5 text-accent-blue absolute inset-0 m-auto" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-mono font-medium text-slate-200">Verifying 24h Session...</p>
          <p className="text-[11px] text-slate-400">Validating Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <SessionVerifiedToast toast={sessionToast} onClose={dismissToast} />
      {children}
    </>
  );
};
