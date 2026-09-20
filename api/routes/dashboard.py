"""
Dashboard API
==============
GET /api/dashboard — Aggregate stats for the authenticated user.

Returns:
  - Total bookmarks
  - Total applications by status
  - Upcoming deadlines (next 5 from bookmarked/applied opportunities)
"""

import logging

from flask import Blueprint, jsonify, g

from api.middleware.auth_middleware import login_required
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/api/dashboard", methods=["GET"])
@login_required
def get_dashboard():
    """
    Aggregate dashboard data for the current user.
    Single endpoint to minimize frontend requests.
    """
    try:
        supabase = get_service_client()

        # ── Total bookmarks ──────────────────────────────────────────
        bookmarks_result = (
            supabase.table("opp_bookmarks")
            .select("id", count="exact")
            .eq("user_id", g.user_id)
            .execute()
        )
        total_bookmarks = bookmarks_result.count or 0

        # ── Applications by status ───────────────────────────────────
        applications_result = (
            supabase.table("opp_applications")
            .select("status")
            .eq("user_id", g.user_id)
            .execute()
        )

        status_breakdown = {}
        for app in (applications_result.data or []):
            status = app.get("status", "Unknown")
            status_breakdown[status] = status_breakdown.get(status, 0) + 1

        total_applications = sum(status_breakdown.values())

        # ── Upcoming deadlines ───────────────────────────────────────
        # Get next 5 upcoming deadlines from bookmarked or applied opportunities
        # Using bookmarks to find relevant opportunity IDs
        bookmarked_opps = (
            supabase.table("opp_bookmarks")
            .select("opportunity_id")
            .eq("user_id", g.user_id)
            .execute()
        )

        applied_opps = (
            supabase.table("opp_applications")
            .select("opportunity_id")
            .eq("user_id", g.user_id)
            .execute()
        )

        # Combine and deduplicate opportunity IDs
        opp_ids = set()
        for b in (bookmarked_opps.data or []):
            opp_ids.add(b["opportunity_id"])
        for a in (applied_opps.data or []):
            opp_ids.add(a["opportunity_id"])

        upcoming_deadlines = []
        if opp_ids:
            deadlines_result = (
                supabase.table("opp_opportunities")
                .select("id, title, deadline_utc, platform, category")
                .in_("id", list(opp_ids))
                .eq("is_expired", False)
                .not_.is_("deadline_utc", "null")
                .order("deadline_utc", desc=False)
                .limit(5)
                .execute()
            )
            upcoming_deadlines = deadlines_result.data or []

        return jsonify({
            "total_bookmarks": total_bookmarks,
            "total_applications": total_applications,
            "status_breakdown": status_breakdown,
            "upcoming_deadlines": upcoming_deadlines,
        })

    except Exception as e:
        logger.error("Error fetching dashboard: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
