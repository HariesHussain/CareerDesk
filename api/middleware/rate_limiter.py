"""
Rate Limiter (In-Memory)
=========================
Simple per-IP rate limiting for auth endpoints to mitigate credential stuffing.
Uses in-memory storage — resets on cold start (acceptable for serverless).

For production at scale, replace with Redis or Upstash rate limiting.
"""

import time
import logging
import functools
from collections import defaultdict

from flask import request, jsonify

logger = logging.getLogger(__name__)

# Store: { ip_address: [(timestamp, ...), ...] }
_request_log = defaultdict(list)


def rate_limit(max_requests: int = 5, window_seconds: int = 60):
    """
    Decorator factory: limits requests per IP address.

    Args:
        max_requests: Maximum allowed requests within the time window.
        window_seconds: Time window in seconds.
    """
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = _get_client_ip()
            now = time.time()

            # Clean old entries outside the window
            _request_log[client_ip] = [
                t for t in _request_log[client_ip]
                if now - t < window_seconds
            ]

            if len(_request_log[client_ip]) >= max_requests:
                logger.warning(
                    "Rate limit exceeded for IP %s on %s",
                    _mask_ip(client_ip), request.path,
                )
                return jsonify({
                    "error": "Too many requests. Please try again later."
                }), 429

            _request_log[client_ip].append(now)
            return f(*args, **kwargs)

        return decorated_function
    return decorator


def _get_client_ip() -> str:
    """
    Extract client IP, respecting X-Forwarded-For for Vercel proxied requests.
    """
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        # X-Forwarded-For can be a comma-separated list; take the first (client) IP
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _mask_ip(ip: str) -> str:
    """Mask IP for logging (never log full client IPs)."""
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.xxx.xxx"
    return "masked"
