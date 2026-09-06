import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { fetchUserRepositories } from '../../lib/github';
import { GitHubRepo, Project } from '../../lib/types';
import { PATDisclaimerBanner } from '../security/PATDisclaimerBanner';
import { GitBranch, X, Search, CheckCircle2, Key, AlertCircle, ArrowRight, RefreshCw, Lock, Sparkles } from 'lucide-react';

interface ProjectScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onScoped: () => void;
}

export const ProjectScopeModal: React.FC<ProjectScopeModalProps> = ({
  isOpen,
  onClose,
  project,
  onScoped,
}) => {
  const { githubPat, patStatus, saveGitHubPat } = useAuth();

  const [patInput, setPatInput] = useState(githubPat || '');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [search, setSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePat = githubPat || patInput;

  const loadRepos = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setLoadingRepos(true);
    setError(null);
    try {
      const userRepos = await fetchUserRepositories(tokenToUse.trim());
      setRepos(userRepos);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories. Please check PAT permissions.');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  // Auto-fetch repositories when modal opens if PAT is already connected
  useEffect(() => {
    if (isOpen && activePat) {
      loadRepos(activePat);
    }
  }, [isOpen, activePat, loadRepos]);

  if (!isOpen || !project) return null;

  const handleConnectNewPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    try {
      await saveGitHubPat(patInput.trim());
      await loadRepos(patInput.trim());
    } catch (err: any) {
      setError(err.message || 'Invalid PAT token');
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setServiceName(repo.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) {
      setError('Please select a GitHub repository to scope.');
      return;
    }
    if (!serviceName.trim()) {
      setError('Please provide a service identifier.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createService({
        project_id: project.id,
        name: serviceName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        repo_url: selectedRepo.html_url,
        repo_owner: selectedRepo.owner.login,
        repo_name: selectedRepo.name,
        github_pat: activePat.trim() || undefined,
      });

      onScoped();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to scope repository into project.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Scope Microservice Repository into <span className="text-accent-blue">{project.name}</span>
              </h3>
              <p className="text-xs text-slate-400">
                Select a repository to link and generate its dedicated 24/7 log drain webhook
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Disclaimer */}
        <PATDisclaimerBanner compact />

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* PAT Connection Status or Input */}
        {activePat ? (
          /* PAT is already connected in Settings / AuthContext -> Seamless auto-connected badge */
          <div className="p-3 rounded-xl bg-[#090d16] border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-200 font-semibold">Using Connected GitHub Token</span>
                <span className="text-[11px] text-slate-500 block">Fernet AES-128 Encrypted at Rest</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadRepos(activePat)}
              disabled={loadingRepos}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loadingRepos ? 'animate-spin' : ''}`} />
              <span>{loadingRepos ? 'Syncing...' : 'Re-sync Repos'}</span>
            </button>
          </div>
        ) : (
          /* First-time PAT input if not configured in Settings */
          <form onSubmit={handleConnectNewPat} className="space-y-1.5 p-3 rounded-xl bg-[#090d16] border border-slate-800">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Connect GitHub Personal Access Token (Read-Only)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">1-Time Setup</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_************************************"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                className="flex-1 bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
              />
              <button
                type="submit"
                disabled={loadingRepos || !patInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue disabled:opacity-50"
              >
                {loadingRepos ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        )}

        {/* Repository Picker */}
        {loadingRepos ? (
          <div className="p-8 text-center bg-[#090d16] border border-slate-800 rounded-xl space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin text-accent-blue mx-auto" />
            <span className="text-xs font-mono text-slate-400 block">Fetching repositories from GitHub...</span>
          </div>
        ) : repos.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Select Repository to Scope:</label>
              <span className="text-[11px] text-slate-500 font-mono">{repos.length} Repositories Available</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-800/80 rounded-xl p-2 bg-[#080c16]">
              {filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.id === repo.id;
                return (
                  <div
                    key={repo.id}
                    onClick={() => handleSelectRepo(repo)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-accent-blue/15 border-accent-blue/40 text-blue-200'
                        : 'bg-surface-elevated hover:bg-surface-hover border-border/60 text-slate-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-100">{repo.name}</span>
                        {repo.language && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {repo.language}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>

                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-accent-blue shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : activePat && !loadingRepos ? (
          <div className="p-6 text-center bg-[#090d16] border border-slate-800 rounded-xl text-slate-400 text-xs space-y-1">
            <p>No repositories found for this token.</p>
            <p className="text-[11px] text-slate-500">Please ensure the token has <code>repo</code> or <code>Contents: Read</code> access.</p>
          </div>
        ) : null}

        {/* Selected Repo Configuration & 1-Click Submission */}
        {selectedRepo && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-border animate-in fade-in">
            <div className="p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-xl flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[10px] block">Selected GitHub Repository:</span>
                <span className="text-accent-blue font-bold">{selectedRepo.full_name}</span>
              </div>
              <span className="text-[11px] text-purple-300">branch: {selectedRepo.default_branch}</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Microservice Identifier / Name *
              </label>
              <input
                type="text"
                required
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. payment-service"
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Generates webhook endpoint: <code className="text-slate-400">/ingest-logs/{serviceName || 'service-name'}</code>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !serviceName.trim()}
                className="px-4 py-1.5 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? 'Scoping...' : `Scope into ${project.name}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
