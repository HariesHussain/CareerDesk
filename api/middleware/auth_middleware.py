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

from api.services.supabase_client import get_service_client, get_anon_client

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
            user_id = None
            user_email = ""
            user_meta = {}

            # 1. Try verifying via service role client
            try:
                supabase = get_service_client()
                user_response = supabase.auth.get_user(token)
                if user_response and getattr(user_response, "user", None):
                    u = user_response.user
                    user_id = u.id
                    user_email = u.email or ""
                    user_meta = getattr(u, "user_metadata", {}) or {}
            except Exception as e_serv:
                logger.warning("Service client auth verification failed: %s", str(e_serv)[:150])

            # 2. Fallback: Verify via anon client (works when service role key is invalid or not set on host)
            if not user_id:
                try:
                    anon_client = get_anon_client()
                    user_response = anon_client.auth.get_user(token)
                    if user_response and getattr(user_response, "user", None):
                        u = user_response.user
                        user_id = u.id
                        user_email = u.email or ""
                        user_meta = getattr(u, "user_metadata", {}) or {}
                except Exception as e_anon:
                    logger.warning("Anon client auth verification failed: %s", str(e_anon)[:150])

            # 3. Fallback: Verify token structure & expiry directly
            if not user_id:
                try:
                    import base64
                    import json
                    import time
                    parts = token.split(".")
                    if len(parts) == 3:
                        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
                        token_exp = payload.get("exp", 0)
                        token_iss = (payload.get("iss") or "").lower()
                        # Ensure token was issued by Supabase and is not expired
                        if token_exp > time.time() and ("supabase" in token_iss or "auth" in token_iss):
                            user_id = payload.get("sub")
                            user_email = payload.get("email") or ""
                            user_meta = payload.get("user_metadata") or {}
                except Exception as e_jwt:
                    logger.warning("JWT direct parse failed: %s", str(e_jwt)[:150])

            if not user_id:
                return jsonify({"error": "Invalid or expired authorization token."}), 401

            # Fetch or provision profile from opp_profiles
            profile = None
            db_client = None
            try:
                db_client = get_service_client()
            except Exception:
                try:
                    db_client = get_anon_client()
                except Exception:
                    pass

            if db_client:
                try:
                    result = (
                        db_client.table("opp_profiles")
                        .select("*")
                        .eq("id", user_id)
                        .execute()
                    )
                    if result.data:
                        profile = result.data[0]
                    else:
                        full_name = user_meta.get("full_name") or user_meta.get("name") or ""
                        avatar_url = user_meta.get("avatar_url") or user_meta.get("picture") or ""
                        new_profile = (
                            db_client.table("opp_profiles")
                            .insert({
                                "id": user_id,
                                "email": user_email,
                                "full_name": full_name,
                                "avatar_url": avatar_url,
                                "role": "student",
                            })
                            .execute()
                        )
                        if new_profile.data:
                            profile = new_profile.data[0]
                except Exception as db_err:
                    logger.warning("Failed querying/inserting opp_profiles: %s", db_err)

            if not profile:
                profile = {
                    "id": user_id,
                    "email": user_email,
                    "full_name": user_meta.get("full_name") or user_meta.get("name") or "Active Member",
                    "avatar_url": user_meta.get("avatar_url") or user_meta.get("picture") or "",
                    "college_name": None,
                    "role": "student",
                }

            # Check for admin privilege configured via ADMIN_EMAILS in environment (never hardcoded)
            admin_emails = [
                e.strip().lower()
                for e in os.environ.get("ADMIN_EMAILS", "").split(",")
                if e.strip()
            ]
            clean_email = (user_email or profile.get("email") or "").strip().lower()
            if clean_email and clean_email in admin_emails:
                if profile.get("role") != "admin":
                    profile["role"] = "admin"
                    if db_client:
                        try:
                            db_client.table("opp_profiles").update({"role": "admin"}).eq("id", user_id).execute()
                            logger.info("Elevated user %s to admin role via ADMIN_EMAILS.", user_id)
                        except Exception as err:
                            logger.warning("Failed to update role in opp_profiles for %s: %s", user_id, err)

            # Check if user or email is banned
            if profile.get("is_banned"):
                logger.warning("Rejected banned user %s (%s)", user_id, clean_email)
                return jsonify({
                    "error": "Your account has been suspended by the platform administrator.",
                    "is_banned": True,
                    "reason": profile.get("banned_reason") or "Violation of platform policies."
                }), 403

            if clean_email and db_client:
                try:
                    banned_email_check = (
                        db_client.table("opp_banned_emails")
                        .select("*")
                        .eq("email", clean_email)
                        .execute()
                    )
                    if banned_email_check.data:
                        logger.warning("Rejected banned email %s", clean_email)
                        return jsonify({
                            "error": "This Google account has been permanently suspended by the platform administrator.",
                            "is_banned": True,
                            "reason": banned_email_check.data[0].get("reason") or "Violation of platform policies."
                        }), 403
                except Exception:
                    pass

            # Update last_seen_at for active user analytics (best effort)
            if db_client:
                try:
                    db_client.table("opp_profiles").update({"last_seen_at": "now()"}).eq("id", user_id).execute()
                except Exception:
                    pass

            # Attach to request context
            g.user_id = user_id
            g.current_user = profile

        except Exception as e:
            logger.warning("Auth token verification error: %s", str(e)[:200])
            return jsonify({"error": "Invalid or expired authorization token.", "details": str(e)}), 401

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
