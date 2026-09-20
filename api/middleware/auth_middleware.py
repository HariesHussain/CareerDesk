"""
Authentication Middleware
==========================
Provides decorators for protecting API endpoints:
  - `login_required`: Validates session, attaches user_id to request context
  - `admin_required`: Extends login_required with admin role check

Session management uses Flask's built-in secure signed cookies.
Passwords hashed with werkzeug.security (PBKDF2-SHA256 with salt).
"""

import functools
import logging

from flask import request, jsonify, session, g

from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


def login_required(f):
    """
    Decorator: requires a valid session with user_id.
    Attaches user data to flask.g for downstream handlers.
    Returns 401 if not authenticated.
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Authentication required."}), 401

        try:
            supabase = get_service_client()
            result = (
                supabase.table("opp_users")
                .select("id, email, full_name, college_name, role")
                .eq("id", user_id)
                .execute()
            )

            if not result.data:
                session.clear()
                return jsonify({"error": "Authentication required."}), 401

            # Attach user to request context
            g.current_user = result.data[0]
            g.user_id = user_id

        except Exception as e:
            logger.error("Auth middleware error: %s", str(e)[:200])
            return jsonify({"error": "Something went wrong, please try again."}), 500

        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    """
    Decorator: requires admin role.
    Must be used after @login_required or combines both checks.
    Returns 403 if authenticated but not admin.
    """
    @functools.wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if g.current_user.get("role") != "admin":
            return jsonify({"error": "You do not have permission to access this resource."}), 403
        return f(*args, **kwargs)

    return decorated_function
