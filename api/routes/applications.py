"""
Applications API
=================
GET  /api/applications  — List user's tracked applications
POST /api/applications  — Upsert application status for an opportunity

All endpoints require authentication.
Pipeline stages: Saved → Interested → Applied → Shortlisted → Interview → Selected / Rejected
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

from api.middleware.auth_middleware import login_required
from api.middleware.validators import validate_application_status
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

applications_bp = Blueprint("applications", __name__)


@applications_bp.route("/api/applications", methods=["GET"])
@login_required
def list_applications():
    """List current user's tracked applications with opportunity details."""
    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_applications")
            .select(
                "id, status, notes, applied_at, updated_at, "
                "opp_opportunities("
                "id, title, organiser, category, platform, "
                "official_url, deadline_utc, mode, city, "
                "prize_label, is_expired"
                ")"
            )
            .eq("user_id", g.user_id)
            .order("updated_at", desc=True)
            .execute()
        )

        return jsonify({
            "count": len(result.data),
            "applications": result.data,
        })

    except Exception as e:
        logger.error("Error listing applications: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@applications_bp.route("/api/applications", methods=["POST"])
@login_required
def upsert_application():
    """
    Create or update an application tracking entry.
    Body: { "opportunity_id": 123, "status": "Applied", "notes": "..." }
    Upserts: if (user, opportunity) pair exists, updates status.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body is required."}), 400

    # ── Validate opportunity_id ──────────────────────────────────────
    opportunity_id = data.get("opportunity_id")
    if not opportunity_id:
        return jsonify({"error": "opportunity_id is required."}), 400

    try:
        opportunity_id = int(opportunity_id)
    except (ValueError, TypeError):
        return jsonify({"error": "opportunity_id must be a number."}), 400

    # ── Validate status ──────────────────────────────────────────────
    status = data.get("status", "")
    valid, err = validate_application_status(status)
    if not valid:
        return jsonify({"error": err}), 400

    # ── Optional notes ───────────────────────────────────────────────
    notes = (data.get("notes") or "").strip() or None

    try:
        supabase = get_service_client()

        # Verify opportunity exists
        opp = (
            supabase.table("opp_opportunities")
            .select("id")
            .eq("id", opportunity_id)
            .execute()
        )

        if not opp.data:
            return jsonify({"error": "Opportunity not found."}), 404

        # Check if application already exists for this user + opportunity
        existing = (
            supabase.table("opp_applications")
            .select("id, status")
            .eq("user_id", g.user_id)
            .eq("opportunity_id", opportunity_id)
            .execute()
        )

        now = datetime.now(timezone.utc).isoformat()

        if existing.data:
            # Update existing application
            update_data = {
                "status": status,
                "updated_at": now,
            }
            if notes is not None:
                update_data["notes"] = notes
            # Set applied_at timestamp when status changes to "Applied"
            if status == "Applied" and existing.data[0].get("status") != "Applied":
                update_data["applied_at"] = now

            result = (
                supabase.table("opp_applications")
                .update(update_data)
                .eq("id", existing.data[0]["id"])
                .eq("user_id", g.user_id)  # Anti-IDOR
                .execute()
            )

            return jsonify({
                "message": "Application updated.",
                "application": result.data[0] if result.data else None,
            })
        else:
            # Create new application
            insert_data = {
                "user_id": g.user_id,
                "opportunity_id": opportunity_id,
                "status": status,
                "notes": notes,
                "updated_at": now,
            }
            if status == "Applied":
                insert_data["applied_at"] = now

            result = (
                supabase.table("opp_applications")
                .insert(insert_data)
                .execute()
            )

            return jsonify({
                "message": "Application tracked.",
                "application": result.data[0] if result.data else None,
            }), 201

    except Exception as e:
        logger.error("Error upserting application: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
