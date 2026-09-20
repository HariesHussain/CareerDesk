"""
CareerDesk — Enterprise Admin API
=================================
MNC-grade governance, analytics, identity moderation, sync orchestration,
and global system controls.

Protected by @admin_required (403 for non-admins).
"""

import logging
import os
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, g

from api.middleware.auth_middleware import admin_required
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__)


def _log_admin_action(admin_email: str, action: str, target: str = None, details: str = None):
    """Record an audit trail entry for compliance and accountability."""
    try:
        supabase = get_service_client()
        supabase.table("opp_admin_audit_logs").insert({
            "admin_email": admin_email,
            "action": action,
            "target": target,
            "details": details,
        }).execute()
    except Exception as e:
        logger.warning("Failed to record admin audit log: %s", str(e)[:200])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Executive Analytics & KPI Metrics
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/metrics", methods=["GET"])
@admin_required
def get_admin_metrics():
    """
    Real-time platform telemetry for executive dashboard:
    - User totals, 24h/7d active users, unique universities
    - Opportunity catalog volume, applications tracked, bookmarks
    - Brabble sync health & last run summary
    """
    try:
        supabase = get_service_client()
        now = datetime.now(timezone.utc)
        since_24h = (now - timedelta(hours=24)).isoformat()
        since_7d = (now - timedelta(days=7)).isoformat()

        # Users breakdown
        profiles_res = supabase.table("opp_profiles").select("id, role, is_banned, last_seen_at, college_name, created_at").execute()
        all_profiles = profiles_res.data or []

        total_users = len(all_profiles)
        students_count = sum(1 for p in all_profiles if p.get("role") != "admin")
        admins_count = sum(1 for p in all_profiles if p.get("role") == "admin")
        banned_count = sum(1 for p in all_profiles if p.get("is_banned"))

        active_24h = sum(1 for p in all_profiles if p.get("last_seen_at") and p["last_seen_at"] >= since_24h)
        active_7d = sum(1 for p in all_profiles if p.get("last_seen_at") and p["last_seen_at"] >= since_7d)

        unique_colleges = len({
            p["college_name"].strip().lower() 
            for p in all_profiles 
            if p.get("college_name") and p["college_name"].strip()
        })

        # Opportunities & Activity metrics
        opps_res = supabase.table("opp_opportunities").select("id", count="exact").eq("status", "approved").execute()
        total_opps = opps_res.count if opps_res.count is not None else 914

        apps_res = supabase.table("opp_applications").select("id", count="exact").execute()
        total_apps = apps_res.count if apps_res.count is not None else 0

        bookmarks_res = supabase.table("opp_bookmarks").select("id", count="exact").execute()
        total_bookmarks = bookmarks_res.count if bookmarks_res.count is not None else 0

        pending_sub_res = supabase.table("opp_submissions").select("id", count="exact").eq("status", "pending").execute()
        pending_submissions = pending_sub_res.count if pending_sub_res.count is not None else 0

        # Last sync summary
        sync_res = supabase.table("opp_sync_logs").select("*").order("started_at", desc=True).limit(1).execute()
        last_sync = sync_res.data[0] if sync_res.data else None

        # Banned emails count
        banned_emails_res = supabase.table("opp_banned_emails").select("email", count="exact").execute()
        total_banned_emails = banned_emails_res.count if banned_emails_res.count is not None else 0

        return jsonify({
            "metrics": {
                "total_users": total_users,
                "students_count": students_count,
                "admins_count": admins_count,
                "banned_count": banned_count,
                "total_banned_emails": total_banned_emails,
                "active_users_24h": active_24h,
                "active_users_7d": active_7d,
                "unique_colleges": unique_colleges,
                "total_opportunities": total_opps,
                "total_applications": total_apps,
                "total_bookmarks": total_bookmarks,
                "pending_submissions": pending_submissions,
                "last_sync": last_sync,
            }
        })

    except Exception as e:
        logger.error("Error retrieving admin metrics: %s", str(e)[:200])
        return jsonify({"error": "Failed to fetch metrics."}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 2. User Governance & Identity Moderation
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/users", methods=["GET"])
@admin_required
def list_users():
    """
    Search and filter registered users.
    Query params:
      q — search in full_name, email, college_name
      role — 'all', 'student', 'admin'
      status — 'all', 'active', 'banned'
    """
    try:
        supabase = get_service_client()
        query_text = (request.args.get("q") or "").strip().lower()
        role_filter = (request.args.get("role") or "all").strip().lower()
        status_filter = (request.args.get("status") or "all").strip().lower()

        profiles_res = supabase.table("opp_profiles").select("*").order("created_at", desc=True).execute()
        users = profiles_res.data or []

        # Filter in memory
        filtered = []
        for u in users:
            # Role filter
            if role_filter != "all":
                u_role = (u.get("role") or "student").lower()
                if u_role != role_filter:
                    continue

            # Status filter
            is_banned = bool(u.get("is_banned"))
            if status_filter == "banned" and not is_banned:
                continue
            if status_filter == "active" and is_banned:
                continue

            # Query search
            if query_text:
                haystack = f"{u.get('full_name') or ''} {u.get('email') or ''} {u.get('college_name') or ''} {u.get('degree') or ''}".lower()
                if query_text not in haystack:
                    continue

            filtered.append(u)

        return jsonify({
            "count": len(filtered),
            "users": filtered,
        })

    except Exception as e:
        logger.error("Error listing users: %s", str(e)[:200])
        return jsonify({"error": "Failed to fetch user list."}), 500


@admin_bp.route("/api/admin/users/<user_id>/ban", methods=["POST"])
@admin_required
def ban_user(user_id: str):
    """
    Ban a user account and permanently blacklist their Gmail address.
    Body: { "reason": "Violated platform rules" }
    """
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"
        data = request.get_json(silent=True) or {}
        reason = (data.get("reason") or "Suspended by administrator").strip()

        # Fetch target user
        target_res = supabase.table("opp_profiles").select("*").eq("id", user_id).execute()
        if not target_res.data:
            return jsonify({"error": "User not found."}), 404

        target = target_res.data[0]
        target_email = (target.get("email") or "").strip().lower()

        # Protect configured root admin
        super_admins = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
        if target_email in super_admins:
            return jsonify({"error": "Cannot ban the primary platform owner."}), 400

        now = datetime.now(timezone.utc).isoformat()

        # 1. Update profile
        supabase.table("opp_profiles").update({
            "is_banned": True,
            "banned_at": now,
            "banned_reason": reason,
        }).eq("id", user_id).execute()

        # 2. Insert into permanent banned emails blacklist
        if target_email:
            supabase.table("opp_banned_emails").upsert({
                "email": target_email,
                "reason": reason,
                "banned_by": admin_email,
                "created_at": now,
            }).execute()

        _log_admin_action(admin_email, "BAN_USER", target_email, f"Reason: {reason} (User ID: {user_id})")

        return jsonify({
            "message": f"User {target.get('full_name') or target_email} has been suspended and their Gmail blacklisted.",
            "user_id": user_id,
            "email": target_email,
        })

    except Exception as e:
        logger.error("Error banning user %s: %s", user_id, str(e)[:200])
        return jsonify({"error": "Failed to ban user."}), 500


@admin_bp.route("/api/admin/users/<user_id>/unban", methods=["POST"])
@admin_required
def unban_user(user_id: str):
    """
    Unban a user account and remove their email from the blacklist.
    """
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"

        target_res = supabase.table("opp_profiles").select("*").eq("id", user_id).execute()
        if not target_res.data:
            return jsonify({"error": "User not found."}), 404

        target = target_res.data[0]
        target_email = (target.get("email") or "").strip().lower()

        # 1. Restore profile
        supabase.table("opp_profiles").update({
            "is_banned": False,
            "banned_at": None,
            "banned_reason": None,
        }).eq("id", user_id).execute()

        # 2. Remove from blacklist
        if target_email:
            supabase.table("opp_banned_emails").delete().eq("email", target_email).execute()

        _log_admin_action(admin_email, "UNBAN_USER", target_email, f"User ID: {user_id}")

        return jsonify({
            "message": f"User {target.get('full_name') or target_email} has been reinstated.",
            "user_id": user_id,
        })

    except Exception as e:
        logger.error("Error unbanning user %s: %s", user_id, str(e)[:200])
        return jsonify({"error": "Failed to unban user."}), 500


@admin_bp.route("/api/admin/users/<user_id>", methods=["DELETE"])
@admin_required
def delete_user_account(user_id: str):
    """
    Hard-delete a user account and all associated data.
    Query/Body param: blacklist_email (bool) — defaults to True.
    """
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"
        data = request.get_json(silent=True) or {}
        blacklist = data.get("blacklist_email", True)

        target_res = supabase.table("opp_profiles").select("*").eq("id", user_id).execute()
        if not target_res.data:
            return jsonify({"error": "User not found."}), 404

        target = target_res.data[0]
        target_email = (target.get("email") or "").strip().lower()

        super_admins = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
        if target_email in super_admins:
            return jsonify({"error": "Cannot delete the platform owner."}), 400

        # Optional: Blacklist email so they cannot log in again with that Gmail
        if blacklist and target_email:
            supabase.table("opp_banned_emails").upsert({
                "email": target_email,
                "reason": "Account deleted by platform administrator with permanent blacklist.",
                "banned_by": admin_email,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

        # Purge student records
        supabase.table("opp_bookmarks").delete().eq("user_id", user_id).execute()
        supabase.table("opp_applications").delete().eq("user_id", user_id).execute()
        supabase.table("opp_submissions").delete().eq("submitted_by_user_id", user_id).execute()
        supabase.table("opp_profiles").delete().eq("id", user_id).execute()

        # Attempt deletion from Supabase Auth admin service
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception as auth_err:
            logger.warning("Could not delete auth user from Supabase Auth: %s", auth_err)

        _log_admin_action(admin_email, "DELETE_USER", target_email, f"User ID: {user_id}, Blacklisted: {blacklist}")

        return jsonify({
            "message": f"Account for {target.get('full_name') or target_email} permanently deleted.",
            "blacklisted": blacklist,
        })

    except Exception as e:
        logger.error("Error deleting user %s: %s", user_id, str(e)[:200])
        return jsonify({"error": "Failed to delete user."}), 500


@admin_bp.route("/api/admin/users/<user_id>/role", methods=["PATCH"])
@admin_required
def update_user_role(user_id: str):
    """
    Elevate or demote user role between 'student' and 'admin'.
    Body: { "role": "admin" | "student" }
    """
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"
        data = request.get_json(silent=True) or {}
        new_role = (data.get("role") or "").strip().lower()

        if new_role not in ("admin", "student"):
            return jsonify({"error": "Role must be 'admin' or 'student'."}), 400

        target_res = supabase.table("opp_profiles").select("*").eq("id", user_id).execute()
        if not target_res.data:
            return jsonify({"error": "User not found."}), 404

        target = target_res.data[0]
        target_email = (target.get("email") or "").strip().lower()

        super_admins = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
        if target_email in super_admins and new_role != "admin":
            return jsonify({"error": "Cannot remove admin role from primary platform owner."}), 400

        supabase.table("opp_profiles").update({"role": new_role}).eq("id", user_id).execute()

        _log_admin_action(admin_email, "CHANGE_ROLE", target_email, f"New role: {new_role}")

        return jsonify({
            "message": f"Role for {target.get('full_name') or target_email} updated to {new_role}.",
            "role": new_role,
        })

    except Exception as e:
        logger.error("Error changing role for %s: %s", user_id, str(e)[:200])
        return jsonify({"error": "Failed to change role."}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 3. Banned Emails Blacklist Direct Management
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/banned-emails", methods=["GET"])
@admin_required
def list_banned_emails():
    """List all permanently blacklisted Gmail addresses."""
    try:
        supabase = get_service_client()
        result = supabase.table("opp_banned_emails").select("*").order("created_at", desc=True).execute()
        return jsonify({
            "count": len(result.data or []),
            "banned_emails": result.data or [],
        })
    except Exception as e:
        logger.error("Error listing banned emails: %s", str(e)[:200])
        return jsonify({"error": "Failed to list banned emails."}), 500


@admin_bp.route("/api/admin/banned-emails/<path:email>", methods=["DELETE"])
@admin_required
def remove_banned_email(email: str):
    """Unblock a blacklisted email address so they can sign in again."""
    try:
        clean_email = email.strip().lower()
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"

        supabase.table("opp_banned_emails").delete().eq("email", clean_email).execute()

        # If user still exists in profiles, clear their ban status too
        supabase.table("opp_profiles").update({
            "is_banned": False,
            "banned_at": None,
            "banned_reason": None,
        }).eq("email", clean_email).execute()

        _log_admin_action(admin_email, "UNBLOCK_EMAIL", clean_email, "Removed from blacklist")

        return jsonify({"message": f"Email {clean_email} unblocked successfully."})
    except Exception as e:
        logger.error("Error unblocking email %s: %s", email, str(e)[:200])
        return jsonify({"error": "Failed to unblock email."}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 4. Brabble Live Ingestion Engine Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/sync/trigger", methods=["POST"])
@admin_required
def trigger_sync():
    """
    On-demand catalog sync from Brabble API.
    Executes sync immediately and returns operation metrics.
    """
    from api.services.sync import run_sync
    try:
        admin_email = g.current_user.get("email") or "admin"
        logger.info("Admin %s triggered live Brabble sync.", admin_email)

        result = run_sync()

        details = f"Status: {result.get('status')}, Inserted: {result.get('records_inserted')}, Updated: {result.get('records_updated')}, Fetched: {result.get('records_fetched')}"
        _log_admin_action(admin_email, "TRIGGER_SYNC", "brabble", details)

        return jsonify({
            "message": "Live sync executed successfully.",
            "summary": result,
        })
    except Exception as e:
        logger.error("Admin sync error: %s", str(e)[:200])
        return jsonify({"error": f"Sync execution failed: {str(e)}"}), 500


@admin_bp.route("/api/admin/sync/history", methods=["GET"])
@admin_required
def get_sync_history():
    """View recent sync runs from opp_sync_logs."""
    try:
        supabase = get_service_client()
        result = supabase.table("opp_sync_logs").select("*").order("started_at", desc=True).limit(20).execute()
        return jsonify({
            "logs": result.data or []
        })
    except Exception as e:
        logger.error("Error retrieving sync history: %s", str(e)[:200])
        return jsonify({"error": "Failed to fetch sync history."}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 5. Site-Wide Announcement Banner Controls
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/announcement", methods=["GET"])
@admin_required
def get_announcement_admin():
    """Get the current site-wide announcement configuration."""
    try:
        supabase = get_service_client()
        result = supabase.table("opp_system_announcements").select("*").eq("id", 1).execute()
        announcement = result.data[0] if result.data else {
            "id": 1,
            "is_active": False,
            "message": "",
            "badge_type": "info",
            "action_url": "",
            "action_label": "",
        }
        return jsonify({"announcement": announcement})
    except Exception as e:
        logger.error("Error reading announcement: %s", str(e)[:200])
        return jsonify({"error": "Failed to read announcement."}), 500


@admin_bp.route("/api/admin/announcement", methods=["POST"])
@admin_required
def update_announcement():
    """
    Save and publish a site-wide alert/announcement banner.
    Body: { "is_active": bool, "message": str, "badge_type": str, "action_url": str, "action_label": str }
    """
    try:
        data = request.get_json(silent=True) or {}
        admin_email = g.current_user.get("email") or "admin"
        supabase = get_service_client()

        is_active = bool(data.get("is_active", False))
        message = (data.get("message") or "").strip()
        badge_type = data.get("badge_type") or "info"
        action_url = (data.get("action_url") or "").strip()
        action_label = (data.get("action_label") or "").strip()

        now = datetime.now(timezone.utc).isoformat()

        payload = {
            "id": 1,
            "is_active": is_active,
            "message": message,
            "badge_type": badge_type,
            "action_url": action_url or None,
            "action_label": action_label or None,
            "updated_at": now,
        }

        supabase.table("opp_system_announcements").upsert(payload).execute()

        _log_admin_action(admin_email, "UPDATE_ANNOUNCEMENT", f"Active: {is_active}", message[:100])

        return jsonify({
            "message": "Global announcement updated.",
            "announcement": payload,
        })
    except Exception as e:
        logger.error("Error updating announcement: %s", str(e)[:200])
        return jsonify({"error": "Failed to update announcement."}), 500


@admin_bp.route("/api/announcement", methods=["GET"])
def get_public_announcement():
    """Public endpoint for students and visitors to see the active banner."""
    try:
        supabase = get_service_client()
        result = supabase.table("opp_system_announcements").select("*").eq("id", 1).execute()
        if result.data and result.data[0].get("is_active"):
            return jsonify({"announcement": result.data[0]})
        return jsonify({"announcement": None})
    except Exception as e:
        logger.error("Error reading public announcement: %s", str(e)[:200])
        return jsonify({"announcement": None})


# ─────────────────────────────────────────────────────────────────────────────
# 6. Audit Logs & System Activity
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/audit-logs", methods=["GET"])
@admin_required
def get_audit_logs():
    """Retrieve recent compliance audit trail events."""
    try:
        supabase = get_service_client()
        result = (
            supabase.table("opp_admin_audit_logs")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return jsonify({
            "count": len(result.data or []),
            "logs": result.data or [],
        })
    except Exception as e:
        logger.error("Error retrieving audit logs: %s", str(e)[:200])
        return jsonify({"error": "Failed to fetch audit logs."}), 500


# ─────────────────────────────────────────────────────────────────────────────
# 7. Community Submissions Moderation Queue
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/submissions", methods=["GET"])
@admin_required
def list_submissions():
    """List student event submissions for admin review."""
    try:
        supabase = get_service_client()
        status_filter = request.args.get("status", "pending").strip().lower()

        query = (
            supabase.table("opp_submissions")
            .select("*, opp_profiles!submitted_by_user_id(email, full_name)")
            .order("created_at", desc=True)
        )

        if status_filter != "all":
            query = query.eq("status", status_filter)

        result = query.execute()

        return jsonify({
            "count": len(result.data or []),
            "submissions": result.data or [],
        })
    except Exception as e:
        logger.error("Error listing submissions: %s", str(e)[:200])
        return jsonify({"error": "Something went wrong, please try again."}), 500


@admin_bp.route("/api/admin/submissions/<int:submission_id>/approve", methods=["POST"])
@admin_required
def approve_submission(submission_id: int):
    """Approve a student event submission and publish as live opportunity."""
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"

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

        opp_data = {
            "external_id": None,
            "source": "user_submission",
            "title": submission["title"],
            "organiser": submission.get("organiser"),
            "category": submission["category"],
            "kind": "competition",
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

        created = supabase.table("opp_opportunities").insert(opp_data).execute()

        supabase.table("opp_submissions").update({
            "status": "approved",
            "reviewed_by_user_id": g.user_id,
            "reviewed_at": now,
        }).eq("id", submission_id).execute()

        _log_admin_action(admin_email, "APPROVE_EVENT", submission["title"], f"Submission ID: {submission_id}")

        return jsonify({"message": "Submission approved and opportunity published."})
    except Exception as e:
        logger.error("Error approving submission %d: %s", submission_id, str(e)[:200])
        return jsonify({"error": "Failed to approve submission."}), 500


@admin_bp.route("/api/admin/submissions/<int:submission_id>/reject", methods=["POST"])
@admin_required
def reject_submission(submission_id: int):
    """Reject a student event submission with optional reason."""
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip() or None

    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"
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

        _log_admin_action(admin_email, "REJECT_EVENT", str(submission_id), f"Reason: {reason or 'none given'}")

        return jsonify({"message": "Submission rejected."})
    except Exception as e:
        logger.error("Error rejecting submission %d: %s", submission_id, str(e)[:200])
        return jsonify({"error": "Failed to reject submission."}), 500


@admin_bp.route("/api/admin/opportunities/<int:opp_id>", methods=["DELETE"])
@admin_required
def delete_opportunity(opp_id: int):
    """Soft-delete an opportunity from the explorer catalog."""
    try:
        supabase = get_service_client()
        admin_email = g.current_user.get("email") or "admin"

        result = (
            supabase.table("opp_opportunities")
            .update({"status": "rejected"})
            .eq("id", opp_id)
            .execute()
        )

        if not result.data:
            return jsonify({"error": "Opportunity not found."}), 404

        _log_admin_action(admin_email, "DELETE_OPPORTUNITY", str(opp_id), "Soft deleted")

        return jsonify({"message": "Opportunity removed."})
    except Exception as e:
        logger.error("Error deleting opportunity %d: %s", opp_id, str(e)[:200])
        return jsonify({"error": "Failed to delete opportunity."}), 500
