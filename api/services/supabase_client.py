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
    This bypasses Row Level Security — use ONLY for:
      - Background sync (Brabble ingestion)
      - Admin operations
      - Cron jobs
    NEVER expose this client or its key to the browser.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables."
        )

    return create_client(url, key)


def get_anon_client() -> Client:
    """
    Returns a Supabase client with ANON_KEY.
    This client respects Row Level Security policies.
    Safe for operations where the user's auth context matters.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables."
        )

    return create_client(url, key)
