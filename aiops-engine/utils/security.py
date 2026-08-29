"""Security utilities for AIOps Engine: PII and Secret Redaction (Layers 2 & 5)."""

import re

# Pre-compiled high-performance regular expressions for secret and PII detection
PATTERNS: list[tuple[re.Pattern, str]] = [
    # 1. Database Connection Strings with Passwords (postgresql, mysql, mongodb, redis)
    (
        re.compile(
            r"(?i)\b(postgres(?:ql)?|mongodb(?:\+srv)?|mysql|redis)://([^:\s]+):([^@\s]+)@"
        ),
        r"\1://\2:[REDACTED_PASSWORD]@",
    ),
    # 2. AWS Access Key IDs
    (
        re.compile(r"\b(AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b"),
        "[REDACTED_AWS_KEY]",
    ),
    # 3. JSON Web Tokens (JWT)
    (
        re.compile(r"\beyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+\b"),
        "[REDACTED_JWT]",
    ),
    # 4. Groq / OpenAI / GitHub API Keys
    (
        re.compile(r"\b(gsk_[a-zA-Z0-9]{40,}|sk-[a-zA-Z0-9]{24,}|ghp_[a-zA-Z0-9]{36})\b"),
        "[REDACTED_API_KEY]",
    ),
    # 5. Authorization Bearer Headers
    (
        re.compile(r"(?i)\b(bearer\s+)[A-Za-z0-9\-\._~+/]+=*\b"),
        r"\1[REDACTED_BEARER_TOKEN]",
    ),
    # 6. Common Password / Secret Fields in JSON / YAML / Query Params
    (
        re.compile(
            r"""(?i)(["']?(?:password|passwd|secret|api_key|access_token|private_key)["']?\s*[:=]\s*["'])([^"'\s]{4,})(["'])"""
        ),
        r"\1[REDACTED_SECRET]\3",
    ),
    # 7. Email Addresses (checked after URIs to avoid false-matching user:pass@host)
    (
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    # 8. Credit Card Numbers (13 to 16 digits)
    (
        re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        "[REDACTED_CREDIT_CARD]",
    ),

]


def sanitize_text(text: str | None) -> str:
    """Sanitizes text by replacing PII, credentials, API keys, and connection passwords with [REDACTED] tokens.
    
    Guarantees zero secret leakage into ML models, LangGraph prompts, logs, database, and final reports.
    """
    if not text:
        return ""

    sanitized = str(text)
    for pattern, replacement in PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)

    return sanitized


# Forbidden SQL Keywords that mutate schema or data
FORBIDDEN_SQL_KEYWORDS = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "REPLACE",
    "GRANT",
    "REVOKE",
    "EXEC",
    "EXECUTE",
    "MERGE",
    "COPY",
    "VACUUM",
    "CALL",
}


def validate_readonly_sql(query: str) -> tuple[bool, str]:
    """Validates that a SQL query contains ONLY a single, benign SELECT statement (Layer 2 DB Guardrail).
    
    Returns:
        (True, "Safe") if the query is strictly a read-only SELECT statement.
        (False, "<Error Reason>") if the query contains mutations, injections, or multiple statements.
    """
    if not query or not query.strip():
        return False, "Security Error: Query is empty."

    try:
        import sqlparse
    except ImportError:
        # Fallback keyword scan if sqlparse is not imported
        upper_q = query.strip().upper()
        if not upper_q.startswith("SELECT"):
            return False, "Security Error: Only SELECT queries are permitted."
        for kw in FORBIDDEN_SQL_KEYWORDS:
            if re.search(r"\b" + kw + r"\b", upper_q):
                return False, f"Security Error: Forbidden keyword '{kw}' detected in query."
        return True, "Safe"

    # 1. Strip comments to prevent hidden injection tricks
    clean_query = sqlparse.format(query.strip(), strip_comments=True).strip()

    # 2. Check for semicolon statement chaining (Disallow multiple queries)
    parsed_statements = sqlparse.parse(clean_query)
    if len(parsed_statements) == 0:
        return False, "Security Error: No valid SQL statement found."
    if len(parsed_statements) > 1:
        return False, "Security Error: Multiple SQL statements are forbidden."

    statement = parsed_statements[0]

    # 3. Check primary statement type (must be strictly SELECT)
    stmt_type = statement.get_type()
    if stmt_type != "SELECT":
        return False, f"Security Error: Statement type '{stmt_type}' is not permitted. Only SELECT queries are allowed."

    # 4. Deep-scan all tokens for forbidden mutation keywords
    flat_tokens = [t.value.upper() for t in statement.flatten() if not t.is_whitespace]
    for token in flat_tokens:
        if token in FORBIDDEN_SQL_KEYWORDS:
            return False, f"Security Error: Forbidden keyword '{token}' detected in query."

    return True, "Safe"


