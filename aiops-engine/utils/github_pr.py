"""Autonomous GitHub Remediation Pull Request Tool.

Leverages decrypted GitHub PATs and GitHub REST API to:
1. Create a dedicated fix branch (fix/aiops-incident-<id>).
2. Generate targeted code patch for the faulty file using Groq LLM / remediation rules.
3. Commit the patch to the branch.
4. Open a GitHub Pull Request with the 5-section RCA report embedded in the PR description.
"""

import base64
import os
from typing import Any
import httpx
from dotenv import load_dotenv

load_dotenv()


def _generate_remediation_patch(incident: dict[str, Any], current_content: str | None = None) -> str:
    """Generates remediation code patch using Groq LLM or structured rules."""
    exception_name = incident.get("detected_exception", "RuntimeError")
    faulty_file = incident.get("faulty_file", "main.py")
    immediate_fixes = incident.get("immediate_fixes", [])

    fix_summary = "\n".join([f"- {f.get('task', '')}" for f in immediate_fixes if isinstance(f, dict)])

    # If Groq API key is available, synthesize tailored code patch
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            prompt = (
                f"You are an expert SRE and Senior Software Engineer repairing a production outage.\n\n"
                f"Incident Exception: {exception_name}\n"
                f"Faulty File: {faulty_file}\n"
                f"Suggested Immediate Fixes:\n{fix_summary}\n\n"
                f"Existing File Content (if any):\n```\n{current_content or '# No existing content provided'}\n```\n\n"
                f"Provide ONLY the clean, complete, production-ready Python/code replacement for this file. "
                f"Include robust error handling, connection pooling, and circuit breaker safeguards. "
                f"Do not include conversational filler; output only the updated code inside a single ``` code block."
            )
            completion = client.chat.completions.create(
                model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
                messages=[
                    {"role": "system", "content": "You are an automated code remediation agent. Output valid code only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
            raw_output = completion.choices[0].message.content or ""
            if "```" in raw_output:
                lines = raw_output.split("```")
                # Extract code between first ```...```
                code_block = lines[1] if len(lines) > 1 else raw_output
                if code_block.startswith(("python", "typescript", "javascript", "json", "\n")):
                    code_block = "\n".join(code_block.split("\n")[1:])
                return code_block.strip()
            return raw_output.strip()
        except Exception as e:
            print(f"[AIOps PR Generator] Groq code patch synthesis notice: {e}")

    # Deterministic fallback template based on exception type
    if "db" in exception_name.lower() or "timeout" in exception_name.lower():
        return (
            "# AIOps Automated Remediation Patch: Database Connection Pool & Resilience\n"
            "# Configured connection pool sizing, failover fallback, and client timeout limits.\n\n"
            "import os\nimport asyncpg\n\n"
            "DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/postgres')\n\n"
            "async def get_resilient_db_pool():\n"
            "    return await asyncpg.create_pool(\n"
            "        dsn=DATABASE_URL,\n"
            "        min_size=5,\n"
            "        max_size=30,          # Increased pool size to prevent starvation\n"
            "        timeout=10,           # 10s connection acquire timeout\n"
            "        command_timeout=15,   # 15s max query execution\n"
            "    )\n"
        )
    elif "file" in exception_name.lower():
        return (
            "# AIOps Automated Remediation Patch: Safe Configuration Loading with Default Fallbacks\n\n"
            "import os\nimport yaml\n\n"
            "def load_application_config(config_path: str = '/app/config/settings.yaml') -> dict:\n"
            "    if not os.path.exists(config_path):\n"
            "        # Fallback to default environment configuration\n"
            "        return {'environment': os.getenv('ENV', 'production'), 'pool_size': 20, 'debug': False}\n"
            "    with open(config_path, 'r') as f:\n"
            "        return yaml.safe_load(f) or {}\n"
        )
    else:
        return (
            f"# AIOps Automated Remediation Patch for {exception_name}\n"
            f"# Suggested fixes: {fix_summary or 'Added defensive boundary checks and error isolation'}\n\n"
            "def safe_execute(action_fn, *args, **kwargs):\n"
            "    try:\n"
            "        return action_fn(*args, **kwargs)\n"
            "    except Exception as exc:\n"
            "        # Guardrail error handling\n"
            "        return {'status': 'error', 'detail': str(exc)}\n"
        )


async def create_remediation_pull_request(
    service_info: dict[str, Any],
    incident: dict[str, Any],
) -> dict[str, Any]:
    """Creates a fix branch, commits the remediation patch, and opens a GitHub Pull Request."""
    incident_id = str(incident.get("id", "00000000"))
    short_id = incident_id[:8]
    exception_name = incident.get("detected_exception", "Runtime Anomaly")
    faulty_file = incident.get("faulty_file", "main.py") or "main.py"
    branch_name = f"fix/aiops-incident-{short_id}"

    # Extract repository metadata
    repo_owner = service_info.get("repo_owner") or "aswinal22"
    repo_name = service_info.get("repo_name") or "aiops-incident-response-analyst"
    if "/" in service_info.get("name", "") and not service_info.get("repo_owner"):
        parts = service_info["name"].split("/")
        repo_owner, repo_name = parts[0], parts[1]

    # Resolve GitHub PAT
    token = (
        service_info.get("github_pat")
        or os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")
        or os.getenv("GITHUB_TOKEN")
    )

    compare_url = f"https://github.com/{repo_owner}/{repo_name}/compare/main...{branch_name}?expand=1"

    # If no token is configured, return clean simulated/direct compare payload
    if not token or not token.strip():
        patch_code = _generate_remediation_patch(incident, None)
        return {
            "status": "direct_link",
            "pr_url": compare_url,
            "branch": branch_name,
            "patch_preview": patch_code,
            "message": "GitHub PAT not configured for direct API commits. Provided direct 1-click Compare PR URL.",
        }

    clean_token = token.strip()
    headers = {
        "Authorization": f"Bearer {clean_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "AIOps-Incident-Studio/1.0",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            # 1. Fetch Repository Info & Default Branch
            repo_res = await client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}", headers=headers)
            if repo_res.status_code != 200:
                patch_code = _generate_remediation_patch(incident, None)
                return {
                    "status": "direct_link",
                    "pr_url": compare_url,
                    "branch": branch_name,
                    "patch_preview": patch_code,
                    "message": f"GitHub API check ({repo_res.status_code}). Provided direct 1-click PR link.",
                }

            repo_data = repo_res.json()
            default_branch = repo_data.get("default_branch", "main")

            # 2. Get latest commit SHA on default branch
            ref_res = await client.get(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/git/ref/heads/{default_branch}",
                headers=headers,
            )
            if ref_res.status_code != 200:
                return {
                    "status": "direct_link",
                    "pr_url": compare_url,
                    "branch": branch_name,
                    "message": "Unable to fetch default branch SHA. Provided direct Compare PR URL.",
                }
            latest_sha = ref_res.json()["object"]["sha"]

            # 3. Create or Reset Fix Branch
            branch_ref_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/git/refs"
            create_ref_res = await client.post(
                branch_ref_url,
                headers=headers,
                json={"ref": f"refs/heads/{branch_name}", "sha": latest_sha},
            )
            # If branch already exists (422), continue on existing branch

            # 4. Fetch existing faulty file content (if present) to compute patch
            file_url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{faulty_file}?ref={branch_name}"
            file_res = await client.get(file_url, headers=headers)
            current_content = None
            file_sha = None
            if file_res.status_code == 200:
                f_data = file_res.json()
                file_sha = f_data.get("sha")
                raw_b64 = f_data.get("content", "")
                try:
                    current_content = base64.b64decode(raw_b64).decode("utf-8")
                except Exception:
                    current_content = None

            # 5. Generate Target Remediation Code
            patch_content = _generate_remediation_patch(incident, current_content)

            # 6. Commit Patched File to Fix Branch
            commit_payload: dict[str, Any] = {
                "message": f"fix(aiops): auto-remediation for incident {short_id} ({exception_name})",
                "content": base64.b64encode(patch_content.encode("utf-8")).decode("utf-8"),
                "branch": branch_name,
            }
            if file_sha:
                commit_payload["sha"] = file_sha

            put_file_res = await client.put(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{faulty_file}",
                headers=headers,
                json=commit_payload,
            )

            # 7. Open Pull Request on GitHub
            pr_body = (
                f"## 🤖 Autonomous AIOps Remediation PR\n\n"
                f"**Incident ID**: `{incident_id}`\n"
                f"**Detected Exception**: `{exception_name}`\n"
                f"**Faulty File**: `{faulty_file}`\n\n"
                f"### Root Cause Summary\n"
                f"{incident.get('incident_summary') or 'An automated runtime anomaly was diagnosed by the LangGraph multi-agent system.'}\n\n"
                f"### Recommended Remediation Fixes\n"
            )
            for fix in incident.get("immediate_fixes", []):
                if isinstance(fix, dict):
                    pr_body += f"- [ ] {fix.get('task')}\n"

            pr_body += (
                f"\n---\n*Generated autonomously by [AIOps Incident Studio](https://aiops-dashboard-five.vercel.app/incidents/{incident_id}).*"
            )

            pr_create_res = await client.post(
                f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls",
                headers=headers,
                json={
                    "title": f"fix(aiops): automated remediation for {exception_name} (Incident #{short_id})",
                    "head": branch_name,
                    "base": default_branch,
                    "body": pr_body,
                },
            )

            if pr_create_res.status_code in (200, 201):
                pr_data = pr_create_res.json()
                return {
                    "status": "created",
                    "pr_url": pr_data.get("html_url"),
                    "pr_number": pr_data.get("number"),
                    "branch": branch_name,
                    "message": f"Pull Request #{pr_data.get('number')} opened successfully on GitHub.",
                }
            elif pr_create_res.status_code == 422 and "already exists" in pr_create_res.text:
                # PR already exists for this branch, fetch existing PR
                existing_prs_res = await client.get(
                    f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls?head={repo_owner}:{branch_name}",
                    headers=headers,
                )
                if existing_prs_res.status_code == 200 and existing_prs_res.json():
                    existing_pr = existing_prs_res.json()[0]
                    return {
                        "status": "created",
                        "pr_url": existing_pr.get("html_url"),
                        "pr_number": existing_pr.get("number"),
                        "branch": branch_name,
                        "message": f"Pull Request #{existing_pr.get('number')} already open on GitHub.",
                    }

            # If PR creation returned non-200, fallback to direct compare URL
            return {
                "status": "direct_link",
                "pr_url": compare_url,
                "branch": branch_name,
                "message": "Branch created. Click to review and finalize the Pull Request on GitHub.",
            }

        except Exception as e:
            print(f"[AIOps PR Generator Error] {e}")
            return {
                "status": "direct_link",
                "pr_url": compare_url,
                "branch": branch_name,
                "message": f"Generated direct 1-click Compare PR URL: {e}",
            }
