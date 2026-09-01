export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string;
  email?: string;
  public_repos?: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export interface Service {
  id: string;
  project_id: string;
  name: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  workspace_path?: string;
  created_at: string;
  log_drain_url?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  services?: Service[];
}

export interface UserAccount {
  username: string;
  name: string;
  role: string;
  email?: string;
}

export interface Incident {
  id: string;
  trigger_log_id?: string;
  service: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Investigating' | 'Mitigating' | 'Resolved' | 'Closed';
  incident_summary: string;
  detected_exception: string;
  faulty_file: string;
  rca_report_markdown?: string;
  immediate_fixes?: Array<{ task: string; done: boolean }>;
  long_term_prevention?: Array<{ recommendation: string; details?: string; done?: boolean }>;
  mttd_seconds?: number;
  mttr_seconds?: number;
  created_at: string;
  resolved_at?: string;
  traces?: AgentTrace[];
}

export interface AgentTrace {
  id: string;
  incident_id: string;
  node_name: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model_name: string;
  mcp_tools_invoked?: string[];
  created_at: string;
}

export interface LogEntry {
  id?: string;
  message: string;
  timestamp?: string;
  service: string;
  service_id?: string;
  is_anomaly?: boolean;
  confidence_score?: number;
}

export interface HealthStatus {
  status: string;
  service: string;
  model_loaded: string;
  database_connected: string;
  rate_limiting_active: string;
  buffer_size: string;
}
