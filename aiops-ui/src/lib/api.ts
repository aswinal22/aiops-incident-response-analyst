import { HealthStatus, Incident, LogEntry, Project, Service } from './types';

// Support VITE_API_URL for separate cloud deployment (e.g. Render/Railway)
// Defaults to empty string to use Vite local proxy in development
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
    } catch {
      const text = await res.text();
      errorDetail = text.slice(0, 150) || res.statusText;
    }
    throw new Error(`API Error (${res.status}): ${errorDetail}`);
  }

  // If status is 200 but content is HTML, it means Vercel or proxy returned index.html fallback
  if (contentType.includes('text/html')) {
    throw new Error('Backend API endpoint returned HTML. Ensure VITE_API_URL points to active backend service.');
  }

  return res.json();
}

export const api = {
  signup: (payload: { email: string; username: string; password: string; full_name?: string }) =>
    fetchApi<{ status: string; user: any; token: string; expires_at: number }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email_or_username: string; password: string }) =>
    fetchApi<{ status: string; user: any; token: string; expires_at: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  verifyToken: (token: string) =>
    fetchApi<{ status: string; user: any; token: string; expires_at: number; expires_in_hours: number }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  getHealth: () => fetchApi<HealthStatus>('/api/health'),

  getBuffer: (limit = 100) => fetchApi<{ total_buffered: number; returned: number; logs: LogEntry[] }>(`/buffer?limit=${limit}`),

  getIncidents: (service?: string) => {
    const query = service ? `?service=${encodeURIComponent(service)}` : '';
    return fetchApi<Incident[]>(`/api/incidents${query}`);
  },

  getIncidentById: (id: string) => fetchApi<Incident>(`/api/incidents/${id}`),

  updateIncident: (id: string, payload: { status?: string; immediate_fixes?: any[]; long_term_prevention?: any[] }) =>
    fetchApi<{ status: string; incident_id: string }>(`/api/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getProjects: () => fetchApi<Project[]>('/api/projects'),

  createProject: (payload: { name: string; description?: string }) =>
    fetchApi<{ status: string; project_id: string; name: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getServices: (projectId?: string) => {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    return fetchApi<Service[]>(`/api/services${query}`);
  },

  createService: (payload: {
    project_id: string;
    name: string;
    repo_url?: string;
    repo_owner?: string;
    repo_name?: string;
    github_pat?: string;
    workspace_path?: string;
  }) =>
    fetchApi<{ status: string; service_id: string; name: string; ingest_url: string }>('/api/services', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  simulateError: (error_type = 'file_not_found', service = 'target-app') =>
    fetchApi<any>('/api/simulate-error', {
      method: 'POST',
      body: JSON.stringify({ error_type, service }),
    }),

  ingestLog: (message: string, service = 'target-app', serviceId?: string) => {
    const endpoint = serviceId ? `/ingest-logs/${serviceId}` : '/ingest-logs';
    return fetchApi<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        message,
        service,
        timestamp: new Date().toISOString(),
      }),
    });
  },
};

