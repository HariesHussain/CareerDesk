"""
Submissions API
================
POST /api/submissions — Submit a new opportunity for admin review.

Auth required. Validates all fields per docs/10-SECURITY.md:
  - official_url must be https?:// (rejects javascript:, data:, vbscript:)
  - category must be from allow-list
  - mode validated if provided
"""

import logging

from flask import Blueprint, request, jsonify, g

from api.middleware.auth_middleware import login_required
from api.middleware.rate_limiter import rate_limit
from api.middleware.validators import (
    validate_url,
    validate_text,
    validate_category,
    validate_mode,
)
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

submissions_bp = Blueprint("submissions", __name__)


@submissions_bp.route("/api/submissions", methods=["POST"])
@login_required
@rate_limit(max_requests=5, window_seconds=300)
def create_submission():
    """
    Submit a new opportunity for admin review.
    Body: {
        "title": "...",
        "organiser": "...",
        "category": "HACKATHON",
        "official_url": "https://...",
        "deadline_utc": "2026-12-01T00:00:00Z",
        "mode": "ONLINE",
        "city": "...",
        "fee": "Free",
        "prize_label": "₹50,000",
        "description": "..."
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    # ── Validate required fields ─────────────────────────────────────
    title, err = validate_text(data.get("title", ""), "Title", max_length=500, required=True)
    if err:
        return jsonify({"error": err}), 400

    valid, err = validate_url(data.get("official_url", ""))
    if not valid:
        return jsonify({"error": err}), 400

    category = (data.get("category") or "").strip().upper()
    valid, err = validate_category(category)
    if not valid:
        return jsonify({"error": err}), 400

    # ── Validate optional fields ─────────────────────────────────────
    organiser, err = validate_text(data.get("organiser", ""), "Organiser", max_length=300)
    if err:
        return jsonify({"error": err}), 400

    mode = (data.get("mode") or "").strip().upper() or None
    if mode:
        valid, err = validate_mode(mode)
        if not valid:
            return jsonify({"error": err}), 400

    city, err = validate_text(data.get("city", ""), "City", max_length=64)
    if err:
        return jsonify({"error": err}), 400

    fee, err = validate_text(data.get("fee", ""), "Fee", max_length=32)
    if err:
        return jsonify({"error": err}), 400

    prize_label, err = validate_text(data.get("prize_label", ""), "Prize", max_length=200)
    if err:
        return jsonify({"error": err}), 400

    description, err = validate_text(data.get("description", ""), "Description", max_length=5000)
    if err:
        return jsonify({"error": err}), 400

    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_submissions")
            .insert({
                "submitted_by_user_id": g.user_id,
                "title": title,
                "organiser": organiser,
                "category": category,
                "official_url": data.get("official_url", "").strip(),
                "deadline_utc": data.get("deadline_utc"),
                "mode": mode,
                "city": city,
                "fee": fee,
                "prize_label": prize_label,
                "description": description,
                "status": "pending",
            })
            .execute()
        )

        logger.info("New submission by user %s: %s", g.user_id, title)

        return jsonify({
            "message": "Submission received. It will be reviewed by an admin.",
            "submission": result.data[0] if result.data else None,
        }), 201

    except Exception as e:
        logger.error("Error creating submission: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
