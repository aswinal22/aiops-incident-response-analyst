import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Project, Service } from '../lib/types';
import { PATDisclaimerBanner } from '../components/security/PATDisclaimerBanner';
import { CreateProjectModal } from '../components/projects/CreateProjectModal';
import { ProjectScopeModal } from '../components/projects/ProjectScopeModal';
import { Folder, GitBranch, Plus, Server, Copy, Check, ExternalLink, Activity, ArrowRight, RefreshCw } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, activeProject, activeService, setActiveProject, setActiveService, githubPat, refreshProjectsAndServices } = useAuth();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProjectForScope, setSelectedProjectForScope] = useState<Project | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleSelectActive = (proj: Project, svc: Service) => {
    setActiveProject(proj);
    setActiveService(svc);
    navigate('/');
  };

  const copyDrainUrl = (serviceId: string) => {
    const url = `${window.location.origin}/ingest-logs/${serviceId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(serviceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProjectsAndServices();
    setRefreshing(false);
  };

  const safeProjects = Array.isArray(projects) ? projects : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Folder className="w-5 h-5 text-accent-blue" />
            <span>Projects & Microservice Repositories</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize microservices into projects, scope specific GitHub repositories, and manage dedicated 24/7 log drains.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs border border-border transition-colors font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Prominent Security & Governance Disclaimer */}
      <PATDisclaimerBanner />

      {/* Projects List */}
      <div className="space-y-6">
        {safeProjects.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-border rounded-2xl space-y-3">
            <Folder className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">No Projects Configured</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Create your first project to organize your microservices and scope GitHub repositories for autonomous investigation.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          safeProjects.map((proj) => {
            const isCurrentProj = activeProject?.id === proj.id;
            const services = Array.isArray(proj.services) ? proj.services : [];

            return (
              <div
                key={proj.id}
                className={`bg-surface border rounded-2xl p-6 shadow-xl space-y-4 transition-all ${
                  isCurrentProj ? 'border-accent-blue/40 ring-1 ring-accent-blue/20' : 'border-border'
                }`}
              >
                {/* Project Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                        <Folder className="w-4 h-4 text-accent-blue" />
                        {proj.name}
                      </h2>
                      {isCurrentProj && (
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-accent-blue/15 border border-accent-blue/30 text-accent-blue font-mono font-medium">
                          Active Project
                        </span>
                      )}
                    </div>
                    {proj.description && <p className="text-xs text-slate-400">{proj.description}</p>}
                  </div>

                  <button
                    onClick={() => setSelectedProjectForScope(proj)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-slate-200 transition-colors shrink-0"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                    <span>Scope GitHub Repo</span>
                  </button>
                </div>

                {/* Scoped Microservices Grid */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-300 font-mono flex items-center justify-between">
                    <span>Scoped Microservices ({services.length}):</span>
                    <span className="text-[11px] text-slate-500 font-normal">24/7 Log Ingestion Webhooks</span>
                  </div>

                  {services.length === 0 ? (
                    <div className="p-6 text-center bg-[#090d16] border border-slate-800/80 rounded-xl text-slate-500 text-xs">
                      No repositories scoped to this project yet. Click "Scope GitHub Repo" above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {services.map((svc) => {
                        const isCurrentSvc = activeService?.id === svc.id;
                        const drainUrl = `/ingest-logs/${svc.id || svc.name}`;

                        return (
                          <div
                            key={svc.id}
                            className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                              isCurrentSvc
                                ? 'bg-accent-blue/10 border-accent-blue/40 text-blue-100'
                                : 'bg-[#090d16] border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-100">{svc.name}</span>
                                  {isCurrentSvc && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                                      <Activity className="w-2.5 h-2.5" />
                                      Active Stream
                                    </span>
                                  )}
                                </div>
                                {svc.repo_owner && (
                                  <div className="flex items-center gap-1 text-[11px] text-purple-300 font-mono mt-0.5">
                                    <GitBranch className="w-3 h-3 text-purple-400" />
                                    <span>
                                      {svc.repo_owner}/{svc.repo_name}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {svc.repo_url && (
                                <a
                                  href={svc.repo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-slate-400 hover:text-slate-200"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>

                            {/* Webhook URL Box */}
                            <div className="bg-[#050811] border border-slate-800 p-2 rounded-lg flex items-center justify-between text-xs font-mono">
                              <div className="truncate mr-2">
                                <span className="text-slate-500 text-[10px] block">Log Ingestion Drain:</span>
                                <span className="text-slate-300 text-[11px] truncate">{drainUrl}</span>
                              </div>
                              <button
                                onClick={() => copyDrainUrl(svc.id || svc.name)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[10px] flex items-center gap-1 px-2"
                              >
                                {copiedId === (svc.id || svc.name) ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>{copiedId === (svc.id || svc.name) ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>

                            {/* Select as Active Stream */}
                            <div className="flex items-center justify-end pt-1">
                              {!isCurrentSvc && (
                                <button
                                  onClick={() => handleSelectActive(proj, svc)}
                                  className="text-xs text-accent-blue hover:text-blue-300 flex items-center gap-1 font-medium"
                                >
                                  <span>Monitor Stream & RCA</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={refreshProjectsAndServices}
      />

      <ProjectScopeModal
        isOpen={!!selectedProjectForScope}
        onClose={() => setSelectedProjectForScope(null)}
        project={selectedProjectForScope}
        savedPat={githubPat}
        onScoped={refreshProjectsAndServices}
      />
    </div>
  );
};
