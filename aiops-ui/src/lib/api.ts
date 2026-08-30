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

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error (${res.status}): ${errorText || res.statusText}`);
  }

  return res.json();
}

export const api = {
  getHealth: () => fetchApi<HealthStatus>('/health'),

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

