# AGENTS.md - Project Blueprint & Context

## 1. Project Overview
This is a Cloud-Native AIOps Monorepo. It contains a "Target App" that emits logs to stdout, and an "AIOps Engine" that ingests these logs via an HTTP POST endpoint (simulating a Render/Vercel Log Drain). The AIOps Engine uses a Traditional Scikit-learn ML model to classify the log as Normal or Anomaly. If an anomaly is detected, it triggers a LangGraph multi-agent workflow. The agents use a custom MCP (Model Context Protocol) server to investigate the Target App's codebase and generate a final Root Cause Analysis (RCA) Markdown report.

**CRITICAL CONSTRAINTS:**
- NO UI/Frontend code shall be generated. Everything is backend/API driven.
- NO SQL/NoSQL databases. Use in-memory `collections.deque` for log storage.
- NO local file logging in the Target App. Use stdout only.
- LLM Provider MUST be Groq (using OpenAI API standards).

## 2. Directory Structure & File Boundaries
```text
aiops-rca-system/
├── AGENTS.md
├── docker-compose.yml
├── target-app/
│   ├── main.py
│   ├── ARCHITECTURE.md
│   └── requirements.txt
└── aiops-engine/
    ├── main.py
    ├── requirements.txt
    ├── ml/
    │   ├── generate_data.py
    │   ├── train_model.py
    │   └── model.joblib
    ├── agents/
    │   ├── state.py
    │   └── graph.py
    └── mcp_servers/
        └── codebase_mcp.py
```

## 3. Target App Specifications (`/target-app`)
**Purpose:** A dummy FastAPI microservice that generates logs.
- **Endpoint 1:** `GET /` -> Returns a success message and logs an INFO message.
- **Endpoint 2:** `GET /simulate-error` -> Randomly triggers one of three errors (FileNotFound, ZeroDivisionError, or DB Connection Timeout) and logs the traceback to stdout via `logging.error()`.
- **`ARCHITECTURE.md`:** Must contain a brief description of the app, its endpoints, and the fact that it uses `main.py`.
- **Tech Stack:** FastAPI, Uvicorn, standard `logging`.

## 4. AIOps Engine Specifications (`/aiops-engine`)
**Purpose:** The core backend that ingests logs, runs ML inference, and triggers agents.

### 4.1 FastAPI Endpoints (`/aiops-engine/main.py`)
- **Endpoint 1:** `POST /ingest-logs`
  - **Request Body (Pydantic Model `LogPayload`):** `message: str`, `timestamp: str`, `service: str`.
  - **Logic:**
    1. Append log to in-memory ring buffer (`collections.deque(maxlen=1000)`).
    2. Pass `message` to the loaded ML model (`model.predict()`).
    3. If model predicts `1` (Anomaly), trigger the LangGraph workflow, passing the anomalous log message.
    4. Return JSON: `{"status": "received", "prediction": "Anomaly"|"Normal"}`.
- **Endpoint 2:** `GET /health` -> Returns `{"status": "ok"}`.
- **Startup Event:** Load `model.joblib` into memory.

### 4.2 Traditional ML Pipeline (`/aiops-engine/ml/`)
- **`generate_data.py`:**
  - Must generate a synthetic dataset named `logs_dataset.csv`.
  - Columns: `log_text` (string), `label` (int: 0 for Normal, 1 for Anomaly).
  - Generate 1000 rows: 500 normal HTTP logs (e.g., "GET / 200 OK"), 500 error logs (Python tracebacks containing "Error", "Exception", "Traceback").
- **`train_model.py`:**
  - Import `pandas`, `sklearn.model_selection.train_test_split`, `sklearn.feature_extraction.text.TfidfVectorizer`, `sklearn.linear_model.LogisticRegression`, `sklearn.pipeline.Pipeline`, `joblib`.
  - Load `logs_dataset.csv`.
  - Construct a `Pipeline` with `TfidfVectorizer()` and `LogisticRegression()`.
  - Fit the pipeline on the training data.
  - Save the pipeline as `model.joblib` using `joblib.dump()`.

### 4.3 LangGraph Agent Workflow (`/aiops-engine/agents/`)
- **State (`state.py`):** Define a `TypedDict` named `AgentState` with fields: `log_message: str`, `related_logs: str`, `code_context: str`, `rca_report: str`.
- **Graph (`graph.py`):** Build a LangGraph `StateGraph` with 3 nodes (agents).
- **LLM Configuration:** Use `langchain_groq.ChatGroq` (model="llama3-8b-8192") or `langchain_openai.ChatOpenAI` configured with the Groq base URL.
- **Agent 1: Log Analyst:**
  - **Task:** Look at `state['log_message']`. Use a custom tool to query the in-memory ring buffer for similar logs.
  - **Output:** Update `state['related_logs']`.
- **Agent 2: Code Investigator (MCP):**
  - **Task:** Connect to the local MCP server. Call MCP tools to read `ARCHITECTURE.md` and the specific Python file mentioned in the error log to find the bug.
  - **Output:** Update `state['code_context']`.
- **Agent 3: RCA Synthesizer:**
  - **Task:** Take `state['related_logs']` and `state['code_context']`. Generate a Markdown formatted Root Cause Analysis report.
  - **Output:** Update `state['rca_report']` and print to stdout.

### 4.4 Custom MCP Server (`/aiops-engine/mcp_servers/codebase_mcp.py`)
**Purpose:** Allows the Code Investigator Agent to securely read the `/target-app` directory.
- **Tech Stack:** `mcp` Python SDK (FastMCP).
- **Tool 1: `read_architecture_context()`** -> Reads and returns the contents of `/target-app/ARCHITECTURE.md`.
- **Tool 2: `get_file_structure()`** -> Returns a string list of files in `/target-app`.
- **Tool 3: `read_file(file_path: str)`** -> Reads and returns the contents of a specified file inside `/target-app`.
- **Tool 4: `get_recent_git_changes()`** -> Mocks a git log response (e.g., returns "Modified main.py: added simulate-error endpoint").

## 5. Deployment & DevOps
- **`docker-compose.yml`:** Must define two services: `target-app` (running uvicorn on port 8000) and `aiops-engine` (running uvicorn on port 8001). Both building from their respective Dockerfiles.
- **Environment Variables:** The `aiops-engine` must expect `GROQ_API_KEY` in the environment.

## 6. Code Generation Guidelines for IDE
- Always use Python 3.10+ typing conventions (e.g., `list[str]` instead of `List[str]`).
- Always define Pydantic models for API request/response schemas.
- When generating the MCP server, use the standard `@mcp.tool()` decorator pattern.
- Do NOT generate any test files unless explicitly asked.
- Keep functions modular and small to optimize token usage.
- Ensure all imports are correct and strictly follow the tech stack rules (No UI, No SQL, Scikit-learn only for ML, Groq for LLM).
