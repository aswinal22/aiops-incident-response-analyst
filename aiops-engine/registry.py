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
    """Returns SQLite connection with row factory enabled for local fallback and ensures tables exist."""
    conn = sqlite3.connect(str(SQLITE_DB_PATH))
    conn.row_factory = sqlite3.Row
    # Ensure fallback SQLite tables exist
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    # Ensure user_id column exists if table was created previously without it
    try:
        col_cursor = conn.execute("PRAGMA table_info(projects);")
        columns = [row["name"] for row in col_cursor.fetchall()]
        if "user_id" not in columns:
            conn.execute("ALTER TABLE projects ADD COLUMN user_id TEXT;")
    except Exception as e:
        print(f"[Service Registry] SQLite migration notice: {e}")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            project_id TEXT,
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
    conn.commit()
    return conn


def init_registry_db() -> None:
    """Ensures projects and services schema exist in Supabase PostgreSQL and SQLite fallback."""
    # 1. Ensure local SQLite tables exist
    try:
        with _get_sqlite_connection() as conn:
            pass
    except Exception as e:
        print(f"[Service Registry] SQLite init notice: {e}")

    # 2. Ensure Supabase PostgreSQL tables exist
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
                            user_id UUID,
                            name TEXT NOT NULL,
                            description TEXT,
                            created_at TIMESTAMPTZ DEFAULT NOW()
                        );
                        """
                    )
                )

                # Migration for existing projects table without user_id
                try:
                    conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID;"))
                except Exception:
                    pass

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

            print("[Service Registry] Supabase PostgreSQL mapping tables verified & active.")
        except Exception as e:
            print(f"[Service Registry] Supabase initialization notice: {e}")


def register_project(name: str, description: str = "", user_id: str | None = None) -> str:
    """Registers a new project in Supabase PostgreSQL (or SQLite fallback) scoped to user_id and returns its UUID."""
    project_id = str(uuid.uuid4())
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                if user_id:
                    conn.execute(
                        text(
                            """
                            INSERT INTO projects (id, user_id, name, description)
                            VALUES (CAST(:id AS UUID), CAST(:user_id AS UUID), :name, :description);
                            """
                        ),
                        {"id": project_id, "user_id": user_id, "name": name, "description": description},
                    )
                else:
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
            "INSERT INTO projects (id, user_id, name, description) VALUES (?, ?, ?, ?)",
            (project_id, user_id, name, description),
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
                        LEFT JOIN projects p ON s.project_id = p.id
                        WHERE s.id = CAST(:identifier AS UUID) OR s.name = :identifier
                        LIMIT 1;
                        """
                    )
                else:
                    query = text(
                        """
                        SELECT s.*, p.name as project_name
                        FROM services s
                        LEFT JOIN projects p ON s.project_id = p.id
                        WHERE s.name = :identifier
                        LIMIT 1;
                        """
                    )

                result = conn.execute(query, {"identifier": service_id_or_name})
                row = result.fetchone()
                if row:
                    data = dict(row._mapping)
                    data["id"] = str(data.get("id"))
                    data["project_id"] = str(data.get("project_id")) if data.get("project_id") else None
                    enc_pat = data.get("github_pat_encrypted")
                    data["github_pat"] = decrypt_token(enc_pat) if enc_pat else None

                    # Cache under both ID and name
                    _SERVICE_CACHE[data["id"]] = data
                    _SERVICE_CACHE[data["name"]] = data
                    return data
                else:
                    # Service definitely not in Supabase
                    return None
        except Exception as e:
            print(f"[Service Registry] Supabase get_service query error: {e}")

    # Fallback to SQLite
    try:
        with _get_sqlite_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT s.*, p.name as project_name
                FROM services s
                LEFT JOIN projects p ON s.project_id = p.id
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
    except Exception as e:
        print(f"[Service Registry] SQLite get_service error: {e}")

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
                    item["project_id"] = str(item.get("project_id")) if item.get("project_id") else None
                    rows.append(item)
                return rows
        except Exception as e:
            print(f"[Service Registry] Supabase list_services error: {e}")

    try:
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
    except Exception as e:
        print(f"[Service Registry] SQLite list_services error: {e}")
        return []


def list_projects(user_id: str | None = None) -> list[dict[str, Any]]:
    """Lists registered projects from Supabase or SQLite, optionally filtered by user_id."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.connect() as conn:
                if user_id:
                    query = text(
                        """
                        SELECT id, user_id, name, description, created_at
                        FROM projects
                        WHERE user_id = CAST(:user_id AS UUID) OR user_id::text = :user_id_text
                        ORDER BY created_at ASC;
                        """
                    )
                    result = conn.execute(query, {"user_id": user_id, "user_id_text": str(user_id)})
                else:
                    query = text(
                        """
                        SELECT id, user_id, name, description, created_at
                        FROM projects
                        ORDER BY created_at ASC;
                        """
                    )
                    result = conn.execute(query)

                rows = []
                for row in result.fetchall():
                    item = dict(row._mapping)
                    item["id"] = str(item.get("id"))
                    if item.get("user_id"):
                        item["user_id"] = str(item.get("user_id"))
                    rows.append(item)
                return rows
        except Exception as e:
            print(f"[Service Registry] Supabase list_projects error: {e}")

    try:
        with _get_sqlite_connection() as conn:
            cursor = conn.cursor()
            if user_id:
                cursor.execute(
                    "SELECT id, user_id, name, description, created_at FROM projects WHERE user_id = ? ORDER BY created_at ASC",
                    (str(user_id),),
                )
            else:
                cursor.execute("SELECT id, user_id, name, description, created_at FROM projects ORDER BY created_at ASC")
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        print(f"[Service Registry] SQLite list_projects error: {e}")
        return []


def delete_project(project_id: str) -> bool:
    """Deletes a project and cascades to all its scoped services."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM projects WHERE id = CAST(:id AS UUID) OR id::text = :id_text;"),
                    {"id": project_id, "id_text": project_id},
                )
            _SERVICE_CACHE.clear()
            return True
        except Exception as e:
            print(f"[Service Registry] Supabase delete_project error: {e}")

    try:
        with _get_sqlite_connection() as conn:
            conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            conn.execute("DELETE FROM services WHERE project_id = ?", (project_id,))
            conn.commit()
    except Exception as e:
        print(f"[Service Registry] SQLite delete_project error: {e}")
    _SERVICE_CACHE.clear()
    return True


def delete_service(service_id: str) -> bool:
    """Deletes a microservice by ID or name."""
    engine = get_db_engine()
    if engine is not None:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("DELETE FROM services WHERE id = CAST(:id AS UUID) OR id::text = :id_text OR name = :name;"),
                    {"id": service_id, "id_text": service_id, "name": service_id},
                )
            _SERVICE_CACHE.clear()
            return True
        except Exception as e:
            print(f"[Service Registry] Supabase delete_service error: {e}")

    try:
        with _get_sqlite_connection() as conn:
            conn.execute("DELETE FROM services WHERE id = ? OR name = ?", (service_id, service_id))
            conn.commit()
    except Exception as e:
        print(f"[Service Registry] SQLite delete_service error: {e}")
    _SERVICE_CACHE.clear()
    return True


# Auto-initialize schema on startup
try:
    init_registry_db()
except Exception as _e:
    pass

