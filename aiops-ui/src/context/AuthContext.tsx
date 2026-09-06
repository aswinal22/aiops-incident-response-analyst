import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Project, Service, UserAccount } from '../lib/types';
import { validateGitHubPat } from '../lib/github';
import { SessionToastData } from '../components/auth/SessionVerifiedToast';

interface AuthContextType {
  user: UserAccount | null;
  githubPat: string | null;
  patStatus: 'connected' | 'missing' | 'invalid';
  projects: Project[];
  activeProject: Project | null;
  activeService: Service | null;
  isLoading: boolean;
  sessionToast: SessionToastData | null;
  dismissToast: () => void;
  login: (email_or_username: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string, full_name?: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  saveGitHubPat: (pat: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  setActiveService: (service: Service | null) => void;
  isOnboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToast, setSessionToast] = useState<SessionToastData | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const dismissToast = () => setSessionToast(null);
  const openOnboarding = () => setIsOnboardingOpen(true);
  const closeOnboarding = () => setIsOnboardingOpen(false);

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

      setProjects(combinedProjects);

      // Set active project if none selected or if activeProject no longer exists
      if (combinedProjects.length > 0) {
        if (!activeProject || !combinedProjects.some((p) => p.id === activeProject.id)) {
          const first = combinedProjects[0];
          setActiveProject(first);
          if (first.services && first.services.length > 0) {
            setActiveService(first.services[0]);
          } else {
            setActiveService(null);
          }
        }
      } else {
        setActiveProject(null);
        setActiveService(null);
      }
    } catch (err) {
      console.error('Error fetching projects & services:', err);
    }
  };

  // Check 24-Hour Expiry & Backend Token Verification on Mount / Tab Reopen
  useEffect(() => {
    const verifyCachedSession = async () => {
      const cached = getSafeItem<UserAccount>(STORAGE_KEYS.USER);
      if (!cached) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const now = Date.now();
      // 1. Strict 24-Hour Expiration Check
      if (cached.expires_at && now > cached.expires_at) {
        console.warn('[AIOps Auth] Cached 24-hour token expired. Requiring re-authentication.');
        logout();
        setIsLoading(false);
        return;
      }

      // 2. Token backend verification
      if (cached.token) {
        try {
          const res = await api.verifyToken(cached.token);
          if (res && res.status === 'valid') {
            const verifiedAccount: UserAccount = {
              ...cached,
              ...res.user,
              name: res.user?.full_name || cached.name,
              expires_at: res.expires_at || cached.expires_at,
            };
            setUser(verifiedAccount);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(verifiedAccount));

            // Trigger Pop-up Toast confirming backend check
            setSessionToast({
              username: verifiedAccount.username,
              name: verifiedAccount.name,
              expiresInHours: res.expires_in_hours || 24,
              isBackendVerified: true,
            });
          } else {
            logout();
          }
        } catch (err) {
          console.warn('[AIOps Auth] Backend check notice (offline or network fallback):', err);
          // Graceful fallback for offline development or Vercel static mode
          const remainingHours = cached.expires_at ? Math.max(0, (cached.expires_at - now) / 3600000) : 24;
          setSessionToast({
            username: cached.username,
            name: cached.name,
            expiresInHours: remainingHours,
            isBackendVerified: false,
          });
        }
      } else {
        // Stamp 24-hour expiration for legacy sessions
        const expires_at = Date.now() + 24 * 3600 * 1000;
        const updated = { ...cached, expires_at };
        setUser(updated);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      }

      setIsLoading(false);
    };

    verifyCachedSession();
  }, []);

  useEffect(() => {
    if (user) {
      refreshProjectsAndServices().then(() => {
        // If user has no PAT or no projects yet, open the onboarding wizard automatically
        if (!githubPat || projects.length === 0) {
          setIsOnboardingOpen(true);
        }
      });
    }
  }, [user]);

  const login = async (email_or_username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({
        email_or_username: email_or_username.trim(),
        password,
      });

      const userAcc: UserAccount = {
        id: res.user?.id,
        username: res.user?.username || email_or_username,
        name: res.user?.full_name || res.user?.username || email_or_username.split('@')[0],
        role: res.user?.role,
        email: res.user?.email,
        token: res.token,
        expires_at: res.expires_at || (Date.now() + 24 * 3600 * 1000),
      };

      setUser(userAcc);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userAcc));
      await refreshProjectsAndServices();
    } catch (err: any) {
      throw new Error(err.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, username: string, password: string, full_name?: string) => {
    setIsLoading(true);
    try {
      const res = await api.signup({
        email: email.trim(),
        username: username.trim(),
        password,
        full_name: full_name?.trim(),
      });

      const userAcc: UserAccount = {
        id: res.user?.id,
        username: res.user?.username || username,
        name: res.user?.full_name || full_name || username,
        role: res.user?.role,
        email: res.user?.email || email,
        token: res.token,
        expires_at: res.expires_at || (Date.now() + 24 * 3600 * 1000),
      };

      setUser(userAcc);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userAcc));
      await refreshProjectsAndServices();
    } catch (err: any) {
      throw new Error(err.message || 'Signup failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async () => {
    setIsLoading(true);
    try {
      // 24-hour demo token
      const expires_at = Date.now() + 24 * 3600 * 1000;
      const demoAcc: UserAccount = {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'sre_lead',
        name: 'Alex Morgan',
        role: undefined,
        email: 'alex@aiops.corp',
        token: `demo.${Math.floor(expires_at / 1000)}.aiops_demo_sig`,
        expires_at,
      };

      setUser(demoAcc);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(demoAcc));
      await refreshProjectsAndServices();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setActiveProjectState(null);
    setActiveServiceState(null);
    setSessionToast(null);
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
        sessionToast,
        dismissToast,
        login,
        signup,
        demoLogin,
        logout,
        saveGitHubPat,
        setActiveProject,
        setActiveService,
        isOnboardingOpen,
        openOnboarding,
        closeOnboarding,
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
