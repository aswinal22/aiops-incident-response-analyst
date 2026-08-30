import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Project } from '../../lib/types';
import { X, Server, Key, GitBranch, Folder, Sparkles, CheckCircle2 } from 'lucide-react';

interface RegisterServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onCreated: () => void;
}

export const RegisterServiceModal: React.FC<RegisterServiceModalProps> = ({
  isOpen,
  onClose,
  projects,
  onCreated,
}) => {
  const [projectId, setProjectId] = useState(projects[0]?.id || 'default-project');
  const [serviceName, setServiceName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ name: string; ingest_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.createService({
        project_id: projectId,
        name: serviceName,
        repo_url: repoUrl,
        github_pat: githubPat,
        workspace_path: workspacePath || serviceName,
      });

      setCreatedInfo({ name: res.name, ingest_url: res.ingest_url });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to register service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Register Microservice</h3>
              <p className="text-xs text-slate-400">Map microservice logs to its GitHub repository</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdInfo ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">Microservice Registered Successfully!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Configure your Render/Vercel/K8s log drain to send stdout to this dedicated webhook:
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[#070b14] border border-slate-800 font-mono text-xs text-emerald-300 break-all text-left">
              POST {window.location.origin}{createdInfo.ingest_url}
            </div>

            <button
              onClick={() => {
                setCreatedInfo(null);
                onClose();
              }}
              className="w-full py-2 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {/* Project Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Parent Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-accent-blue"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Microservice Name *</label>
              <div className="relative">
                <Server className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. auth-service, payment-gateway"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>
            </div>

            {/* GitHub Repo URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">GitHub Repository URL</label>
              <div className="relative">
                <GitBranch className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="https://github.com/acme/auth-service"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>
            </div>

            {/* GitHub PAT (Fernet Encrypted) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">GitHub Personal Access Token (PAT)</label>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Fernet AES-128 Encrypted at Rest
                </span>
              </div>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="ghp_************************************"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>
            </div>

            {/* Local Workspace Path Fallback */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Local Workspace Folder (Optional Fallback)</label>
              <div className="relative">
                <Folder className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. auth-service or target-app"
                  value={workspacePath}
                  onChange={(e) => setWorkspacePath(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-surface-elevated hover:bg-surface-hover text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold shadow glow-blue disabled:opacity-50"
              >
                {loading ? 'Encrypting & Saving...' : 'Register Service'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
