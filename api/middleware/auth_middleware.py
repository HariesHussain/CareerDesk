"""
Authentication Middleware
==========================
Provides decorators for protecting API endpoints using Supabase Auth:
  - `login_required`: Validates Supabase JWT access token from Authorization header,
                      fetches/provisions student profile, attaches to flask.g
  - `admin_required`: Extends login_required with role == "admin" check

Supports Google Single Sign-On (SSO) via Supabase Auth.
Stateless Bearer token validation (no session cookies required).
"""

import os
import functools
import logging

from flask import request, jsonify, g

from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


def login_required(f):
    """
    Decorator: requires a valid Supabase JWT Bearer token.
    Header format: `Authorization: Bearer <access_token>`
    
    Attaches to flask.g:
      - `g.user_id`: UUID string of the authenticated user
      - `g.current_user`: Dict with id, email, full_name, avatar_url, college_name, role
    
    Returns 401 if missing, invalid, or expired.
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({
                "error": "Authentication required. Provide Authorization: Bearer <token>"
            }), 401

        token = auth_header[7:].strip()
        if not token:
            return jsonify({"error": "Missing access token."}), 401

        try:
            supabase = get_service_client()

            # Verify token and retrieve user details from Supabase Auth
            user_response = supabase.auth.get_user(token)
            if not user_response or not getattr(user_response, "user", None):
                return jsonify({"error": "Invalid or expired authorization token."}), 401

            user = user_response.user
            user_id = user.id

            # Fetch profile from opp_profiles
            result = (
                supabase.table("opp_profiles")
                .select("id, email, full_name, avatar_url, college_name, role")
                .eq("id", user_id)
                .execute()
            )

            if result.data:
                profile = result.data[0]
            else:
                # Auto-provision profile fallback if trigger was delayed
                user_meta = getattr(user, "user_metadata", {}) or {}
                full_name = user_meta.get("full_name") or user_meta.get("name") or ""
                avatar_url = user_meta.get("avatar_url") or user_meta.get("picture") or ""
                new_profile = (
                    supabase.table("opp_profiles")
                    .insert({
                        "id": user_id,
                        "email": user.email or "",
                        "full_name": full_name,
                        "avatar_url": avatar_url,
                        "role": "student",
                    })
                    .execute()
                )
                profile = new_profile.data[0] if new_profile.data else {
                    "id": user_id,
                    "email": user.email or "",
                    "full_name": full_name,
                    "avatar_url": avatar_url,
                    "college_name": None,
                    "role": "student",
                }

            # Check for admin privilege configured via ADMIN_EMAILS in environment (never hardcoded)
            admin_emails = [
                e.strip().lower()
                for e in os.environ.get("ADMIN_EMAILS", "").split(",")
                if e.strip()
            ]
            user_email = (getattr(user, "email", None) or profile.get("email") or "").strip().lower()
            if user_email and user_email in admin_emails:
                if profile.get("role") != "admin":
                    try:
                        supabase.table("opp_profiles").update({"role": "admin"}).eq("id", user_id).execute()
                        profile["role"] = "admin"
                        logger.info("Elevated user %s to admin role via ADMIN_EMAILS.", user_id)
                    except Exception as err:
                        logger.error("Failed to update role in opp_profiles for %s: %s", user_id, err)
                        profile["role"] = "admin"

            # Attach to request context
            g.user_id = user_id
            g.current_user = profile

        except Exception as e:
            logger.warning("Auth token verification error: %s", str(e)[:200])
            return jsonify({"error": "Invalid or expired authorization token."}), 401

        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    """
    Decorator: requires admin role.
    Must be used with @login_required or wraps it automatically.
    Returns 403 if authenticated user is not an admin.
    """
    @functools.wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if g.current_user.get("role") != "admin":
            return jsonify({"error": "You do not have permission to access this resource."}), 403
        return f(*args, **kwargs)

    return decorated_function
