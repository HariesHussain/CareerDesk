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
            limit = min(max(int(request.args.get("limit", 24)), 1), 100)
            if "offset" in request.args:
                offset = max(int(request.args.get("offset", 0)), 0)
            elif "page" in request.args:
                page = max(int(request.args.get("page", 1)), 1)
                offset = (page - 1) * limit
            else:
                offset = 0
        except (ValueError, TypeError):
            limit = 24
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
        q = (request.args.get("q") or request.args.get("search") or "").strip()
        if q:
            # Use ilike for case-insensitive substring search
            query = query.or_(f"title.ilike.%{q}%,organiser.ilike.%{q}%")

        cat_raw = (request.args.get("category") or request.args.get("type") or "").strip().upper()
        if cat_raw and cat_raw != "ALL":
            if cat_raw in ("HACKATHON", "HACKATHONS"):
                query = query.eq("category", "HACKATHON")
            elif cat_raw in ("CONTEST", "CODING", "CONTESTS"):
                query = query.in_("category", ["CONTEST", "CODING"])
            elif cat_raw in ("COMPETITION", "COMPETITIONS"):
                query = query.eq("category", "COMPETITION")
            elif cat_raw in ("INNOVATION", "GRANT", "GRANTS", "DESIGN"):
                query = query.in_("category", ["INNOVATION", "DESIGN"])
            elif cat_raw in ("CASE_STUDY", "CASESTUDY", "QUIZ", "QUIZZES"):
                query = query.in_("category", ["CASE_STUDY", "QUIZ"])
            elif cat_raw in ("FELLOWSHIP", "FELLOWSHIPS"):
                query = query.or_("title.ilike.%fellowship%,kind.ilike.%fellowship%")
            else:
                query = query.eq("category", cat_raw)

        raw_mode = (request.args.get("mode") or "").strip().upper()
        if raw_mode in ("IN_PERSON", "OFFLINE"):
            query = query.eq("mode", "OFFLINE")
        elif raw_mode in ("ONLINE", "REMOTE"):
            query = query.eq("mode", "ONLINE")
        elif raw_mode == "HYBRID":
            query = query.eq("mode", "HYBRID")

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
        raw_sort = (request.args.get("sort") or "deadline").strip().lower()
        if "deadline_desc" in raw_sort or "latest" in raw_sort:
            query = query.order("deadline_utc", desc=True, nullsfirst=False)
        elif "deadline" in raw_sort:
            query = query.order("deadline_utc", desc=False, nullsfirst=False)
        elif "prize" in raw_sort:
            query = query.order("prize_inr", desc=True, nullsfirst=False)
        elif "new" in raw_sort:
            query = query.order("first_seen_at", desc=True)
        elif "alpha" in raw_sort or "title" in raw_sort:
            query = query.order("title", desc=False)
        else:
            query = query.order("deadline_utc", desc=False, nullsfirst=False)

        # ── Apply pagination ─────────────────────────────────────────
        query = query.range(offset, offset + limit - 1)

        # ── Execute ──────────────────────────────────────────────────
        result = query.execute()

        total = result.count if result.count is not None else len(result.data)
        count = len(result.data)
        has_more = (offset + count) < total

        return jsonify({
            "total": total,
            "count": count,
            "offset": offset,
            "limit": limit,
            "has_more": has_more,
            "page": (offset // limit) + 1 if limit else 1,
            "opportunities": result.data,
        })

    except Exception as e:
        logger.error("Error listing opportunities: %s", str(e)[:200])
        return jsonify({"error": f"Failed to load opportunities: {str(e)}"}), 500


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
