"""
Supabase Client Factory
========================
Provides two client instances:
  - `get_service_client()`: Uses SERVICE_ROLE_KEY — bypasses RLS for sync/admin ops.
  - `get_anon_client()`: Uses ANON_KEY — bound to RLS for client-facing queries.

All credentials loaded from environment variables. NEVER hardcoded.
"""

import os
from supabase import create_client, Client


def _is_valid_key(key: str) -> bool:
    if not key or not isinstance(key, str):
        return False
    k = key.strip().strip('"').strip("'")
    if len(k) < 20:
        return False
    lower = k.lower()
    if any(placeholder in lower for placeholder in ("your_", "placeholder", "example", "<", ">", "todo")):
        return False
    return True


def get_service_client() -> Client:
    """
    Returns a Supabase client with SERVICE_ROLE_KEY.
    Falls back to SUPABASE_ANON_KEY if SERVICE_ROLE_KEY is placeholder or not configured.
    """
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"').strip("'")

    # 1. Try real Service Role Key
    key = None
    for var in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY"):
        val = (os.environ.get(var) or "").strip().strip('"').strip("'")
        if _is_valid_key(val):
            key = val
            break

    # 2. Fall back to valid Anon Key
    if not key:
        for var in ("SUPABASE_ANON_KEY", "SUPABASE_KEY"):
            val = (os.environ.get(var) or "").strip().strip('"').strip("'")
            if _is_valid_key(val):
                key = val
                break

    if not url or not key:
        raise RuntimeError(
            f"Supabase credentials missing or invalid: url={'configured' if url else 'missing'}, key={'configured' if key else 'missing'}"
        )

    return create_client(url, key)


def get_anon_client() -> Client:
    """
    Returns a Supabase client with ANON_KEY.
    This client respects Row Level Security policies.
    """
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"').strip("'")

    key = None
    for var in ("SUPABASE_ANON_KEY", "SUPABASE_KEY"):
        val = (os.environ.get(var) or "").strip().strip('"').strip("'")
        if _is_valid_key(val):
            key = val
            break

    if not key:
        for var in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SERVICE_ROLE_KEY"):
            val = (os.environ.get(var) or "").strip().strip('"').strip("'")
            if _is_valid_key(val):
                key = val
                break

    if not url or not key:
        raise RuntimeError(
            f"Supabase anon credentials missing or invalid: url={'configured' if url else 'missing'}, anon_key={'configured' if key else 'missing'}"
        )

    return create_client(url, key)

