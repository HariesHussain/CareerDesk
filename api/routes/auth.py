"""
Auth API
=========
POST /api/auth/register  — Create student account
POST /api/auth/login     — Authenticate and start session
POST /api/auth/logout    — End session
GET  /api/auth/me        — Get current user profile

Passwords hashed with werkzeug.security (PBKDF2-SHA256).
Sessions use Flask's signed HttpOnly cookies with SECRET_KEY.
Anti-enumeration: login errors never reveal whether email exists.
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash

from api.services.supabase_client import get_service_client
from api.middleware.auth_middleware import login_required
from api.middleware.rate_limiter import rate_limit
from api.middleware.validators import validate_email, validate_password, validate_text

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/api/auth/register", methods=["POST"])
@rate_limit(max_requests=5, window_seconds=60)
def register():
    """
    Register a new student account.
    Body: { "email": "...", "password": "...", "full_name": "...", "college_name": "..." }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    # ── Validate email ───────────────────────────────────────────────
    email = (data.get("email") or "").strip().lower()
    valid, err = validate_email(email)
    if not valid:
        return jsonify({"error": err}), 400

    # ── Validate password ────────────────────────────────────────────
    password = data.get("password", "")
    valid, err = validate_password(password)
    if not valid:
        return jsonify({"error": err}), 400

    # ── Validate optional fields ─────────────────────────────────────
    full_name, err = validate_text(data.get("full_name", ""), "Full name", max_length=200)
    if err:
        return jsonify({"error": err}), 400

    college_name, err = validate_text(data.get("college_name", ""), "College name", max_length=300)
    if err:
        return jsonify({"error": err}), 400

    try:
        supabase = get_service_client()

        # ── Check if email already exists ────────────────────────────
        existing = (
            supabase.table("opp_users")
            .select("id")
            .eq("email", email)
            .execute()
        )

        if existing.data:
            return jsonify({"error": "An account with this email already exists."}), 409

        # ── Hash password and create user ────────────────────────────
        password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

        new_user = (
            supabase.table("opp_users")
            .insert({
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "college_name": college_name,
                "role": "student",
            })
            .execute()
        )

        if not new_user.data:
            return jsonify({"error": "Failed to create account. Please try again."}), 500

        user = new_user.data[0]

        # ── Start session ────────────────────────────────────────────
        session.permanent = True
        session["user_id"] = user["id"]

        logger.info("New user registered: %s", email)

        return jsonify({
            "message": "Account created successfully.",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user.get("full_name"),
                "college_name": user.get("college_name"),
                "role": user["role"],
            },
        }), 201

    except Exception as e:
        logger.error("Registration error: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@auth_bp.route("/api/auth/login", methods=["POST"])
@rate_limit(max_requests=10, window_seconds=60)
def login():
    """
    Authenticate user and start session.
    Body: { "email": "...", "password": "..." }
    Anti-enumeration: same error for wrong email or wrong password.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    try:
        supabase = get_service_client()

        # Fetch user by email
        result = (
            supabase.table("opp_users")
            .select("id, email, password_hash, full_name, college_name, role")
            .eq("email", email)
            .execute()
        )

        # Generic error message prevents user enumeration
        if not result.data:
            return jsonify({"error": "Invalid email or password."}), 401

        user = result.data[0]

        # Verify password
        if not check_password_hash(user["password_hash"], password):
            return jsonify({"error": "Invalid email or password."}), 401

        # ── Start session ────────────────────────────────────────────
        session.permanent = True
        session["user_id"] = user["id"]

        logger.info("User logged in: %s", email)

        return jsonify({
            "message": "Login successful.",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "full_name": user.get("full_name"),
                "college_name": user.get("college_name"),
                "role": user["role"],
            },
        })

    except Exception as e:
        logger.error("Login error: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    """End the user session."""
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@auth_bp.route("/api/auth/me", methods=["GET"])
@login_required
def me():
    """Get current authenticated user's profile."""
    from flask import g
    user = g.current_user
    return jsonify({
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "college_name": user.get("college_name"),
            "role": user["role"],
        }
    })
