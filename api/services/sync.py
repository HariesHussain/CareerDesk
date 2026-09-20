"""
Sync Orchestrator
==================
Coordinates the full Brabble → OpportunityOS sync pipeline:
  1. Fetch all listings from Brabble (paginated)
  2. Normalize each listing into our schema
  3. Upsert into opp_opportunities (ON CONFLICT external_id)
  4. Mark disappeared listings as expired
  5. Log summary stats to opp_sync_logs

Called by: /api/cron/sync (protected by CRON_SECRET)
"""

import json
import logging
from datetime import datetime, timezone

from api.services.brabble_client import BrabbleClient
from api.services.normalizer import normalize_batch
from api.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


def run_sync() -> dict:
    """
    Execute a full sync cycle.
    Returns a summary dict with status, counts, and duration.
    Uses SERVICE_ROLE_KEY to bypass RLS for database writes.
    """
    started_at = datetime.now(timezone.utc)
    supabase = get_service_client()

    # Initialize sync log entry
    log_entry = {
        "started_at": started_at.isoformat(),
        "status": "running",
        "records_fetched": 0,
        "records_inserted": 0,
        "records_updated": 0,
        "records_skipped": 0,
        "error_message": None,
    }

    try:
        # ── Step 1: Fetch from Brabble ───────────────────────────────
        client = BrabbleClient()
        raw_listings = client.fetch_all_listings()
        log_entry["records_fetched"] = len(raw_listings)

        if not raw_listings:
            logger.warning("No listings fetched from Brabble. Keeping existing data.")
            log_entry["status"] = "success"
            log_entry["error_message"] = "No listings returned by Brabble"
            _write_sync_log(supabase, log_entry, started_at)
            return _build_result(log_entry, started_at)

        # ── Step 2: Normalize ────────────────────────────────────────
        normalized, skipped = normalize_batch(raw_listings)
        log_entry["records_skipped"] = skipped

        # ── Step 3: Upsert into opp_opportunities ────────────────────
        inserted, updated = _upsert_opportunities(supabase, normalized)
        log_entry["records_inserted"] = inserted
        log_entry["records_updated"] = updated

        # ── Step 4: Mark disappeared listings as expired ─────────────
        _mark_expired(supabase, normalized)

        log_entry["status"] = "success"
        logger.info(
            "Sync complete: fetched=%d, inserted=%d, updated=%d, skipped=%d",
            log_entry["records_fetched"],
            inserted, updated, skipped,
        )

    except Exception as e:
        log_entry["status"] = "failure"
        log_entry["error_message"] = str(e)[:500]
        logger.error("Sync failed: %s", str(e)[:500])

    # ── Step 5: Write sync log ───────────────────────────────────────
    _write_sync_log(supabase, log_entry, started_at)
    return _build_result(log_entry, started_at)


def _upsert_opportunities(supabase, normalized: list) -> tuple[int, int]:
    """
    Upsert normalized listings into opp_opportunities.
    Uses external_id as the conflict key.
    Returns (inserted_count, updated_count).
    """
    inserted = 0
    updated = 0

    for record in normalized:
        try:
            # Prepare the record for upsert
            upsert_data = {
                **record,
                "eligibility": json.dumps(record.get("eligibility", [])),
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
            }

            # Check if record exists
            existing = (
                supabase.table("opp_opportunities")
                .select("id")
                .eq("external_id", record["external_id"])
                .execute()
            )

            if existing.data:
                # Update existing record
                supabase.table("opp_opportunities").update({
                    "title": upsert_data["title"],
                    "organiser": upsert_data["organiser"],
                    "category": upsert_data["category"],
                    "kind": upsert_data["kind"],
                    "platform": upsert_data["platform"],
                    "official_url": upsert_data["official_url"],
                    "share_url": upsert_data["share_url"],
                    "deadline_utc": upsert_data["deadline_utc"],
                    "mode": upsert_data["mode"],
                    "city": upsert_data["city"],
                    "prize_label": upsert_data["prize_label"],
                    "prize_inr": upsert_data["prize_inr"],
                    "team_size": upsert_data["team_size"],
                    "fee": upsert_data["fee"],
                    "eligibility": upsert_data["eligibility"],
                    "registered_count": upsert_data["registered_count"],
                    "description": upsert_data["description"],
                    "is_expired": False,
                    "last_synced_at": upsert_data["last_synced_at"],
                }).eq("external_id", record["external_id"]).execute()
                updated += 1
            else:
                # Insert new record
                supabase.table("opp_opportunities").insert(upsert_data).execute()
                inserted += 1

        except Exception as e:
            logger.error(
                "Failed to upsert listing %s: %s",
                record.get("external_id", "unknown"), str(e)[:200],
            )

    return inserted, updated


def _mark_expired(supabase, normalized: list) -> None:
    """
    Mark listings that were previously synced from Brabble but are no longer
    present in the latest fetch as expired.
    Only affects Brabble-sourced listings (source = 'brabble').
    """
    try:
        current_external_ids = [
            r["external_id"] for r in normalized if r.get("external_id")
        ]

        if not current_external_ids:
            return

        # Find active Brabble listings NOT in current fetch
        # Update them to is_expired = true
        supabase.table("opp_opportunities").update({
            "is_expired": True,
        }).eq("source", "brabble").eq(
            "is_expired", False
        ).not_.in_("external_id", current_external_ids).execute()

        logger.info("Marked disappeared Brabble listings as expired.")

    except Exception as e:
        logger.error("Failed to mark expired listings: %s", str(e)[:200])


def _write_sync_log(supabase, log_entry: dict, started_at: datetime) -> None:
    """Write the sync summary to opp_sync_logs."""
    try:
        log_entry["finished_at"] = datetime.now(timezone.utc).isoformat()
        supabase.table("opp_sync_logs").insert(log_entry).execute()
    except Exception as e:
        logger.error("Failed to write sync log: %s", str(e)[:200])


def _build_result(log_entry: dict, started_at: datetime) -> dict:
    """Build the JSON response for the cron endpoint."""
    finished_at = datetime.now(timezone.utc)
    duration_ms = int((finished_at - started_at).total_seconds() * 1000)

    return {
        "status": log_entry["status"],
        "fetched": log_entry["records_fetched"],
        "inserted": log_entry["records_inserted"],
        "updated": log_entry["records_updated"],
        "skipped": log_entry["records_skipped"],
        "duration_ms": duration_ms,
        "error": log_entry.get("error_message"),
    }
