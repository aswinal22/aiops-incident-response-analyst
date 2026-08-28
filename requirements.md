# Functional Requirements Document (FRD)

## FR1: Log Generation & Drain (Target App)
- **FR1.1**: The Target App shall be a FastAPI application exposing a `/` endpoint.  
- **FR1.2**: The app shall intentionally simulate errors (e.g., FileNotFound, DB Timeout) randomly or via a specific trigger endpoint.  
- **FR1.3**: The app shall write all logs to stdout using standard Python logging (no local file writes).  
- **FR1.4**: The hosting platform (Render/Vercel) shall be configured with a Log Drain to forward stdout as JSON HTTP POST requests to the AIOps Engine's `/ingest-logs` endpoint.  

## FR2: Log Ingestion & ML Anomaly Detection (AIOps Engine)
- **FR2.1**: The AIOps Engine shall expose a `/ingest-logs` POST endpoint to receive drained logs.  
- **FR2.2**: Incoming logs shall be stored in an in-memory ring buffer (max 1000 logs) using `collections.deque`.  
- **FR2.3**: The engine shall load a pre-trained Traditional ML model (`model.joblib`) on startup.  
- **FR2.4**: Upon receiving a log, the engine shall pass the log text to the ML model to predict a classification ("Normal" vs. "Anomaly").  
- **FR2.5**: If an "Anomaly" is detected, the engine shall trigger the Agentic Investigation Workflow.  

## FR3: Agentic Investigation Workflow (LangGraph)
- **FR3.1**: A LangGraph state machine shall orchestrate three agents: Log Analyst, Code Investigator, RCA Synthesizer.  
- **FR3.2**: **Log Analyst Agent**: Shall use a custom tool to query the in-memory ring buffer for related error logs.  
- **FR3.3**: **Code Investigator Agent**: Shall use a custom MCP Client to connect to a local MCP Server. The MCP server shall expose tools: `read_architecture_context`, `get_file_structure`, `read_file`, and `get_recent_git_changes`.  
- **FR3.4**: **RCA Synthesizer Agent**: Shall take the gathered logs and code context and generate a Markdown-formatted Root Cause Analysis report.  
- **FR3.5**: The final RCA report shall be printed to stdout or returned via an API endpoint (no UI).  

---

# Technical Requirements Document (TRD)

## TR1: Architecture & Repository
- **TR1.1**: The project shall be structured as a Monorepo.  
- **TR1.2**: The Target App shall reside in `/target-app` and include an `ARCHITECTURE.md` file.  
- **TR1.3**: The AIOps Engine shall reside in `/aiops-engine`. No UI folder shall exist.  

## TR2: Traditional ML Pipeline (Detailed Process)
- **TR2.1 (Data Generation)**: A script `/aiops-engine/ml/generate_data.py` shall create a synthetic dataset (`logs_dataset.csv`) containing two columns: `log_text` and `label` (Normal/Anomaly). It will generate thousands of variations of standard HTTP logs and error tracebacks.  
- **TR2.2 (Preprocessing & Training)**: A script `/aiops-engine/ml/train_model.py` shall load the CSV. It will use Scikit-learn's `TfidfVectorizer` to convert text to numerical features and `LogisticRegression` for classification. These will be bundled into a single `sklearn.pipeline.Pipeline`.  
- **TR2.3 (Serialization)**: The trained pipeline shall be saved to `/aiops-engine/ml/model.joblib` using the `joblib` library.  
- **TR2.4 (Inference)**: The FastAPI backend shall load `model.joblib` on startup and use the `.predict()` and `.predict_proba()` methods on incoming log strings.  

## TR3: Backend & GenAI Stack
- **TR3.1**: Backend framework: FastAPI + Uvicorn.  
- **TR3.2**: GenAI Orchestration: LangChain, LangGraph.  
- **TR3.3**: LLM Integration: Groq API (e.g., Llama-3-70B) using the `langchain-groq` package or OpenAI SDK configured for Groq's base URL.  
- **TR3.4**: MCP Integration: A custom MCP server shall be written in Python using the official MCP SDK to read the `/target-app` directory securely.  

## TR4: Deployment & DevOps
- **TR4.1**: The entire monorepo shall be runnable locally via `docker-compose up`.  
- **TR4.2**: The app shall be deployable to free-tier platforms (Render/Hugging Face Spaces) using Docker.  