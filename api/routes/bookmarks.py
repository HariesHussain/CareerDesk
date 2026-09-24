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
                "id, opportunity_id, created_at, "
                "opp_opportunities(*)"
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
    Idempotent: returns 200 if already bookmarked.
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

        # Check if already bookmarked (idempotent success)
        existing = (
            supabase.table("opp_bookmarks")
            .select("id, opportunity_id")
            .eq("user_id", g.user_id)
            .eq("opportunity_id", opportunity_id)
            .execute()
        )

        if existing.data:
            return jsonify({
                "message": "Already bookmarked.",
                "bookmark": existing.data[0],
            }), 200

        # Verify opportunity exists in database
        opp = (
            supabase.table("opp_opportunities")
            .select("id")
            .eq("id", opportunity_id)
            .execute()
        )

        if not opp.data:
            return jsonify({"error": "Opportunity not found."}), 404

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
            "bookmark": result.data[0] if result.data else {"opportunity_id": opportunity_id},
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

        supabase.table("opp_bookmarks").delete().eq("user_id", g.user_id).eq("opportunity_id", opportunity_id).execute()

        return jsonify({"message": "Bookmark removed."}), 200

    except Exception as e:
        logger.error("Error deleting bookmark: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
