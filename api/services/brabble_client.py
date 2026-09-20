"""
Brabble API Client
===================
Handles authenticated, paginated fetching from Brabble's listings endpoint.
Implements rate limit tracking, retry with backoff, and IST midnight cutoff.

Endpoint: GET https://brabble.ai/api/listings
Auth: Bearer token + x-api-key header (both sent every request)
Rate limit: 1,000 requests/day per key, resets midnight IST

SECURITY: BRABBLE_API_KEY is loaded from env vars — NEVER hardcoded or sent to browser.
"""

import os
import time
import logging
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger(__name__)

# IST is UTC+5:30
IST = timezone(timedelta(hours=5, minutes=30))

# Safety threshold: stop syncing if remaining requests drop below this
RATE_LIMIT_SAFETY_THRESHOLD = 100

# Retry configuration for 5xx errors
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 2


class BrabbleClient:
    """Authenticated client for the Brabble listings API."""

    BASE_URL = "https://brabble.ai/api/listings"
    PAGE_SIZE = 200  # Max allowed by Brabble

    def __init__(self):
        self.api_key = os.environ.get("BRABBLE_API_KEY")
        if not self.api_key:
            raise RuntimeError("BRABBLE_API_KEY must be set in environment variables.")

        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "Accept": "application/json",
        }
        self.rate_limit_remaining = None
        self._rate_limited_until = None

    def _is_rate_limited(self) -> bool:
        """Check if we're in a rate-limit cooldown period."""
        if self._rate_limited_until is None:
            return False
        now = datetime.now(IST)
        if now >= self._rate_limited_until:
            self._rate_limited_until = None
            return False
        return True

    def _next_ist_midnight(self) -> datetime:
        """Calculate the next midnight IST for rate limit reset."""
        now = datetime.now(IST)
        tomorrow = now.date() + timedelta(days=1)
        return datetime(
            tomorrow.year, tomorrow.month, tomorrow.day,
            tzinfo=IST
        )

    def _update_rate_limit(self, response: requests.Response) -> None:
        """Track rate limit from response headers."""
        remaining = response.headers.get("x-ratelimit-remaining")
        if remaining is not None:
            try:
                self.rate_limit_remaining = int(remaining)
                if self.rate_limit_remaining < RATE_LIMIT_SAFETY_THRESHOLD:
                    logger.warning(
                        "Brabble rate limit low: %d remaining. "
                        "Stopping sync until next IST midnight.",
                        self.rate_limit_remaining,
                    )
                    self._rate_limited_until = self._next_ist_midnight()
            except ValueError:
                pass

    def _fetch_page(self, offset: int = 0, limit: int = PAGE_SIZE, **filters) -> dict:
        """
        Fetch a single page of listings from Brabble.
        Retries with exponential backoff on 5xx errors.
        """
        params = {"limit": limit, "offset": offset}
        # Add optional filters (hub, city, platform, type, mode, free, q)
        for key, value in filters.items():
            if value is not None:
                params[key] = value

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.get(
                    self.BASE_URL,
                    headers=self.headers,
                    params=params,
                    timeout=30,
                )

                self._update_rate_limit(response)

                if response.status_code == 200:
                    return response.json()

                if response.status_code == 429:
                    logger.error(
                        "Brabble rate limit exceeded (429). "
                        "Stopping sync until next IST midnight."
                    )
                    self._rate_limited_until = self._next_ist_midnight()
                    return None

                if response.status_code == 401:
                    logger.error(
                        "Brabble authentication failed (401). "
                        "Check BRABBLE_API_KEY. Masked key suffix: ...%s",
                        self.api_key[-4:] if len(self.api_key) >= 4 else "****",
                    )
                    return None

                if response.status_code == 400:
                    logger.error(
                        "Brabble bad request (400): %s. "
                        "This should never happen in our client — logging as bug.",
                        response.text[:200],
                    )
                    return None

                if response.status_code >= 500:
                    backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                    logger.warning(
                        "Brabble server error %d (attempt %d/%d). "
                        "Retrying in %ds...",
                        response.status_code, attempt + 1, MAX_RETRIES, backoff,
                    )
                    time.sleep(backoff)
                    continue

                # Unexpected status code
                logger.error(
                    "Brabble unexpected status %d: %s",
                    response.status_code, response.text[:200],
                )
                return None

            except requests.exceptions.Timeout:
                backoff = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                logger.warning(
                    "Brabble request timeout (attempt %d/%d). Retrying in %ds...",
                    attempt + 1, MAX_RETRIES, backoff,
                )
                time.sleep(backoff)
                continue

            except requests.exceptions.ConnectionError as e:
                logger.error("Brabble connection error: %s", str(e)[:200])
                return None

        logger.error("Brabble fetch failed after %d retries.", MAX_RETRIES)
        return None

    def fetch_all_listings(self, **filters) -> list:
        """
        Paginate through ALL Brabble listings using limit=200 per page.
        Returns a flat list of raw listing dicts.
        Stops early if rate limited or on any fatal error.
        """
        if self._is_rate_limited():
            logger.warning("Brabble sync skipped — rate limited until IST midnight.")
            return []

        all_listings = []
        offset = 0
        total = None

        while True:
            if self._is_rate_limited():
                logger.warning(
                    "Rate limit hit during pagination. Returning %d listings fetched so far.",
                    len(all_listings),
                )
                break

            data = self._fetch_page(offset=offset, **filters)
            if data is None:
                break

            listings = data.get("listings", [])
            all_listings.extend(listings)

            if total is None:
                total = data.get("total", 0)
                logger.info(
                    "Brabble reports %d total listings. Fetching in pages of %d.",
                    total, self.PAGE_SIZE,
                )

            # Check if we've fetched everything
            offset += len(listings)
            if len(listings) < self.PAGE_SIZE or offset >= (total or 0):
                break

        logger.info("Fetched %d listings from Brabble.", len(all_listings))
        return all_listings
