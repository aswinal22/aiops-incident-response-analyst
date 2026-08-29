"""Cryptographic utilities for securing GitHub Personal Access Tokens (PATs) at rest using AES-128-CBC."""

import base64
import hashlib
import os
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

# Deterministic fallback secret salt if MASTER_ENCRYPTION_KEY is not provided
_DEFAULT_SALT = b"aiops-incident-response-encryption-salt-2026"


def _get_fernet_cipher() -> Fernet:
    """Returns Fernet cipher instance using MASTER_ENCRYPTION_KEY or derived key."""
    env_key = os.getenv("MASTER_ENCRYPTION_KEY")
    if env_key:
        try:
            return Fernet(env_key.encode("utf-8"))
        except Exception:
            pass

    # Derive a valid 32-byte url-safe base64 key from system salt
    derived_32bytes = hashlib.sha256(_DEFAULT_SALT).digest()
    valid_key = base64.urlsafe_b64encode(derived_32bytes)
    return Fernet(valid_key)


def encrypt_token(plain_token: str | None) -> str | None:
    """Encrypts a plaintext GitHub Personal Access Token or secret string before storing at rest."""
    if not plain_token:
        return None

    try:
        cipher = _get_fernet_cipher()
        encrypted_bytes = cipher.encrypt(plain_token.encode("utf-8"))
        return encrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"[Crypto] Error encrypting token: {e}")
        return None


def decrypt_token(encrypted_token: str | None) -> str | None:
    """Decrypts an encrypted GitHub Personal Access Token in-memory for MCP tool calls."""
    if not encrypted_token:
        return None

    try:
        cipher = _get_fernet_cipher()
        decrypted_bytes = cipher.decrypt(encrypted_token.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"[Crypto] Error decrypting token: {e}")
        return None

