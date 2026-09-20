"""
Bookmarks API
==============
GET    /api/bookmarks                   — List user's bookmarked opportunities
POST   /api/bookmarks                   — Bookmark an opportunity
DELETE /api/bookmarks/<opportunity_id>   — Remove a bookmark

All endpoints require authentication.
Anti-IDOR: queries scoped to session user_id only.
"""

import logging

from flask import Blueprint, request, jsonify, g

from api.middleware.auth_middleware import login_required
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

bookmarks_bp = Blueprint("bookmarks", __name__)


@bookmarks_bp.route("/api/bookmarks", methods=["GET"])
@login_required
def list_bookmarks():
    """List current user's bookmarked opportunities with joined opportunity data."""
    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_bookmarks")
            .select(
                "id, created_at, "
                "opp_opportunities("
                "id, title, organiser, category, kind, platform, "
                "official_url, deadline_utc, mode, city, "
                "prize_label, prize_inr, team_size, fee, is_expired"
                ")"
            )
            .eq("user_id", g.user_id)
            .order("created_at", desc=True)
            .execute()
        )

        return jsonify({
            "count": len(result.data),
            "bookmarks": result.data,
        })

    except Exception as e:
        logger.error("Error listing bookmarks: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@bookmarks_bp.route("/api/bookmarks", methods=["POST"])
@login_required
def create_bookmark():
    """
    Bookmark an opportunity.
    Body: { "opportunity_id": 123 }
    Idempotent: returns 409 if already bookmarked.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    opportunity_id = data.get("opportunity_id")
    if not opportunity_id:
        return jsonify({"error": "opportunity_id is required."}), 400

    try:
        opportunity_id = int(opportunity_id)
    except (ValueError, TypeError):
        return jsonify({"error": "opportunity_id must be a number."}), 400

    try:
        supabase = get_service_client()

        # Verify opportunity exists and is approved
        opp = (
            supabase.table("opp_opportunities")
            .select("id")
            .eq("id", opportunity_id)
            .eq("status", "approved")
            .execute()
        )

        if not opp.data:
            return jsonify({"error": "Opportunity not found."}), 404

        # Check if already bookmarked
        existing = (
            supabase.table("opp_bookmarks")
            .select("id")
            .eq("user_id", g.user_id)
            .eq("opportunity_id", opportunity_id)
            .execute()
        )

        if existing.data:
            return jsonify({"error": "Already bookmarked."}), 409

        # Create bookmark
        result = (
            supabase.table("opp_bookmarks")
            .insert({
                "user_id": g.user_id,
                "opportunity_id": opportunity_id,
            })
            .execute()
        )

        return jsonify({
            "message": "Bookmarked successfully.",
            "bookmark": result.data[0] if result.data else None,
        }), 201

    except Exception as e:
        logger.error("Error creating bookmark: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@bookmarks_bp.route("/api/bookmarks/<int:opportunity_id>", methods=["DELETE"])
@login_required
def delete_bookmark(opportunity_id: int):
    """Remove a bookmark. Scoped to current user only (anti-IDOR)."""
    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_bookmarks")
            .delete()
            .eq("user_id", g.user_id)
            .eq("opportunity_id", opportunity_id)
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Bookmark not found."}), 404

        return jsonify({"message": "Bookmark removed."})

    except Exception as e:
        logger.error("Error deleting bookmark: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
