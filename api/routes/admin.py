"""
Admin API
==========
GET  /api/admin/submissions                — List pending (or all) submissions
POST /api/admin/submissions/<id>/approve   — Approve submission → create opportunity
POST /api/admin/submissions/<id>/reject    — Reject submission with optional reason
DELETE /api/admin/opportunities/<id>       — Soft-delete an opportunity

All endpoints require admin role (403 for non-admins).
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

from api.middleware.auth_middleware import admin_required
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/api/admin/submissions", methods=["GET"])
@admin_required
def list_submissions():
    """
    List submissions for admin review.
    Query params:
      status — filter by status (default: "pending")
    """
    try:
        supabase = get_service_client()

        status_filter = request.args.get("status", "pending").strip().lower()

        query = (
            supabase.table("opp_submissions")
            .select(
                "*, opp_users!submitted_by_user_id(email, full_name)"
            )
            .order("created_at", desc=True)
        )

        if status_filter != "all":
            query = query.eq("status", status_filter)

        result = query.execute()

        return jsonify({
            "count": len(result.data),
            "submissions": result.data,
        })

    except Exception as e:
        logger.error("Error listing submissions: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@admin_bp.route("/api/admin/submissions/<int:submission_id>/approve", methods=["POST"])
@admin_required
def approve_submission(submission_id: int):
    """
    Approve a pending submission.
    Creates a new opportunity row from the submission data.
    """
    try:
        supabase = get_service_client()

        # Fetch the submission
        sub_result = (
            supabase.table("opp_submissions")
            .select("*")
            .eq("id", submission_id)
            .eq("status", "pending")
            .execute()
        )

        if not sub_result.data:
            return jsonify({"error": "Submission not found or already reviewed."}), 404

        submission = sub_result.data[0]
        now = datetime.now(timezone.utc).isoformat()

        # Create opportunity from submission
        opp_data = {
            "external_id": None,  # User submissions have no external_id
            "source": "user_submission",
            "title": submission["title"],
            "organiser": submission.get("organiser"),
            "category": submission["category"],
            "kind": "competition",  # Default for user submissions
            "platform": None,
            "official_url": submission["official_url"],
            "share_url": None,
            "deadline_utc": submission.get("deadline_utc"),
            "mode": submission.get("mode") or "ONLINE",
            "city": submission.get("city"),
            "prize_label": submission.get("prize_label"),
            "prize_inr": None,
            "team_size": None,
            "fee": submission.get("fee"),
            "eligibility": "[]",
            "registered_count": None,
            "description": submission.get("description"),
            "is_expired": False,
            "status": "approved",
        }

        supabase.table("opp_opportunities").insert(opp_data).execute()

        # Mark submission as approved
        supabase.table("opp_submissions").update({
            "status": "approved",
            "reviewed_by_user_id": g.user_id,
            "reviewed_at": now,
        }).eq("id", submission_id).execute()

        logger.info(
            "Submission %d approved by admin %s",
            submission_id, g.user_id,
        )

        return jsonify({"message": "Submission approved and opportunity created."})

    except Exception as e:
        logger.error("Error approving submission %d: %s", submission_id, str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@admin_bp.route("/api/admin/submissions/<int:submission_id>/reject", methods=["POST"])
@admin_required
def reject_submission(submission_id: int):
    """
    Reject a pending submission.
    Body (optional): { "reason": "Duplicate listing" }
    """
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip() or None

    try:
        supabase = get_service_client()
        now = datetime.now(timezone.utc).isoformat()

        result = (
            supabase.table("opp_submissions")
            .update({
                "status": "rejected",
                "reviewed_by_user_id": g.user_id,
                "reviewed_at": now,
                "rejection_reason": reason,
            })
            .eq("id", submission_id)
            .eq("status", "pending")
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Submission not found or already reviewed."}), 404

        logger.info(
            "Submission %d rejected by admin %s. Reason: %s",
            submission_id, g.user_id, reason or "none given",
        )

        return jsonify({"message": "Submission rejected."})

    except Exception as e:
        logger.error("Error rejecting submission %d: %s", submission_id, str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@admin_bp.route("/api/admin/opportunities/<int:opp_id>", methods=["DELETE"])
@admin_required
def delete_opportunity(opp_id: int):
    """
    Soft-delete an opportunity (set status to 'rejected').
    Does not hard-delete — preserves student bookmark/application records.
    """
    try:
        supabase = get_service_client()

        result = (
            supabase.table("opp_opportunities")
            .update({"status": "rejected"})
            .eq("id", opp_id)
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Opportunity not found."}), 404

        logger.info("Opportunity %d soft-deleted by admin %s", opp_id, g.user_id)

        return jsonify({"message": "Opportunity removed."})

    except Exception as e:
        logger.error("Error deleting opportunity %d: %s", opp_id, str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500
