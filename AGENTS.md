# AGENTS.md - Cloud-Native AIOps Multi-Agent Incident Response Platform

## 1. Project Overview & Architectural Blueprint
This is an enterprise-grade, cloud-native AIOps Incident Response & Observability Platform. It ingests stdout log streams from distributed microservices via HTTP POST log-drain endpoints (compatible with Render, Vercel, and Kubernetes). 

Incoming logs are classified in microseconds by a Scikit-Learn ML model (`model.joblib`). When an anomaly or error traceback is detected, it triggers a LangGraph multi-agent investigation workflow. The agents inspect codebase context, recent git commits, and upstream/downstream microservice dependencies via **Model Context Protocol (MCP)**, synthesise a 5-section Markdown Root Cause Analysis (RCA) report, and persist incidents and telemetry into **Supabase PostgreSQL**.

---

## 2. Directory Structure & Monorepo Boundaries
```text
aiops-incident-response-analyst/
├── AGENTS.md                          # Master AI Architecture & Design Specification
├── .gitignore                         # Strict exclusion for pycache, binaries, .env, .venv
├── .env.example                       # Clean environment template (KEY_NAME=)
├── target-app/                        # Sample Microservice Target Application
│   ├── main.py                        # FastAPI microservice emitting logs & simulating errors
│   ├── ARCHITECTURE.md                # Microservice architecture documentation
│   └── requirements.txt
└── aiops-engine/                      # Core AIOps Ingestion, ML & Multi-Agent Backend
    ├── main.py                        # FastAPI ingestion router (Rate Limited + Sanitized)
    ├── db.py                          # Supabase PostgreSQL persistence layer
    ├── requirements.txt               # Dependencies (FastAPI, LangGraph, Groq, SlowAPI, Sqlparse)
    ├── test_integration.py            # End-to-end integration test suite (100% pass)
    ├── test_security.py               # 5-Layer Security & DB Read-Only verification suite
    ├── ml/                            # Traditional ML Anomaly Detector
    │   ├── generate_data.py           # Synthetic log dataset generator (1000 logs)
    │   ├── train_model.py             # TF-IDF + Logistic Regression training pipeline
    │   ├── logs_dataset.csv           # Ground truth training data
    │   └── model.joblib               # Serialized ML model binary
    ├── utils/                         # Security & Utility Modules
    │   ├── __init__.py
    │   └── security.py                # Regex PII/Secret Redactor & SQL AST Read-Only Validator
    ├── agents/                        # LangGraph Multi-Agent Workflow
    │   ├── state.py                   # AgentState schema (logs, code, rca, metrics)
    │   └── graph.py                   # 3-Node Workflow with Groq Caching & Telemetry
    ├── mcp_servers/                   # MCP Codebase & Database Routers
    │   └── codebase_mcp.py            # FastMCP Server (Path Traversal Guard + Read-Only SQL)
    └── eval/                          # 4-Tier Modular Evaluation Benchmark Suite
        ├── dataset.py                 # Golden incident scenarios with ground truth
        ├── tier1_ml_eval.py           # Tier 1: ML Accuracy, Precision, Recall, FPR
        ├── tier2_agent_eval.py        # Tier 2: Agent Buffer Recall & MCP Tool Calling
        ├── tier3_rca_eval.py          # Tier 3: LLM-as-a-Judge RCA Report Scorecard
        ├── tier4_latency_eval.py      # Tier 4: Latency percentiles & throughput
        └── run_evals.py               # Unified CLI evaluation runner
```

---

## 3. Core Operational Pipeline

```
┌───────────────────────────┐      ┌───────────────────────────┐      ┌───────────────────────────┐
│ Distributed Microservices │ ───> │ Ingest Endpoint & Rate L1 │ ───> │ Layer 2 Input Sanitizer   │
│ (Render/Vercel Log Drain) │      │  (POST /ingest-logs)      │      │ (Scrubs PII/Secrets)      │
└───────────────────────────┘      └───────────────────────────┘      └─────────────┬─────────────┘
                                                                                    │
┌───────────────────────────┐      ┌───────────────────────────┐                    ▼
│ LangGraph Multi-Agent RCA │ <─── │ Anomaly Trigger (Class 1) │ <─── ┌───────────────────────────┐
│ (Log Analyst + MCP Code)  │      │ (In-memory Deque Buffer)  │      │ Scikit-Learn ML Model     │
└─────────────┬─────────────┘      └───────────────────────────┘      │ (TF-IDF + Logistic Reg)   │
              │                                                       └───────────────────────────┘
              ▼
┌───────────────────────────┐      ┌───────────────────────────┐
│ Output Sanitizer (L5)     │ ───> │ Supabase PostgreSQL       │
│ & Terminal Telemetry JSON │      │ (logs, incidents, traces) │
└───────────────────────────┘      └───────────────────────────┘
```

---

## 4. 5-Layer Security & Guardrail Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Ingress Rate Limiter (SlowAPI: 50 req/min per IP)            │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 2: PII & Secret Redaction on Input (Regex Sanitizer)            │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Indirect Prompt Injection Defense (<untrusted_log> + Caching)│
├────────────────────────────────────────────────────────────────────────┤
│  Layer 4: MCP Codebase Sandbox & Sensitive File Blacklist (Pathlib)    │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Output Guardrail Sanitizer (Final Report Secret Scrubber)    │
├────────────────────────────────────────────────────────────────────────┤
│  Database Guardrail: AST Read-Only SQL Validator (sqlparse SELECT-only)│
└────────────────────────────────────────────────────────────────────────┘
```

1. **Layer 1: Ingress Rate Limiting (`main.py`)**: `slowapi` enforces 50 requests/minute per client IP to eliminate Denial-of-Wallet attacks.
2. **Layer 2: Input Sanitization (`utils/security.py`)**: `sanitize_text()` scrubs AWS keys, JWTs, API keys, emails, DB passwords, bearer tokens, and credit cards before passing to ML, buffer, or DB.
3. **Layer 3: Prompt Injection Defense (`agents/graph.py`)**: Static system prompt prefix enables **Groq prompt caching**, while untrusted logs are strictly isolated in `<untrusted_log>...</untrusted_log>` tags with strict instruction boundaries.
4. **Layer 4: MCP Sandbox & Traversal Guards (`codebase_mcp.py`)**: Strict `Path.resolve().relative_to(base_dir)` prevents traversal attacks (`../../../../etc/passwd`). Sensitive file blacklist blocks `.env*`, `*.pem`, `*.key`, `id_rsa`, and credentials.
5. **Layer 5: Output Sanitization (`agents/graph.py`)**: The final generated RCA report passes through `sanitize_text()` before return.
6. **Database Read-Only Guardrail (`utils/security.py`)**: `validate_readonly_sql()` parses query ASTs via `sqlparse`, blocking `DROP`, `DELETE`, `UPDATE`, `INSERT`, `TRUNCATE`, and chained semicolon queries.

---

## 5. Database Schema & Persistence (Supabase PostgreSQL)

- **`logs` table**: Ingested log streams with timestamps, service names, anomaly flags, and ML confidence scores.
- **`incidents` table**: Generated RCA Markdown reports, executive summaries, detected exceptions, faulty files, MTTD/MTTR timestamps, and structured JSON remediation checklists (`immediate_fixes`, `long_term_prevention`).
- **`agent_traces` table**: Per-node latency measurements (`latency_ms`), token consumption (`input_tokens`, `output_tokens`), model names, and invoked MCP tools.
- **`incident_chat_messages` table**: Multi-turn conversational debugging history per incident.

---

## 6. Multi-Repo & Microservice Architecture (Scalable Design)

The system supports multiple projects and microservices with separate Git repositories.

### 6.1 Metadata Storage & Service Registry
- **`projects` Table**: `id` (UUID), `name` (Text), `description` (Text), `created_at` (Timestamp).
- **`services` Table**: `id` (UUID), `project_id` (UUID), `name` (Text), `repo_url` (Text), `repo_owner` (Text), `repo_name` (Text), `github_pat_encrypted` (Text), `workspace_path` (Text), `created_at` (Timestamp).

### 6.2 Smart Dynamic Log Ingestion
FastAPI exposes:
- `POST /ingest-logs/{service_id}`
The backend queries the Service Registry to resolve `service_id` to the microservice name, project, and repository metadata, injecting this context directly into `AgentState`.

### 6.3 Remote GitHub Integration via MCP (Replaces Local Cloning in Cloud)
The system connects to the official **GitHub MCP Server** (`@modelcontextprotocol/server-github`) / GitHub REST API to read code from user-provided repositories:
1. **Authentication**: Users provide a GitHub Personal Access Token (PAT) and Repo URL via API/UI.
2. **Encryption at Rest**: The PAT MUST be encrypted using `cryptography.fernet` (AES-128) before saving to the database.
3. **Dynamic Initialization**: When an anomaly triggers LangGraph, the engine:
   - Decrypts the PAT for the affected service in-memory.
   - Configures GitHub MCP credentials with `GITHUB_PERSONAL_ACCESS_TOKEN=<decrypted_token>`.
   - Passes repo owner and repo name into LangGraph `AgentState`.

### 6.4 Agent Tool Mapping (LangGraph -> GitHub MCP)
The Code Investigator Agent uses the following GitHub MCP tools:
- **`list_commits`**: Finds recent deployments and changes in the microservice repository.
- **`get_commit_diff`**: Inspects the exact code modifications introduced in the latest deployment.
- **`get_file_contents`**: Fetches the exact source code of the faulty file at the deployed commit SHA.
- **`search_code`**: Searches the repository for specific function definitions or error signatures.
- **Local Fallback**: For offline development and demo testing, falls back to `/target-app` or `/workspace/<service_name>/`.

### 6.5 Cross-Service Cascading Investigation
When a microservice fails (e.g., `payment-service` experiences a timeout connecting to `auth-service`), the Code Investigator uses the MCP router to inspect both repositories:
- `read_file("payment-service", "checkout.py")` $\rightarrow$ inspects client timeout / retry policy.
- `read_file("auth-service", "main.py")` $\rightarrow$ inspects the root cause failure in the upstream service.

---

## 7. LangGraph Agent Workflow Specifications

### Node 1: Log Analyst Agent
- Queries in-memory ring buffer (`collections.deque`) and recent database records for correlated logs matching the service and error signature.
- Produces correlated event trail in `state['related_logs']`.

### Node 2: Code Investigator Agent (MCP Router)
- Invokes MCP codebase / GitHub tools for the active microservice.
- Retrieves `ARCHITECTURE.md`, file structure, faulty source code lines, recent commit diffs, and cross-service dependencies.
- Produces deep technical context in `state['code_context']`.

### Node 3: RCA Synthesizer Agent (Groq LLM)
- Combines anomalous log, correlated buffer trail, and MCP code context.
- Prompts Groq LLM (`openai/gpt-oss-120b`) using static system prompt prefix for KV prompt caching.
- Emits structured JSON telemetry to stdout.
- Passes output through `sanitize_text()`.
- Updates `state['rca_report']` and persists records into Supabase `incidents` and `agent_traces`.

---

## 8. Code Generation & Development Guidelines
- Always use Python 3.10+ strict typing (`list[str]`, `dict[str, Any]`, `X | None`).
- Use `uv` package manager for all execution (`uv run --with-requirements requirements.txt ...`).
- Always define Pydantic models for API request and response schemas.
- Ensure all database SQL queries use parameterized binds (`:param`) and SQL standard `CAST()` syntax.
- Maintain zero secret exposure: all secrets must reside in `.env` (blocked by `.gitignore`).

