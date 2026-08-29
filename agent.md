# AGENTS.md - Cloud-Native AIOps Multi-Agent Incident Response Platform

*(This file is synchronized with [AGENTS.md](file:///e:/log_detection/aiops-incident-response-analyst/AGENTS.md). Please refer to `AGENTS.md` as the primary architectural blueprint.)*

## Master Architectural Specifications:
1. **Multi-Repo & Remote GitHub Integration via MCP**:
   - Remote GitHub MCP Server (`@modelcontextprotocol/server-github`) / GitHub REST API.
   - Dynamic per-service credentials with `cryptography.fernet` encryption at rest.
   - Tools: `list_commits`, `get_commit_diff`, `get_file_contents`, `search_code`.
   - Cross-Service cascading failure analysis across microservices.
2. **5-Layer Security & Guardrails**:
   - Layer 1: Ingress Rate Limiting (`SlowAPI` 50 req/min).
   - Layer 2: Input PII & Secret Redaction (Regex Sanitizer).
   - Layer 3: Indirect Prompt Injection Defense (`<untrusted_log>` & Groq KV Caching).
   - Layer 4: MCP Sandbox & Sensitive File Blacklist (`Path.resolve().relative_to()`).
   - Layer 5: Output Guardrail Secret Scrubber.
   - Database Guardrail: AST Read-Only SQL Validator (`sqlparse` SELECT-only).
3. **Database & Telemetry Persistence**:
   - Supabase PostgreSQL (`logs`, `incidents`, `agent_traces`, `incident_chat_messages`).
   - Full Markdown RCA storage & structured JSON checklists (`immediate_fixes`, `long_term_prevention`).
4. **Traditional ML Anomaly Gatekeeper**:
   - Scikit-Learn TF-IDF + Logistic Regression running locally in microseconds.
5. **LangGraph 3-Node Workflow**:
   - Log Analyst $\rightarrow$ Code Investigator (MCP) $\rightarrow$ RCA Synthesizer (Groq LLM).
