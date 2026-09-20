"""
Input Validators
=================
Server-side validation for all user-submitted data.
Prevents SQL injection (via parameterized queries at the ORM level),
XSS (URL scheme validation), and spam (field-level checks).

Per docs/10-SECURITY.md:
  - official_url must match https?:// (reject javascript:, data:, vbscript:)
  - Email must be valid format
  - Password must be >= 8 characters
  - All text fields trimmed and length-checked
"""

import re
import logging

logger = logging.getLogger(__name__)

# ── URL Validation ──────────────────────────────────────────────────────
# Only allow http:// and https:// schemes
_URL_PATTERN = re.compile(
    r"^https?://"       # Must start with http:// or https://
    r"[^\s<>\"']+$",    # No whitespace or HTML-breaking characters
    re.IGNORECASE,
)

# Explicitly blocked URL schemes (XSS vectors)
_BLOCKED_SCHEMES = ("javascript:", "data:", "vbscript:", "file:", "ftp:")

# ── Email Validation ────────────────────────────────────────────────────
_EMAIL_PATTERN = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)

# ── Category Allow-list ─────────────────────────────────────────────────
VALID_CATEGORIES = {
    "HACKATHON", "CASE_STUDY", "CONTEST", "CODING",
    "INNOVATION", "DESIGN", "COMPETITION", "QUIZ", "OTHER",
}

VALID_MODES = {"ONLINE", "OFFLINE", "HYBRID"}

VALID_APPLICATION_STATUSES = {
    "Saved", "Interested", "Applied",
    "Shortlisted", "Interview", "Selected", "Rejected",
}

VALID_SORT_OPTIONS = {"deadline", "newest", "alphabetical"}


def validate_url(url: str) -> tuple[bool, str | None]:
    """
    Validate a URL is safe for storage and rendering.
    Returns (is_valid, error_message).
    """
    if not url:
        return False, "URL is required."

    url = url.strip()

    # Check for blocked schemes
    url_lower = url.lower()
    for scheme in _BLOCKED_SCHEMES:
        if url_lower.startswith(scheme):
            logger.warning("Blocked URL scheme detected: %s", scheme)
            return False, f"URL scheme '{scheme}' is not allowed."

    # Must match http/https pattern
    if not _URL_PATTERN.match(url):
        return False, "URL must start with http:// or https://."

    if len(url) > 2048:
        return False, "URL is too long (max 2048 characters)."

    return True, None


def validate_email(email: str) -> tuple[bool, str | None]:
    """Validate email format. Returns (is_valid, error_message)."""
    if not email:
        return False, "Email is required."

    email = email.strip().lower()

    if not _EMAIL_PATTERN.match(email):
        return False, "Please enter a valid email address."

    if len(email) > 254:
        return False, "Email is too long."

    return True, None


def validate_password(password: str) -> tuple[bool, str | None]:
    """Validate password strength. Returns (is_valid, error_message)."""
    if not password:
        return False, "Password is required."

    if len(password) < 8:
        return False, "Password must be at least 8 characters."

    if len(password) > 128:
        return False, "Password is too long (max 128 characters)."

    return True, None


def validate_text(value: str, field_name: str, max_length: int = 1000, required: bool = False) -> tuple[str | None, str | None]:
    """
    Validate and sanitize a text field.
    Returns (sanitized_value, error_message).
    """
    if not value or not value.strip():
        if required:
            return None, f"{field_name} is required."
        return None, None

    value = value.strip()

    if len(value) > max_length:
        return None, f"{field_name} is too long (max {max_length} characters)."

    return value, None


def validate_category(category: str) -> tuple[bool, str | None]:
    """Validate category against allow-list."""
    if not category:
        return False, "Category is required."
    if category.upper() not in VALID_CATEGORIES:
        return False, f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}."
    return True, None


def validate_mode(mode: str) -> tuple[bool, str | None]:
    """Validate mode against allow-list."""
    if not mode:
        return True, None  # Mode is optional
    if mode.upper() not in VALID_MODES:
        return False, f"Invalid mode. Must be one of: {', '.join(sorted(VALID_MODES))}."
    return True, None


def validate_application_status(status: str) -> tuple[bool, str | None]:
    """Validate application pipeline status."""
    if not status:
        return False, "Status is required."
    if status not in VALID_APPLICATION_STATUSES:
        return False, f"Invalid status. Must be one of: {', '.join(sorted(VALID_APPLICATION_STATUSES))}."
    return True, None
