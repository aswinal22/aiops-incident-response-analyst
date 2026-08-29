"""Service Registry & Metadata Store supporting Supabase PostgreSQL and SQLite fallback with in-memory caching."""

import os
import sqlite3
import uuid
from pathlib import Path
from typing import Any
from sqlalchemy import text
from utils.crypto import decrypt_token, encrypt_token
from db import get_db_engine

# Locate SQLite fallback database
SQLITE_DB_PATH = Path(__file__).resolve().parent / "metadata.db"

# Fast in-memory cache for sub-millisecond log ingestion lookups
_SERVICE_CACHE: dict[str, dict[str, Any]] = {}


def _get_sqlite_connection() -> sqlite3.Connection:
    """Returns SQLite connection with row factory enabled for local fallback."""
    conn = sqlite3.connect(str(SQLITE_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_registry_db() -> None:
    """Ensures projects and services schema exist in Supabase PostgreSQL or SQLite fallback."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                # 1. Projects Table
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS projects (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            name TEXT NOT NULL,
                            description TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                )

                # 2. Services Table
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS services (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                            name TEXT NOT NULL UNIQUE,
                            repo_url TEXT,
                            repo_owner TEXT,
                            repo_name TEXT,
                            github_pat_encrypted TEXT,
                            workspace_path TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                )

                # 3. Seed Default Monorepo Project & target-app
                conn.execute(
                    text(
                        """
                        INSERT INTO projects (id, name, description)
                        VALUES ('00000000-0000-0000-0000-000000000001', 'Default Monorepo Project', 'Monorepo workspace containing target-app')
                        ON CONFLICT (id) DO NOTHING;
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO services (id, project_id, name, repo_url, repo_owner, repo_name, github_pat_encrypted, workspace_path)
                        VALUES (
                            '00000000-0000-0000-0000-000000000002',
                            '00000000-0000-0000-0000-000000000001',
                            'target-app',
                            '',
                            '',
                            '',
                            NULL,
                            'target-app'
                        )
                        ON CONFLICT (name) DO NOTHING;
                        """
                    )
                )
            print("[Service Registry] Supabase PostgreSQL mapping tables verified & active.")
            return
        except Exception as e:
            print(f"[Service Registry] Supabase initialization fallback to SQLite: {e}")

    # Fallback to local SQLite
    with _get_sqlite_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS services (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                name TEXT NOT NULL UNIQUE,
                repo_url TEXT,
                repo_owner TEXT,
                repo_name TEXT,
                github_pat_encrypted TEXT,
                workspace_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        cursor.execute("SELECT id FROM projects WHERE id = '00000000-0000-0000-0000-000000000001'")
        if not cursor.fetchone():
            cursor.execute(
                """
                INSERT INTO projects (id, name, description)
                VALUES ('00000000-0000-0000-0000-000000000001', 'Default Monorepo Project', 'Monorepo workspace containing target-app');
                """
            )
        cursor.execute("SELECT id FROM services WHERE name = 'target-app'")
        if not cursor.fetchone():
            cursor.execute(
                """
                INSERT INTO services (id, project_id, name, repo_url, repo_owner, repo_name, github_pat_encrypted, workspace_path)
                VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'target-app', '', '', '', NULL, 'target-app');
                """
            )
        conn.commit()


def register_project(name: str, description: str = "") -> str:
    """Registers a new project in Supabase PostgreSQL (or SQLite fallback) and returns its UUID."""
    project_id = str(uuid.uuid4())
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        INSERT INTO projects (id, name, description)
                        VALUES (CAST(:id AS UUID), :name, :description);
                        """
                    ),
                    {"id": project_id, "name": name, "description": description},
                )
            return project_id
        except Exception as e:
            print(f"[Service Registry] Supabase register_project error: {e}")

    with _get_sqlite_connection() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, description) VALUES (?, ?, ?)",
            (project_id, name, description),
        )
        conn.commit()
    return project_id


def register_service(
    project_id: str,
    name: str,
    repo_url: str = "",
    repo_owner: str = "",
    repo_name: str = "",
    github_pat: str | None = None,
    workspace_path: str = "",
) -> str:
    """Registers a microservice with Fernet-encrypted GitHub PAT in Supabase PostgreSQL (or SQLite)."""
    service_id = str(uuid.uuid4())
    encrypted_pat = encrypt_token(github_pat) if github_pat else None

    # Derive repo_owner and repo_name from repo_url if needed
    if repo_url and (not repo_owner or not repo_name):
        parts = repo_url.rstrip("/").split("/")
        if len(parts) >= 2:
            repo_owner = repo_owner or parts[-2]
            repo_name = repo_name or parts[-1].replace(".git", "")

    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                result = conn.execute(
                    text(
                        """
                        INSERT INTO services (id, project_id, name, repo_url, repo_owner, repo_name, github_pat_encrypted, workspace_path)
                        VALUES (CAST(:id AS UUID), CAST(:project_id AS UUID), :name, :repo_url, :repo_owner, :repo_name, :github_pat_encrypted, :workspace_path)
                        ON CONFLICT (name) DO UPDATE SET
                            project_id = EXCLUDED.project_id,
                            repo_url = EXCLUDED.repo_url,
                            repo_owner = EXCLUDED.repo_owner,
                            repo_name = EXCLUDED.repo_name,
                            github_pat_encrypted = EXCLUDED.github_pat_encrypted,
                            workspace_path = EXCLUDED.workspace_path
                        RETURNING id;
                        """
                    ),
                    {
                        "id": service_id,
                        "project_id": project_id,
                        "name": name,
                        "repo_url": repo_url,
                        "repo_owner": repo_owner,
                        "repo_name": repo_name,
                        "github_pat_encrypted": encrypted_pat,
                        "workspace_path": workspace_path or name,
                    },
                )
                row = result.fetchone()
                if row:
                    service_id = str(row[0])

            # Invalidate cache so fresh service is queried
            _SERVICE_CACHE.pop(service_id, None)
            _SERVICE_CACHE.pop(name, None)
            return service_id
        except Exception as e:
            print(f"[Service Registry] Supabase register_service error: {e}")

    with _get_sqlite_connection() as conn:
        conn.execute(
            """
            INSERT INTO services (id, project_id, name, repo_url, repo_owner, repo_name, github_pat_encrypted, workspace_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (name) DO UPDATE SET
                project_id = excluded.project_id,
                repo_url = excluded.repo_url,
                repo_owner = excluded.repo_owner,
                repo_name = excluded.repo_name,
                github_pat_encrypted = excluded.github_pat_encrypted,
                workspace_path = excluded.workspace_path;
            """,
            (
                service_id,
                project_id,
                name,
                repo_url,
                repo_owner,
                repo_name,
                encrypted_pat,
                workspace_path or name,
            ),
        )
        conn.commit()


    _SERVICE_CACHE.pop(service_id, None)
    _SERVICE_CACHE.pop(name, None)
    return service_id


def get_service(service_id_or_name: str) -> dict[str, Any] | None:
    """Resolves a service by UUID or name from Supabase (or SQLite) with in-memory caching."""
    if not service_id_or_name:
        return None

    # 1. Check in-memory cache
    if service_id_or_name in _SERVICE_CACHE:
        return _SERVICE_CACHE[service_id_or_name]

    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.connect() as conn:
                # Test if service_id_or_name is a valid UUID
                is_uuid = False
                try:
                    uuid.UUID(service_id_or_name)
                    is_uuid = True
                except ValueError:
                    is_uuid = False

                if is_uuid:
                    query = text(
                        """
                        SELECT s.*, p.name as project_name
                        FROM services s
                        JOIN projects p ON s.project_id = p.id
                        WHERE s.id = CAST(:identifier AS UUID) OR s.name = :identifier
                        LIMIT 1;
                        """
                    )
                else:
                    query = text(
                        """
                        SELECT s.*, p.name as project_name
                        FROM services s
                        JOIN projects p ON s.project_id = p.id
                        WHERE s.name = :identifier
                        LIMIT 1;
                        """
                    )

                result = conn.execute(query, {"identifier": service_id_or_name})
                row = result.fetchone()
                if row:
                    data = dict(row._mapping)
                    data["id"] = str(data.get("id"))
                    data["project_id"] = str(data.get("project_id"))
                    enc_pat = data.get("github_pat_encrypted")
                    data["github_pat"] = decrypt_token(enc_pat) if enc_pat else None

                    # Cache under both ID and name
                    _SERVICE_CACHE[data["id"]] = data
                    _SERVICE_CACHE[data["name"]] = data
                    return data
        except Exception as e:
            print(f"[Service Registry] Supabase get_service query error: {e}")

    # Fallback to SQLite
    with _get_sqlite_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.*, p.name as project_name
            FROM services s
            JOIN projects p ON s.project_id = p.id
            WHERE s.id = ? OR s.name = ?
            LIMIT 1;
            """,
            (service_id_or_name, service_id_or_name),
        )
        row = cursor.fetchone()
        if row:
            data = dict(row)
            enc_pat = data.get("github_pat_encrypted")
            data["github_pat"] = decrypt_token(enc_pat) if enc_pat else None
            _SERVICE_CACHE[data["id"]] = data
            _SERVICE_CACHE[data["name"]] = data
            return data

    return None


def list_services(project_id: str | None = None) -> list[dict[str, Any]]:
    """Lists registered services with PATs masked."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.connect() as conn:
                if project_id:
                    query = text(
                        """
                        SELECT id, project_id, name, repo_url, repo_owner, repo_name, workspace_path, created_at
                        FROM services
                        WHERE project_id = CAST(:project_id AS UUID)
                        ORDER BY created_at ASC;
                        """
                    )
                    result = conn.execute(query, {"project_id": project_id})
                else:
                    query = text(
                        """
                        SELECT id, project_id, name, repo_url, repo_owner, repo_name, workspace_path, created_at
                        FROM services
                        ORDER BY created_at ASC;
                        """
                    )
                    result = conn.execute(query)

                rows = []
                for row in result.fetchall():
                    item = dict(row._mapping)
                    item["id"] = str(item.get("id"))
                    item["project_id"] = str(item.get("project_id"))
                    rows.append(item)
                return rows
        except Exception as e:
            print(f"[Service Registry] Supabase list_services error: {e}")

    with _get_sqlite_connection() as conn:
        cursor = conn.cursor()
        if project_id:
            cursor.execute(
                "SELECT id, project_id, name, repo_url, repo_owner, repo_name, workspace_path, created_at FROM services WHERE project_id = ?",
                (project_id,),
            )
        else:
            cursor.execute(
                "SELECT id, project_id, name, repo_url, repo_owner, repo_name, workspace_path, created_at FROM services"
            )
        return [dict(row) for row in cursor.fetchall()]


def list_projects() -> list[dict[str, Any]]:
    """Lists all registered projects from Supabase or SQLite."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT id, name, description, created_at FROM projects ORDER BY created_at ASC;"))
                rows = []
                for row in result.fetchall():
                    item = dict(row._mapping)
                    item["id"] = str(item.get("id"))
                    rows.append(item)
                return rows
        except Exception as e:
            print(f"[Service Registry] Supabase list_projects error: {e}")

    with _get_sqlite_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, description, created_at FROM projects")
        return [dict(row) for row in cursor.fetchall()]


# Auto-initialize schema on startup
try:
    init_registry_db()
except Exception as _e:
    pass

