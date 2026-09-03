import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Project, Service, UserAccount } from '../lib/types';
import { validateGitHubPat } from '../lib/github';

interface AuthContextType {
  user: UserAccount | null;
  githubPat: string | null;
  patStatus: 'connected' | 'missing' | 'invalid';
  projects: Project[];
  activeProject: Project | null;
  activeService: Service | null;
  isLoading: boolean;
  login: (email_or_username: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string, full_name?: string) => Promise<void>;
  logout: () => void;
  saveGitHubPat: (pat: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  setActiveService: (service: Service | null) => void;
  refreshProjectsAndServices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'aiops_user_session',
  PAT: 'aiops_github_pat',
  ACTIVE_PROJECT: 'aiops_active_project',
  ACTIVE_SERVICE: 'aiops_active_service',
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
  const [user, setUser] = useState<UserAccount | null>(() => getSafeItem<UserAccount>(STORAGE_KEYS.USER));
  const [githubPat, setGithubPat] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PAT);
    } catch {
      return null;
    }
  });
  const [patStatus, setPatStatus] = useState<'connected' | 'missing' | 'invalid'>('missing');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProjectState] = useState<Project | null>(() => getSafeItem<Project>(STORAGE_KEYS.ACTIVE_PROJECT));
  const [activeService, setActiveServiceState] = useState<Service | null>(() => getSafeItem<Service>(STORAGE_KEYS.ACTIVE_SERVICE));
  const [isLoading, setIsLoading] = useState(false);

  // Validate PAT status on change
  useEffect(() => {
    if (githubPat) {
      validateGitHubPat(githubPat)
        .then(() => setPatStatus('connected'))
        .catch(() => setPatStatus('invalid'));
    } else {
      setPatStatus('missing');
    }
  }, [githubPat]);

  // Load Projects and Services from Backend API
  const refreshProjectsAndServices = async () => {
    setIsLoading(true);
    try {
      const [projList, svcList] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getServices().catch(() => []),
      ]);

      // Combine services into their projects
      const combinedProjects: Project[] = (projList || []).map((proj) => ({
        ...proj,
        services: (svcList || []).filter((s) => s.project_id === proj.id),
      }));

      // If no projects exist in database yet, create a default "Core Services" project
      if (combinedProjects.length === 0) {
        const defaultProj: Project = {
          id: 'default-project',
          name: 'Core Production Services',
          description: 'Default project workspace for microservice observability',
          created_at: new Date().toISOString(),
          services: (svcList || []).map((s) => ({
            ...s,
            log_drain_url: `/ingest-logs/${s.id || s.name}`,
          })),
        };
        combinedProjects.push(defaultProj);
      }

      setProjects(combinedProjects);

      // Set active project if none selected
      if (!activeProject && combinedProjects.length > 0) {
        const first = combinedProjects[0];
        setActiveProject(first);
        if (first.services && first.services.length > 0) {
          setActiveService(first.services[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching projects & services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshProjectsAndServices();
    }
  }, [user]);

  const login = async (email_or_username: string, password: string) => {
    try {
      const res = await api.login({
        email_or_username: email_or_username.trim(),
        password,
      });

      const userAcc: UserAccount = {
        username: res.user?.username || email_or_username,
        name: res.user?.full_name || res.user?.username || email_or_username.split('@')[0],
        role: 'Site Reliability Engineer',
        email: res.user?.email,
      };

      setUser(userAcc);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userAcc));
      await refreshProjectsAndServices();
    } catch (err: any) {
      throw new Error(err.message || 'Login failed.');
    }
  };

  const signup = async (email: string, username: string, password: string, full_name?: string) => {
    try {
      const res = await api.signup({
        email: email.trim(),
        username: username.trim(),
        password,
        full_name: full_name?.trim(),
      });

      const userAcc: UserAccount = {
        username: res.user?.username || username,
        name: res.user?.full_name || full_name || username,
        role: 'Site Reliability Engineer',
        email: res.user?.email || email,
      };

      setUser(userAcc);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userAcc));
      await refreshProjectsAndServices();
    } catch (err: any) {
      throw new Error(err.message || 'Signup failed.');
    }
  };

  const logout = () => {
    setUser(null);
    setActiveProjectState(null);
    setActiveServiceState(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVICE);
    } catch {}
  };

  const saveGitHubPat = async (pat: string) => {
    const clean = pat.trim();
    if (clean) {
      await validateGitHubPat(clean);
      setGithubPat(clean);
      setPatStatus('connected');
      try {
        localStorage.setItem(STORAGE_KEYS.PAT, clean);
      } catch {}
    } else {
      setGithubPat(null);
      setPatStatus('missing');
      try {
        localStorage.removeItem(STORAGE_KEYS.PAT);
      } catch {}
    }
  };

  const setActiveProject = (proj: Project | null) => {
    setActiveProjectState(proj);
    try {
      if (proj) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, JSON.stringify(proj));
        if (proj.services && proj.services.length > 0) {
          setActiveService(proj.services[0]);
        }
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT);
        setActiveService(null);
      }
    } catch {}
  };

  const setActiveService = (svc: Service | null) => {
    setActiveServiceState(svc);
    try {
      if (svc) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SERVICE, JSON.stringify(svc));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_SERVICE);
      }
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        githubPat,
        patStatus,
        projects,
        activeProject,
        activeService,
        isLoading,
        login,
        signup,
        logout,
        saveGitHubPat,
        setActiveProject,
        setActiveService,
        refreshProjectsAndServices,
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
