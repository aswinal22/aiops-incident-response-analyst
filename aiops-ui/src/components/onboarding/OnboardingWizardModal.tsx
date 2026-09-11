import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { validateGitHubPat, fetchUserRepositories } from '../../lib/github';
import { GitHubRepo, GitHubUser } from '../../lib/types';
import { PATDisclaimerBanner } from '../security/PATDisclaimerBanner';
import {
  Key,
  FolderPlus,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Server,
  Sparkles,
  X,
} from 'lucide-react';

export const OnboardingWizardModal: React.FC = () => {
  const {
    user,
    githubPat,
    patStatus,
    saveGitHubPat,
    projects,
    refreshProjectsAndServices,
    isOnboardingOpen,
    closeOnboarding,
    setActiveProject,
    setActiveService,
  } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [tokenInput, setTokenInput] = useState(githubPat || '');
  const [verifying, setVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<GitHubUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 2 State
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchRepo, setSearchRepo] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedDrainUrl, setCompletedDrainUrl] = useState<string | null>(null);

  useEffect(() => {
    if (githubPat) {
      setTokenInput(githubPat);
    }
  }, [githubPat]);

  useEffect(() => {
    if (isOnboardingOpen) {
      setError(null);
      setCompletedDrainUrl(null);
      if (githubPat && patStatus === 'connected') {
        setStep(2);
        loadRepositories(githubPat);
      } else {
        setStep(1);
      }
    }
  }, [isOnboardingOpen, githubPat, patStatus]);

  const loadRepositories = async (patToUse: string) => {
    setLoadingRepos(true);
    setError(null);
    try {
      const userRepos = await fetchUserRepositories(patToUse.trim());
      setRepos(userRepos);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories with this token.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleVerifyPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Please provide your GitHub Personal Access Token.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const ghUser = await validateGitHubPat(tokenInput.trim());
      await saveGitHubPat(tokenInput.trim());
      setVerifiedUser(ghUser);
      setStep(2);
      await loadRepositories(tokenInput.trim());
    } catch (err: any) {
      setError(err.message || 'Token verification failed. Please check permissions.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSelectRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    if (!serviceName) {
      setServiceName(repo.name);
    }
    if (!projectName) {
      setProjectName(`${repo.name}-platform`);
    }
  };

  const handleFinishOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setError('Please provide a project name.');
      return;
    }
    if (!selectedRepo) {
      setError('Please select a GitHub repository for your initial microservice.');
      return;
    }
    if (!serviceName.trim()) {
      setError('Please provide a service identifier name.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create the project
      const projRes = await api.createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || `Observability and incident triage for ${projectName.trim()}`,
        user_id: user?.id,
      });

      // 2. Register the service with GitHub repo metadata
      const svcRes = await api.createService({
        project_id: projRes.project_id,
        name: serviceName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
        repo_url: selectedRepo.html_url,
        repo_owner: selectedRepo.owner.login,
        repo_name: selectedRepo.name,
        github_pat: tokenInput.trim(),
      });

      // 3. Refresh context and set as active
      await refreshProjectsAndServices();

      const newProj = {
        id: projRes.project_id,
        name: projectName.trim(),
        description: projectDescription.trim(),
        created_at: new Date().toISOString(),
        services: [
          {
            id: svcRes.service_id,
            project_id: projRes.project_id,
            name: serviceName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
            repo_url: selectedRepo.html_url,
            repo_owner: selectedRepo.owner.login,
            repo_name: selectedRepo.name,
            log_drain_url: `/ingest-logs/${svcRes.service_id}`,
            created_at: new Date().toISOString(),
          },
        ],
      };

      setActiveProject(newProj);
      setActiveService(newProj.services[0]);

      setCompletedDrainUrl(`${window.location.origin}/ingest-logs/${svcRes.service_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize project & microservice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOnboardingOpen) return null;

  const filteredRepos = repos.filter(
    (r) =>
      r.name.toLowerCase().includes(searchRepo.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchRepo.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue glow-blue">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                <span>Welcome to AIOps Incident Response</span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure your GitHub PAT & scope your project microservices for autonomous code triage.
              </p>
            </div>
          </div>
          {projects.length > 0 && (
            <button onClick={closeOnboarding} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
              step === 1
                ? 'bg-accent-blue/15 border-accent-blue/40 text-blue-200 font-semibold'
                : 'bg-[#090d16] border-slate-800 text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-accent-blue/30 flex items-center justify-center text-[10px] font-bold">
              1
            </span>
            <span>Step 1: GitHub PAT Token</span>
          </div>

          <div
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
              step === 2
                ? 'bg-accent-blue/15 border-accent-blue/40 text-blue-200 font-semibold'
                : 'bg-[#090d16] border-slate-800 text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-accent-blue/30 flex items-center justify-center text-[10px] font-bold">
              2
            </span>
            <span>Step 2: Project & Repository</span>
          </div>
        </div>

        {/* Prominent Security Notice */}
        <PATDisclaimerBanner />

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Completed State */}
        {completedDrainUrl ? (
          <div className="space-y-4 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-100">Setup Completed!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your project and microservice are registered. The autonomous Code Investigator is now authorized to inspect diffs and files.
              </p>
            </div>

            <div className="bg-[#050811] border border-slate-800 p-3 rounded-xl max-w-lg mx-auto text-left space-y-1 font-mono text-xs">
              <span className="text-slate-500 text-[10px] block">Your Live Ingestion Drain Webhook:</span>
              <span className="text-accent-blue break-all">{completedDrainUrl}</span>
            </div>

            <button
              onClick={closeOnboarding}
              className="px-6 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white font-semibold text-xs glow-blue inline-flex items-center gap-2"
            >
              <span>Launch Incident Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : step === 1 ? (
          /* STEP 1: PAT Verification */
          <form onSubmit={handleVerifyPat} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-200">
                GitHub Personal Access Token (PAT)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="github_pat_11A... or ghp_..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue"
                  required
                />
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
              <p className="text-[11px] text-slate-400">
                Token requires read-only access to repository contents to inspect commits and trace errors.
              </p>
            </div>

            {verifiedUser && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
                <img
                  src={verifiedUser.avatar_url}
                  alt={verifiedUser.login}
                  className="w-7 h-7 rounded-full border border-emerald-500/40"
                />
                <div>
                  <span className="font-semibold">{verifiedUser.name || verifiedUser.login}</span>
                  <span className="text-emerald-400/80 font-mono ml-1.5">(@{verifiedUser.login})</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                Encrypted in-memory with AES-128
              </span>
              <button
                type="submit"
                disabled={verifying || !tokenInput.trim()}
                className="px-4 py-2 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {verifying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Verifying Token...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: Project Creation & Repository Scoping */
          <form onSubmit={handleFinishOnboarding} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Project Workspace Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Payments Core or E-Commerce"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue"
                    required
                  />
                  <FolderPlus className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-200">
                  Service Identifier
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g. auth-service or checkout-api"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#090d16] border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue"
                    required
                  />
                  <Server className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* GitHub Repository Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-200">
                  Select Target Microservice Repository:
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {repos.length} repositories available
                </span>
              </div>

              {/* Repo Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchRepo}
                  onChange={(e) => setSearchRepo(e.target.value)}
                  placeholder="Filter repositories..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-blue"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              </div>

              {/* Repository List Box */}
              <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-[#090d16] divide-y divide-slate-800/60">
                {loadingRepos ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                    <span>Loading repositories from GitHub...</span>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching repositories found.
                  </div>
                ) : (
                  filteredRepos.map((repo) => {
                    const isSelected = selectedRepo?.id === repo.id;
                    return (
                      <div
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        className={`p-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-accent-blue/15 border-l-2 border-accent-blue text-slate-100 font-semibold'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5 truncate pr-2">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <GitBranch className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="truncate">{repo.full_name}</span>
                            {repo.private && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-[11px] text-slate-400 truncate">{repo.description}</p>
                          )}
                        </div>

                        {isSelected && <CheckCircle2 className="w-4 h-4 text-accent-blue shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                ← Back to Token
              </button>

              <button
                type="submit"
                disabled={submitting || !projectName.trim() || !selectedRepo}
                className="px-5 py-2.5 rounded-xl bg-accent-blue hover:bg-blue-600 text-white text-xs font-semibold glow-blue disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Configuring Project...</span>
                  </>
                ) : (
                  <>
                    <span>Finish Setup & Start Monitoring</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
