export interface BenchmarkScenario {
  id: string;
  scenario_id: string;
  title: string;
  service: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  exception_type: string;
  trigger_log: string;
  sanitized_log: string;
  faulty_file: string;
  faulty_line: number;
  code_snippet: string;
  tier1_ml: {
    prediction: 'Anomaly (Class 1)' | 'Normal (Class 0)';
    confidence: number;
    latency_ms: number;
    vectorizer: string;
    model_name: string;
    keywords_detected: string[];
    gatekeeper_action: string;
  };
  tier2_agent: {
    buffer_recall_success: boolean;
    correlated_logs_count: number;
    correlated_logs: Array<{ timestamp: string; message: string; service: string }>;
    mcp_tools_called: Array<{ tool: string; args: string; status: string; latency_ms: number }>;
    resolved_file: string;
    git_commit_sha: string;
    git_commit_msg: string;
  };
  tier3_rca: {
    rca_markdown: string;
    judge_score: number;
    judge_reasoning: string;
    rubric_scores: {
      root_cause_accuracy: number;
      code_grounding: number;
      format_compliance: number;
      remediation_clarity: number;
      security_pii_scrubbed: number;
    };
    ground_truth_keywords_matched: string[];
  };
  tier4_latency: {
    total_pipeline_ms: number;
    breakdown: Array<{ stage: string; latency_ms: number; color: string }>;
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    estimated_cost_usd: string;
  };
}

export const GOLDEN_BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: 'inc-001',
    scenario_id: 'INC-001',
    title: 'Missing Configuration File on Boot',
    service: 'target-app',
    severity: 'critical',
    exception_type: 'FileNotFoundError',
    trigger_log: `ERROR: [target-app] Simulated Application Failure [FileNotFoundError]: Configuration file '/app/config/settings.yaml' not found in path.
Traceback (most recent call last):
  File "/app/main.py", line 42, in simulate_error
    raise FileNotFoundError("Configuration file '/app/config/settings.yaml' not found in path.")
FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path.`,
    sanitized_log: `ERROR: [target-app] Simulated Application Failure [FileNotFoundError]: Configuration file '/app/config/settings.yaml' not found in path.
Traceback (most recent call last):
  File "/app/main.py", line 42, in simulate_error
    raise FileNotFoundError("Configuration file '/app/config/settings.yaml' not found in path.")
FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path.`,
    faulty_file: 'main.py',
    faulty_line: 42,
    code_snippet: `@app.get("/config")
def load_config():
    # Attempting to load missing settings file
    config_path = Path("/app/config/settings.yaml")
    if not config_path.exists():
        raise FileNotFoundError("Configuration file '/app/config/settings.yaml' not found in path.")
    return {"status": "loaded"}`,
    tier1_ml: {
      prediction: 'Anomaly (Class 1)',
      confidence: 0.9984,
      latency_ms: 0.68,
      vectorizer: 'TF-IDF (1000 max features, sublinear tf)',
      model_name: 'LogisticRegression(C=1.0, class_weight=balanced)',
      keywords_detected: ['error', 'traceback', 'filenotfounderror', 'failed'],
      gatekeeper_action: 'Triggered Multi-Agent LangGraph RCA Workflow',
    },
    tier2_agent: {
      buffer_recall_success: true,
      correlated_logs_count: 2,
      correlated_logs: [
        {
          timestamp: '2026-08-28T18:00:00Z',
          message: 'INFO: 127.0.0.1:54320 - "GET / HTTP/1.1" 200 OK',
          service: 'target-app',
        },
        {
          timestamp: '2026-08-28T18:00:01Z',
          message: 'INFO: [target-app] Initiating file loading routine from /app/config/settings.yaml',
          service: 'target-app',
        },
      ],
      mcp_tools_called: [
        { tool: 'read_architecture_context', args: '()', status: '200 OK', latency_ms: 1.2 },
        { tool: 'get_file_structure', args: '()', status: '200 OK', latency_ms: 2.1 },
        { tool: 'get_recent_git_changes', args: '()', status: '200 OK', latency_ms: 3.4 },
        { tool: 'read_file', args: "('main.py')", status: '200 OK', latency_ms: 1.8 },
      ],
      resolved_file: 'target-app/main.py',
      git_commit_sha: 'e4f9b1c',
      git_commit_msg: 'refactor: decouple configuration loader from environment defaults',
    },
    tier3_rca: {
      rca_markdown: `### 1. Incident Summary
- **Service**: \`target-app\`
- **Detected Exception**: \`FileNotFoundError\`
- **Faulty Source File**: \`target-app/main.py:42\`
- **Root Cause**: The application attempted to read \`/app/config/settings.yaml\` during route initialization without ensuring the configuration directory was mounted or providing fallback defaults.

### 2. Microservice Context & Correlated Logs
Recent commit \`e4f9b1c\` removed inline default fallback configs. Ingested buffer logs show file initialization was triggered right before the runtime crash.

### 3. Root Cause Analysis
The \`load_config\` endpoint assumes \`/app/config/settings.yaml\` exists on disk. In containerized environments where the config volume is not mounted, the service throws an unhandled \`FileNotFoundError\`.

### 4. Immediate Remediation Checklist
- [ ] Add fallback dictionary defaults when \`settings.yaml\` is missing.
- [ ] Wrap config file reading inside a \`try...except FileNotFoundError\` block.
- [ ] Mount configuration volume in Kubernetes manifest / Docker compose.

### 5. Long-Term Architectural Fixes
- [ ] Migrate configuration parsing to Pydantic \`BaseSettings\` with environment variable priority.
- [ ] Add pre-flight healthcheck validating configuration file presence before binding HTTP port.`,
      judge_score: 4.95,
      judge_reasoning:
        'The generated RCA accurately pinpointed the exact line in main.py, correctly cited the missing settings.yaml file, and provided actionable immediate and long-term remediation checklists.',
      rubric_scores: {
        root_cause_accuracy: 5.0,
        code_grounding: 5.0,
        format_compliance: 5.0,
        remediation_clarity: 4.9,
        security_pii_scrubbed: 5.0,
      },
      ground_truth_keywords_matched: ['settings.yaml', 'FileNotFoundError', 'missing', 'config', 'main.py'],
    },
    tier4_latency: {
      total_pipeline_ms: 5120,
      breakdown: [
        { stage: 'ML Anomaly Gatekeeper', latency_ms: 0.68, color: '#38bdf8' },
        { stage: 'Node 1: Ring Buffer Analyst', latency_ms: 1.25, color: '#818cf8' },
        { stage: 'Node 2: Codebase MCP Tools', latency_ms: 8.5, color: '#c084fc' },
        { stage: 'Node 3: Groq LLM RCA Synthesis', latency_ms: 5110.0, color: '#fb7185' },
      ],
      input_tokens: 1842,
      output_tokens: 412,
      cached_tokens: 1150,
      estimated_cost_usd: '$0.00012',
    },
  },
  {
    id: 'inc-002',
    scenario_id: 'INC-002',
    title: 'Zero Division in User Discount Calculation',
    service: 'target-app',
    severity: 'high',
    exception_type: 'ZeroDivisionError',
    trigger_log: `ERROR: [target-app] Simulated Application Failure [ZeroDivisionError]: division by zero
Traceback (most recent call last):
  File "/app/main.py", line 58, in calculate_user_discount
    discount_rate = total_points / active_referrals
ZeroDivisionError: division by zero`,
    sanitized_log: `ERROR: [target-app] Simulated Application Failure [ZeroDivisionError]: division by zero
Traceback (most recent call last):
  File "/app/main.py", line 58, in calculate_user_discount
    discount_rate = total_points / active_referrals
ZeroDivisionError: division by zero`,
    faulty_file: 'main.py',
    faulty_line: 58,
    code_snippet: `def calculate_user_discount(total_points: float, active_referrals: int) -> float:
    # Unhandled division when referrals equal zero
    discount_rate = total_points / active_referrals
    return min(discount_rate * 0.05, 0.50)`,
    tier1_ml: {
      prediction: 'Anomaly (Class 1)',
      confidence: 0.9991,
      latency_ms: 0.62,
      vectorizer: 'TF-IDF (1000 max features, sublinear tf)',
      model_name: 'LogisticRegression(C=1.0, class_weight=balanced)',
      keywords_detected: ['error', 'traceback', 'zerodivisionerror', 'division by zero'],
      gatekeeper_action: 'Triggered Multi-Agent LangGraph RCA Workflow',
    },
    tier2_agent: {
      buffer_recall_success: true,
      correlated_logs_count: 2,
      correlated_logs: [
        {
          timestamp: '2026-08-28T18:00:00Z',
          message: 'INFO: 127.0.0.1:54320 - "GET / HTTP/1.1" 200 OK',
          service: 'target-app',
        },
        {
          timestamp: '2026-08-28T18:00:02Z',
          message: 'INFO: [target-app] Executing calculate_user_discount routine with zero denominator.',
          service: 'target-app',
        },
      ],
      mcp_tools_called: [
        { tool: 'read_architecture_context', args: '()', status: '200 OK', latency_ms: 1.1 },
        { tool: 'get_file_structure', args: '()', status: '200 OK', latency_ms: 2.0 },
        { tool: 'read_file', args: "('main.py')", status: '200 OK', latency_ms: 1.9 },
      ],
      resolved_file: 'target-app/main.py',
      git_commit_sha: 'a8d2910',
      git_commit_msg: 'feat: add tiered referral discount formula',
    },
    tier3_rca: {
      rca_markdown: `### 1. Incident Summary
- **Service**: \`target-app\`
- **Detected Exception**: \`ZeroDivisionError\`
- **Faulty Source File**: \`target-app/main.py:58\`
- **Root Cause**: \`calculate_user_discount\` executed arithmetic division without guarding against \`active_referrals == 0\`.

### 2. Microservice Context & Correlated Logs
Incoming discount requests for newly registered accounts with 0 referrals trigger an immediate unhandled \`ZeroDivisionError\` 500 status code.

### 3. Root Cause Analysis
The function \`calculate_user_discount(total_points, active_referrals)\` evaluates \`total_points / active_referrals\` without validating that \`active_referrals > 0\`.

### 4. Immediate Remediation Checklist
- [ ] Add guard clause: \`if active_referrals <= 0: return 0.0\`.
- [ ] Add unit test case verifying discount calculation with 0 referrals.

### 5. Long-Term Architectural Fixes
- [ ] Implement input validation schemas with Pydantic \`conint(ge=1)\`.
- [ ] Establish pre-commit linting rules to flag unguarded denominator arithmetic.`,
      judge_score: 4.98,
      judge_reasoning:
        'Accurately identified the denominator zero check bug in calculate_user_discount with immediate guard clause fixes and long-term Pydantic constraint recommendations.',
      rubric_scores: {
        root_cause_accuracy: 5.0,
        code_grounding: 5.0,
        format_compliance: 5.0,
        remediation_clarity: 5.0,
        security_pii_scrubbed: 5.0,
      },
      ground_truth_keywords_matched: ['ZeroDivisionError', 'division by zero', 'calculate_user_discount', 'main.py'],
    },
    tier4_latency: {
      total_pipeline_ms: 4890,
      breakdown: [
        { stage: 'ML Anomaly Gatekeeper', latency_ms: 0.62, color: '#38bdf8' },
        { stage: 'Node 1: Ring Buffer Analyst', latency_ms: 1.18, color: '#818cf8' },
        { stage: 'Node 2: Codebase MCP Tools', latency_ms: 5.0, color: '#c084fc' },
        { stage: 'Node 3: Groq LLM RCA Synthesis', latency_ms: 4883.2, color: '#fb7185' },
      ],
      input_tokens: 1710,
      output_tokens: 380,
      cached_tokens: 1150,
      estimated_cost_usd: '$0.00010',
    },
  },
  {
    id: 'inc-003',
    scenario_id: 'INC-003',
    title: 'PostgreSQL Connection Pool Exhaustion Timeout',
    service: 'auth-service',
    severity: 'critical',
    exception_type: 'OperationalError',
    trigger_log: `FATAL: [auth-service] Connection pool exhausted. Timeout occurred while waiting for available SQLAlchemy connection from pool after 30000ms.
Traceback (most recent call last):
  File "sqlalchemy/pool/base.py", line 125, in _do_get
    raise TimeoutError("QueuePool limit of size 5 overflow 10 reached, connection timed out.")
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) connection pool timeout`,
    sanitized_log: `FATAL: [auth-service] Connection pool exhausted. Timeout occurred while waiting for available SQLAlchemy connection from pool after 30000ms.
Traceback (most recent call last):
  File "sqlalchemy/pool/base.py", line 125, in _do_get
    raise TimeoutError("QueuePool limit of size 5 overflow 10 reached, connection timed out.")
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) connection pool timeout`,
    faulty_file: 'db.py',
    faulty_line: 32,
    code_snippet: `engine = create_engine(
    DATABASE_URL,
    pool_size=5,       # Too low for concurrent traffic spikes
    max_overflow=10,
    pool_timeout=30,
)`,
    tier1_ml: {
      prediction: 'Anomaly (Class 1)',
      confidence: 0.9995,
      latency_ms: 0.74,
      vectorizer: 'TF-IDF (1000 max features, sublinear tf)',
      model_name: 'LogisticRegression(C=1.0, class_weight=balanced)',
      keywords_detected: ['fatal', 'timeout', 'operationalerror', 'connection pool'],
      gatekeeper_action: 'Triggered Multi-Agent LangGraph RCA Workflow',
    },
    tier2_agent: {
      buffer_recall_success: true,
      correlated_logs_count: 4,
      correlated_logs: [
        {
          timestamp: '2026-08-28T18:00:00Z',
          message: 'WARN: [auth-service] High concurrent token verification spike (250 req/s)',
          service: 'auth-service',
        },
        {
          timestamp: '2026-08-28T18:00:05Z',
          message: 'WARN: [auth-service] Connection pool utilization reached 95%',
          service: 'auth-service',
        },
      ],
      mcp_tools_called: [
        { tool: 'read_architecture_context', args: '()', status: '200 OK', latency_ms: 1.3 },
        { tool: 'read_file', args: "('db.py')", status: '200 OK', latency_ms: 2.1 },
      ],
      resolved_file: 'auth-service/db.py',
      git_commit_sha: 'c3b1712',
      git_commit_msg: 'config: lower connection pool size for staging test',
    },
    tier3_rca: {
      rca_markdown: `### 1. Incident Summary
- **Service**: \`auth-service\`
- **Detected Exception**: \`OperationalError (Connection Pool Timeout)\`
- **Faulty Source File**: \`auth-service/db.py:32\`
- **Root Cause**: SQLAlchemy connection pool (\`pool_size=5\`) exhausted during peak concurrency, blocking worker threads.

### 2. Microservice Context & Correlated Logs
Traffic spiked to 250 req/s, while database pool size was restricted to 5 connections with a 30s timeout.

### 3. Root Cause Analysis
Recent configuration commit \`c3b1712\` lowered \`pool_size\` to 5. Under multi-threaded traffic, queries failed to acquire connections within the timeout threshold.

### 4. Immediate Remediation Checklist
- [ ] Increase \`pool_size=20\` and \`max_overflow=30\` in \`db.py\`.
- [ ] Ensure all database sessions use context managers (\`with engine.connect()\`) to prevent connection leaks.

### 5. Long-Term Architectural Fixes
- [ ] Deploy PgBouncer connection pooler in transaction mode.
- [ ] Implement Redis session caching to offload repetitive token validation queries.`,
      judge_score: 4.92,
      judge_reasoning:
        'Correctly identified connection pool exhaustion, correlated traffic spikes, and proposed immediate PgBouncer and pool size adjustments.',
      rubric_scores: {
        root_cause_accuracy: 5.0,
        code_grounding: 4.8,
        format_compliance: 5.0,
        remediation_clarity: 5.0,
        security_pii_scrubbed: 5.0,
      },
      ground_truth_keywords_matched: ['OperationalError', 'connection pool', 'timeout', 'db.py'],
    },
    tier4_latency: {
      total_pipeline_ms: 5310,
      breakdown: [
        { stage: 'ML Anomaly Gatekeeper', latency_ms: 0.74, color: '#38bdf8' },
        { stage: 'Node 1: Ring Buffer Analyst', latency_ms: 1.45, color: '#818cf8' },
        { stage: 'Node 2: Codebase MCP Tools', latency_ms: 3.4, color: '#c084fc' },
        { stage: 'Node 3: Groq LLM RCA Synthesis', latency_ms: 5304.4, color: '#fb7185' },
      ],
      input_tokens: 1950,
      output_tokens: 440,
      cached_tokens: 1150,
      estimated_cost_usd: '$0.00014',
    },
  },
];
