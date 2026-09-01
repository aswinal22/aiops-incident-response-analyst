import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogStream } from '../../lib/types';
import { X, Server, GitBranch, Search, Link2, Plus, CheckCircle2, ArrowRight } from 'lucide-react';

interface StreamSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StreamSelectorModal: React.FC<StreamSelectorModalProps> = ({ isOpen, onClose }) => {
  const { userRepos, activeStream, setActiveStream, user } = useAuth();
  const [tab, setTab] = useState<'github_repos' | 'custom_url'>('github_repos');
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDrainUrl, setCustomDrainUrl] = useState('');

  if (!isOpen) return null;

  const filteredRepos = userRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectRepo = (repo: (typeof userRepos)[0]) => {
    const stream: LogStream = {
      id: repo.name,
      name: repo.name,
      repo_name: repo.name,
      repo_owner: repo.owner.login,
      repo_url: repo.html_url,
      log_drain_url: `/ingest-logs/${repo.name}`,
      source_type: 'github_repo',
      created_at: new Date().toISOString(),
    };
    setActiveStream(stream);
    onClose();
  };

  const handleCustomDrainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const stream: LogStream = {
      id: customName.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      name: customName,
      log_drain_url: customDrainUrl || `/ingest-logs/${customName}`,
      source_type: 'custom_drain',
      created_at: new Date().toISOString(),
    };
    setActiveStream(stream);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Select Active Log Stream</h3>
              <p className="text-xs text-slate-400">
                Choose a microservice repository or paste an external log drain URL
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#090d16] rounded-xl border border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('github_repos')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'github_repos'
                ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Connected GitHub Repos ({userRepos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('custom_url')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'custom_url'
                ? 'bg-accent-blue/15 text-blue-300 border border-accent-blue/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Paste External Log Drain</span>
          </button>
        </div>

        {/* Tab 1: GitHub Repos List */}
        {tab === 'github_repos' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {filteredRepos.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No repositories matching "{search}".
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const isCurrent = activeStream?.repo_name === repo.name;
                  return (
                    <div
                      key={repo.id}
                      onClick={() => handleSelectRepo(repo)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-accent-blue/10 border-accent-blue/40 text-blue-200'
                          : 'bg-surface-elevated hover:bg-surface-hover border-border text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-100 truncate">
                            {repo.name}
                          </span>
                          {repo.language && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {repo.language}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{repo.description}</p>
                        )}
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Custom Log Drain URL */}
        {tab === 'custom_url' && (
          <form onSubmit={handleCustomDrainSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Microservice Identifier *</label>
              <input
                type="text"
                required
                placeholder="e.g. payment-service, auth-service"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">External Log Drain Webhook / URL</label>
              <input
                type="text"
                placeholder="https://your-service.onrender.com/log-drain or leave empty"
                value={customDrainUrl}
                onChange={(e) => setCustomDrainUrl(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold"
            >
              Set Active Log Stream
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
