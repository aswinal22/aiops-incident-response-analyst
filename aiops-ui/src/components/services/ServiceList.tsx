import React, { useState } from 'react';
import { Service } from '../../lib/types';
import { Server, GitBranch, Copy, Check, Plus, Folder } from 'lucide-react';

interface ServiceListProps {
  services: Service[];
  onOpenRegisterModal: () => void;
}

export const ServiceList: React.FC<ServiceListProps> = ({ services, onOpenRegisterModal }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyDrainUrl = (serviceId: string) => {
    const url = `${window.location.origin}/ingest-logs/${serviceId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(serviceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-accent-blue" />
            <span>Microservice Registry & Log Drains</span>
          </h2>
          <p className="text-xs text-slate-400">
            Registered microservices mapped to GitHub repositories and dedicated log drain webhooks.
          </p>
        </div>

        <button
          onClick={onOpenRegisterModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Register Microservice</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 ? (
          <div className="col-span-full p-12 bg-surface border border-border rounded-xl text-center text-slate-500 text-xs">
            No microservices registered yet.
          </div>
        ) : (
          services.map((svc) => (
            <div
              key={svc.id}
              className="bg-surface border border-border hover:border-slate-700/80 rounded-xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue font-bold text-xs">
                    {svc.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 font-mono">{svc.name}</h3>
                    <span className="text-[10px] text-emerald-400 font-medium">Active Log Ingestion</span>
                  </div>
                </div>
              </div>

              {/* Repo & Workspace Context */}
              <div className="space-y-1.5 text-xs text-slate-400 bg-[#090d16]/70 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <GitBranch className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">
                    {svc.repo_owner && svc.repo_name ? `${svc.repo_owner}/${svc.repo_name}` : 'Local Workspace'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Path: {svc.workspace_path || svc.name}</span>
                </div>
              </div>

              {/* Log Drain Webhook URL */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Log Drain Webhook:</span>
                  <button
                    onClick={() => copyDrainUrl(svc.id)}
                    className="flex items-center gap-1 text-[10px] text-accent-blue hover:text-blue-300 font-mono font-semibold"
                  >
                    {copiedId === svc.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Webhook</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-[#070b14] border border-slate-800 p-2 rounded text-[10px] font-mono text-slate-400 truncate">
                  /ingest-logs/{svc.id}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

