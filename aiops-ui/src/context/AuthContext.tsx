import React, { createContext, useContext, useEffect, useState } from 'react';
import { GitHubRepo, GitHubUser, LogStream } from '../lib/types';
import { fetchUserRepositories, validateGitHubPat } from '../lib/github';

interface AuthContextType {
  user: GitHubUser | null;
  githubPat: string | null;
  activeStream: LogStream | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userRepos: GitHubRepo[];
  loginWithPat: (pat: string) => Promise<GitHubUser>;
  loginWithCredentials: (username: string, password: string, pat: string) => Promise<GitHubUser>;
  logout: () => void;
  setActiveStream: (stream: LogStream | null) => void;
  refreshRepos: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'aiops_user',
  PAT: 'aiops_github_pat',
  ACTIVE_STREAM: 'aiops_active_stream',
};

function getSafeItem<T>(key: string): T | null {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GitHubUser | null>(() => getSafeItem<GitHubUser>(STORAGE_KEYS.USER));
  const [githubPat, setGithubPat] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PAT);
    } catch {
      return null;
    }
  });
  const [activeStream, setActiveStreamState] = useState<LogStream | null>(() => getSafeItem<LogStream>(STORAGE_KEYS.ACTIVE_STREAM));
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load repositories when PAT is available
  useEffect(() => {
    if (githubPat) {
      loadRepos(githubPat);
    } else {
      setUserRepos([]);
      setIsLoading(false);
    }
  }, [githubPat]);

  const loadRepos = async (pat: string) => {
    try {
      const repos = await fetchUserRepositories(pat);
      setUserRepos(repos);

      // Auto-set default stream if none selected
      if (!activeStream && repos.length > 0) {
        const firstRepo = repos[0];
        const defaultStream: LogStream = {
          id: firstRepo.name,
          name: firstRepo.name,
          repo_name: firstRepo.name,
          repo_owner: firstRepo.owner.login,
          repo_url: firstRepo.html_url,
          log_drain_url: `/ingest-logs/${firstRepo.name}`,
          source_type: 'github_repo',
          created_at: new Date().toISOString(),
        };
        setActiveStream(defaultStream);
      }
    } catch (err) {
      console.warn('Could not load user repos on mount:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithPat = async (pat: string): Promise<GitHubUser> => {
    setIsLoading(true);
    try {
      const ghUser = await validateGitHubPat(pat);
      setUser(ghUser);
      setGithubPat(pat);
      try {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(ghUser));
        localStorage.setItem(STORAGE_KEYS.PAT, pat);
      } catch (storageErr) {
        console.warn('LocalStorage save failed:', storageErr);
      }
      await loadRepos(pat);
      return ghUser;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithCredentials = async (
    username: string,
    _password: string,
    pat: string
  ): Promise<GitHubUser> => {
    const ghUser = await loginWithPat(pat);
    return ghUser;
  };

  const logout = () => {
    setUser(null);
    setGithubPat(null);
    setActiveStreamState(null);
    setUserRepos([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.PAT);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_STREAM);
    } catch (storageErr) {
      console.warn('LocalStorage clear failed:', storageErr);
    }
  };

  const setActiveStream = (stream: LogStream | null) => {
    setActiveStreamState(stream);
    try {
      if (stream) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_STREAM, JSON.stringify(stream));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_STREAM);
      }
    } catch (storageErr) {
      console.warn('LocalStorage active stream save failed:', storageErr);
    }
  };

  const refreshRepos = async () => {
    if (githubPat) {
      await loadRepos(githubPat);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        githubPat,
        activeStream,
        isAuthenticated: !!user && !!githubPat,
        isLoading,
        userRepos,
        loginWithPat,
        loginWithCredentials,
        logout,
        setActiveStream,
        refreshRepos,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
