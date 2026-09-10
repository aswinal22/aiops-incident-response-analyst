import { HealthStatus, Incident, LogEntry, Project, Service } from './types';

// Support VITE_API_URL for separate cloud deployment (e.g. Render/Railway)
// Defaults to empty string to use Vite local proxy in development
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  let res: Response;

  try {
    res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (networkErr: any) {
    throw new ApiError(
      'Unable to connect to the AIOps service. Please check your network connection.',
      0
    );
  }

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    let cleanMessage = '';
    let parsedData: any = null;

    try {
      if (contentType.includes('application/json')) {
        parsedData = await res.json();
        if (typeof parsedData.detail === 'string') {
          cleanMessage = parsedData.detail;
        } else if (Array.isArray(parsedData.detail) && parsedData.detail.length > 0) {
          cleanMessage = parsedData.detail
            .map((item: any) => {
              if (typeof item === 'string') return item;
              const field = Array.isArray(item.loc) ? item.loc.filter((l: string) => l !== 'body').join(' ') : '';
              return field ? `${field}: ${item.msg || 'Invalid'}` : item.msg || 'Invalid field';
            })
            .join(', ');
        } else if (typeof parsedData.message === 'string') {
          cleanMessage = parsedData.message;
        } else if (typeof parsedData.error === 'string') {
          cleanMessage = parsedData.error;
        }
      } else {
        const rawText = await res.text();
        if (rawText && rawText.length < 200 && !rawText.includes('<html')) {
          cleanMessage = rawText;
        }
      }
    } catch {
      // JSON body parsing failed
    }

    // Strip technical error codes/prefixes if present in backend message
    if (cleanMessage) {
      cleanMessage = cleanMessage.replace(/^API Error \(\d+\):\s*/i, '').trim();
    }

    // Fallback to clear, human-friendly messages based on HTTP status
    if (!cleanMessage) {
      switch (res.status) {
        case 400:
          cleanMessage = 'The submitted information was invalid. Please check your inputs.';
          break;
        case 401:
          cleanMessage = 'Invalid credentials or session expired. Please sign in again.';
          break;
        case 403:
          cleanMessage = 'Access denied. You do not have permission for this action.';
          break;
        case 404:
          cleanMessage = 'The requested resource could not be found.';
          break;
        case 429:
          cleanMessage = 'Too many requests. Please wait a moment before trying again.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          cleanMessage = 'The server is temporarily unavailable. Please try again shortly.';
          break;
        default:
          cleanMessage = `Request failed (${res.statusText || 'Unknown'}). Please try again.`;
          break;
      }
    }

    throw new ApiError(cleanMessage, res.status, parsedData);
  }

  // If status is 200 but content is HTML, it means Vercel or proxy returned index.html fallback
  if (contentType.includes('text/html')) {
    throw new ApiError('Service connection error: Endpoint returned HTML. Please check backend status.', 200);
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

  deleteProject: (projectId: string) =>
    fetchApi<{ status: string; project_id: string }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

  deleteService: (serviceId: string) =>
    fetchApi<{ status: string; service_id: string }>(`/api/services/${serviceId}`, {
      method: 'DELETE',
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

  ingestFromUrl: (url: string, service = 'target-app') =>
    fetchApi<{
      status: string;
      url: string;
      service: string;
      total_processed: number;
      anomalies_detected: number;
      results: Array<{ message: string; prediction: string; confidence?: number; incident_id?: string }>;
    }>('/api/ingest-from-url', {
      method: 'POST',
      body: JSON.stringify({ url, service }),
    }),
};

