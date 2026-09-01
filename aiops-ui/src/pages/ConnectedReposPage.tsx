import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogStream } from '../lib/types';
import { GitBranch, ExternalLink, Search, Server, Copy, Check, CheckCircle2, RefreshCw } from 'lucide-react';

export const ConnectedReposPage: React.FC = () => {
  const { userRepos, activeStream, setActiveStream, user, refreshRepos } = useAuth();
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredRepos = userRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelectStream = (repo: (typeof userRepos)[0]) => {
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
  };

  const copyDrainUrl = (repoName: string) => {
    const url = `${window.location.origin}/ingest-logs/${repoName}`;
    navigator.clipboard.writeText(url);
    setCopiedId(repoName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshRepos();
    setRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-accent-blue" />
            <span>Connected GitHub Repositories</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Microservice repositories accessible to @{user?.login || 'user'} for autonomous code inspection and log ingestion.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs border border-border transition-colors font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync Repos</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
        />
      </div>

      {/* Repositories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRepos.length === 0 ? (
          <div className="col-span-2 p-12 text-center bg-surface border border-border rounded-xl text-slate-500 text-xs">
            No repositories found matching "{search}".
          </div>
        ) : (
          filteredRepos.map((repo) => {
            const isActive = activeStream?.repo_name === repo.name;
            const drainUrl = `/ingest-logs/${repo.name}`;

            return (
              <div
                key={repo.id}
                className={`bg-surface border rounded-xl p-5 shadow-lg space-y-3 transition-all ${
                  isActive ? 'border-accent-blue/50 ring-1 ring-accent-blue/30 bg-accent-blue/5' : 'border-border hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-100">{repo.name}</span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Active Stream
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>{repo.owner.login}</span>
                      <span>•</span>
                      <span>branch: {repo.default_branch}</span>
                      {repo.language && (
                        <>
                          <span>•</span>
                          <span className="text-purple-300">{repo.language}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {repo.description && (
                  <p className="text-xs text-slate-400 line-clamp-2">{repo.description}</p>
                )}

                {/* Log Drain Endpoint Box */}
                <div className="bg-[#090d16] border border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-xs font-mono">
                  <div className="truncate mr-2">
                    <span className="text-slate-500 text-[10px] block">Log Ingestion Drain:</span>
                    <span className="text-slate-300 text-[11px] truncate">{drainUrl}</span>
                  </div>
                  <button
                    onClick={() => copyDrainUrl(repo.name)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 text-[10px] flex items-center gap-1 px-2"
                  >
                    {copiedId === repo.name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === repo.name ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Action Row */}
                <div className="pt-2 flex items-center justify-end">
                  {!isActive && (
                    <button
                      onClick={() => handleSelectStream(repo)}
                      className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-slate-200 transition-colors"
                    >
                      Set as Active Stream
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
