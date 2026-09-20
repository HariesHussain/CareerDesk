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
        _mark_expired(supabase, started_at)

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


BATCH_SIZE = 100


def _upsert_opportunities(supabase, normalized: list) -> tuple[int, int]:
    """
    Batch upsert normalized listings into opp_opportunities using PostgREST's native
    upsert(batch, on_conflict="external_id").
    Runs in ~2 seconds for ~1,000 listings instead of minutes.
    """
    if not normalized:
        return 0, 0

    now_iso = datetime.now(timezone.utc).isoformat()
    prepared_records = []
    for record in normalized:
        prepared_records.append({
            **record,
            "eligibility": record.get("eligibility", []) or [],
            "last_synced_at": now_iso,
        })

    # Get count before upsert to determine inserted vs updated
    initial_count = 0
    try:
        count_res = supabase.table("opp_opportunities").select("id", count="exact", head=True).execute()
        initial_count = count_res.count or 0
    except Exception as e:
        logger.warning("Could not fetch initial opp count: %s", e)

    successful_upserts = 0
    # Process in batches
    for i in range(0, len(prepared_records), BATCH_SIZE):
        batch = prepared_records[i:i + BATCH_SIZE]
        try:
            supabase.table("opp_opportunities").upsert(
                batch,
                on_conflict="external_id"
            ).execute()
            successful_upserts += len(batch)
        except Exception as e:
            logger.error(
                "Batch upsert failed for items %d-%d: %s. Falling back to single-item retry.",
                i, i + len(batch), str(e)[:200],
            )
            # Fallback to individual items if a single batch encounters an issue
            for item in batch:
                try:
                    supabase.table("opp_opportunities").upsert(
                        [item],
                        on_conflict="external_id"
                    ).execute()
                    successful_upserts += 1
                except Exception as item_err:
                    logger.error(
                        "Failed to upsert item %s: %s",
                        item.get("external_id"), str(item_err)[:200],
                    )

    # Calculate inserted vs updated
    final_count = initial_count
    try:
        final_count_res = supabase.table("opp_opportunities").select("id", count="exact", head=True).execute()
        final_count = final_count_res.count or initial_count
    except Exception as e:
        logger.warning("Could not fetch final opp count: %s", e)

    inserted = max(0, final_count - initial_count)
    updated = max(0, successful_upserts - inserted)

    return inserted, updated


def _mark_expired(supabase, started_at: datetime) -> None:
    """
    Mark listings that were previously synced from Brabble but were not refreshed
    in this sync run as expired.
    Uses last_synced_at < started_at to avoid URL length limits.
    """
    try:
        res = (
            supabase.table("opp_opportunities")
            .update({"is_expired": True})
            .eq("source", "brabble")
            .eq("is_expired", False)
            .lt("last_synced_at", started_at.isoformat())
            .execute()
        )
        expired_count = len(res.data) if res.data else 0
        if expired_count > 0:
            logger.info("Marked %d disappeared Brabble listings as expired.", expired_count)
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
