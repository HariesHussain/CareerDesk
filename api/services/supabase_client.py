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


def get_service_client() -> Client:
    """
    Returns a Supabase client with SERVICE_ROLE_KEY.
    Falls back to SUPABASE_ANON_KEY if SERVICE_ROLE_KEY is not yet configured.
    """
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"').strip("'")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    ).strip().strip('"').strip("'")

    if not url or not key:
        raise RuntimeError(
            f"Supabase credentials missing: url={'configured' if url else 'missing'}, key={'configured' if key else 'missing'}"
        )

    return create_client(url, key)


def get_anon_client() -> Client:
    """
    Returns a Supabase client with ANON_KEY.
    This client respects Row Level Security policies.
    """
    url = (os.environ.get("SUPABASE_URL") or "").strip().strip('"').strip("'")
    key = (
        os.environ.get("SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    ).strip().strip('"').strip("'")

    if not url or not key:
        raise RuntimeError(
            f"Supabase anon credentials missing: url={'configured' if url else 'missing'}, anon_key={'configured' if key else 'missing'}"
        )

    return create_client(url, key)
