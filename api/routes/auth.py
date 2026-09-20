"""
Auth API (Supabase Auth & Google OAuth)
========================================
GET  /api/auth/me              — Get current authenticated user profile
PUT  /api/auth/profile         — Update student profile (college name, full name)
POST /api/auth/forgot-password — Password recovery guidance for Google SSO accounts
POST /api/auth/logout          — Acknowledge sign-out

Authentication is handled via Supabase Auth using Google Single Sign-On (OAuth).
Client acquires a JWT access token via Supabase and provides it in:
`Authorization: Bearer <access_token>`
"""

import logging
from flask import Blueprint, request, jsonify, g

from api.services.supabase_client import get_service_client
from api.middleware.auth_middleware import login_required
from api.middleware.rate_limiter import rate_limit
from api.middleware.validators import validate_text

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    """
    Get current authenticated user's profile.
    Requires: Authorization: Bearer <access_token>
    """
    user = g.current_user
    return jsonify({
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "avatar_url": user.get("avatar_url"),
            "college_name": user.get("college_name"),
            "role": user.get("role", "student"),
        }
    })


@auth_bp.route("/api/auth/profile", methods=["PUT"])
@login_required
def update_profile():
    """
    Update student profile details (full_name, college_name).
    Body: { "full_name": "...", "college_name": "..." }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    updates = {}

    if "full_name" in data:
        full_name, err = validate_text(data["full_name"], "Full name", max_length=200)
        if err:
            return jsonify({"error": err}), 400
        updates["full_name"] = full_name

    if "college_name" in data:
        college_name, err = validate_text(data["college_name"], "College name", max_length=300)
        if err:
            return jsonify({"error": err}), 400
        updates["college_name"] = college_name

    if not updates:
        return jsonify({"error": "No valid fields provided for update."}), 400

    updates["updated_at"] = "now()"

    try:
        supabase = get_service_client()
        result = (
            supabase.table("opp_profiles")
            .update(updates)
            .eq("id", g.user_id)
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Failed to update profile."}), 500

        updated_profile = result.data[0]
        return jsonify({
            "message": "Profile updated successfully.",
            "user": {
                "id": updated_profile["id"],
                "email": updated_profile["email"],
                "full_name": updated_profile.get("full_name"),
                "avatar_url": updated_profile.get("avatar_url"),
                "college_name": updated_profile.get("college_name"),
                "role": updated_profile.get("role", "student"),
            }
        })

    except Exception as e:
        logger.error("Error updating profile: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
@rate_limit(max_requests=5, window_seconds=60)
def forgot_password():
    """
    Password recovery handler.
    Since OpportunityOS uses Google Single Sign-On (OAuth) exclusively,
    passwords are never stored on OpportunityOS. Users recover credentials via Google.
    
    Accepts optional body: { "email": "..." }
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    return jsonify({
        "auth_provider": "google",
        "message": (
            "OpportunityOS accounts use Google Single Sign-On. "
            "Your password is managed securely by your Google Account. "
            "To reset or recover your Google Account password, please visit Google Account Recovery."
        ),
        "recovery_url": "https://accounts.google.com/signin/recovery",
        "email": email or None,
    })


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    Client acknowledges sign-out.
    The frontend Supabase client executes `supabase.auth.signOut()`
    to revoke and clear the local session.
    """
    return jsonify({
        "message": "Logged out successfully.",
        "instructions": "Ensure supabase.auth.signOut() is invoked on the client."
    })
