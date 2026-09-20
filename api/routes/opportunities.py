"""
Opportunities API
==================
GET /api/opportunities       — Search, filter, sort, paginate opportunities
GET /api/opportunities/<id>  — Single opportunity detail

Public endpoints — no auth required.
Queries our indexed Supabase DB, NEVER calls Brabble live per docs/10-SECURITY.md.
"""

import logging

from flask import Blueprint, request, jsonify

from api.services.supabase_client import get_service_client
from api.middleware.validators import VALID_SORT_OPTIONS

logger = logging.getLogger(__name__)

opportunities_bp = Blueprint("opportunities", __name__)


@opportunities_bp.route("/api/opportunities", methods=["GET"])
def list_opportunities():
    """
    List opportunities with filtering, search, sorting, and pagination.

    Query params (all optional):
      q        — substring match on title/organiser
      category — normalized category (HACKATHON, CODING, etc.)
      mode     — ONLINE / OFFLINE / HYBRID
      city     — city name
      platform — platform name (Unstop, Devfolio, etc.)
      free     — "true" to filter fee == "Free"
      sort     — deadline (default) / newest / alphabetical
      limit    — default 20, max 100
      offset   — default 0
    """
    try:
        supabase = get_service_client()

        # ── Parse pagination params ──────────────────────────────────
        try:
            limit = min(int(request.args.get("limit", 20)), 100)
            offset = max(int(request.args.get("offset", 0)), 0)
        except (ValueError, TypeError):
            limit = 20
            offset = 0

        # ── Build query ──────────────────────────────────────────────
        query = supabase.table("opp_opportunities").select(
            "id, external_id, title, organiser, category, kind, platform, "
            "official_url, share_url, deadline_utc, mode, city, "
            "prize_label, prize_inr, team_size, fee, eligibility, "
            "registered_count, is_expired, first_seen_at",
            count="exact",
        ).eq("status", "approved").eq("is_expired", False)

        # ── Apply filters ────────────────────────────────────────────
        q = request.args.get("q", "").strip()
        if q:
            # Use ilike for case-insensitive substring search
            query = query.or_(f"title.ilike.%{q}%,organiser.ilike.%{q}%")

        category = request.args.get("category", "").strip().upper()
        if category:
            query = query.eq("category", category)

        mode = request.args.get("mode", "").strip().upper()
        if mode in ("ONLINE", "OFFLINE", "HYBRID"):
            query = query.eq("mode", mode)

        city = request.args.get("city", "").strip()
        if city:
            query = query.ilike("city", f"%{city}%")

        platform = request.args.get("platform", "").strip()
        if platform:
            query = query.ilike("platform", f"%{platform}%")

        free = request.args.get("free", "").strip().lower()
        if free == "true":
            query = query.eq("fee", "Free")

        # ── Apply sorting ────────────────────────────────────────────
        sort = request.args.get("sort", "deadline").strip().lower()
        if sort not in VALID_SORT_OPTIONS:
            sort = "deadline"

        if sort == "deadline":
            query = query.order("deadline_utc", desc=False, nullslast=True)
        elif sort == "newest":
            query = query.order("first_seen_at", desc=True)
        elif sort == "alphabetical":
            query = query.order("title", desc=False)

        # ── Apply pagination ─────────────────────────────────────────
        query = query.range(offset, offset + limit - 1)

        # ── Execute ──────────────────────────────────────────────────
        result = query.execute()

        return jsonify({
            "total": result.count if result.count is not None else len(result.data),
            "count": len(result.data),
            "offset": offset,
            "limit": limit,
            "opportunities": result.data,
        })

    except Exception as e:
        logger.error("Error listing opportunities: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@opportunities_bp.route("/api/opportunities/<int:opp_id>", methods=["GET"])
def get_opportunity(opp_id: int):
    """
    Get full details for a single opportunity.
    Returns 404 if not found or not approved.
    """
    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_opportunities")
            .select("*")
            .eq("id", opp_id)
            .eq("status", "approved")
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Opportunity not found."}), 404

        return jsonify(result.data[0])

    except Exception as e:
        logger.error("Error fetching opportunity %d: %s", opp_id, str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
