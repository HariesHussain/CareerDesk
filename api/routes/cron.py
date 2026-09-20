"""
Cron Sync Endpoint
===================
GET /api/cron/sync — Triggers Brabble → OpportunityOS sync.
Protected by CRON_SECRET (header or query param).
Called hourly by Vercel Cron.
"""

import os
import logging

from flask import Blueprint, request, jsonify

from api.services.sync import run_sync

logger = logging.getLogger(__name__)

cron_bp = Blueprint("cron", __name__)


@cron_bp.route("/api/cron/sync", methods=["GET"])
def sync():
    """
    Trigger a full Brabble sync.
    Auth: CRON_SECRET via Authorization header or ?token= query param.
    """
    cron_secret = os.environ.get("CRON_SECRET")
    if not cron_secret:
        logger.error("CRON_SECRET not configured in environment variables.")
        return jsonify({"error": "Server configuration error."}), 500

    # Check Authorization header: Bearer <CRON_SECRET>
    auth_header = request.headers.get("Authorization", "")
    token_from_header = ""
    if auth_header.startswith("Bearer "):
        token_from_header = auth_header[7:]

    # Check query param: ?token=<CRON_SECRET>
    token_from_query = request.args.get("token", "")

    if token_from_header != cron_secret and token_from_query != cron_secret:
        logger.warning("Unauthorized sync attempt from %s", request.remote_addr)
        return jsonify({"error": "Unauthorized."}), 401

    logger.info("Authorized sync triggered.")
    result = run_sync()
    return jsonify(result), 200 if result.get("status") == "success" else 500
