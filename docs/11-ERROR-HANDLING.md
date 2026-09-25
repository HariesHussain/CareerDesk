# 11 — Error Handling

## Principle
Users see plain language; developers see detail only in server logs. Never leak a stack
trace, file path, or SQL error to the client.

## Standard error response
```
{ "error": "Could not find that opportunity." }
```
HTTP status communicates category (400 bad input, 401 unauthenticated, 403 unauthorized,
404 not found, 429 rate-limited-by-us, 500 unexpected).

## Specific scenarios
| scenario | handling |
|---|---|
| Brabble unreachable during sync | log failure to `sync_logs`, keep serving last-known DB data, no user-facing error |
| Brabble returns 429 | stop syncing until next IST midnight, log it, serve cached data |
| Brabble schema changes unexpectedly (missing field) | normalizer logs the anomaly and skips only that row, doesn't crash the whole sync |
| Invalid opportunity id requested | 404 with plain message |
| Expired external URL (organiser took listing down) | not detectable ahead of time; UI shows the link as normal — this is inherent to any link-out product and is documented as a known limitation, not "fixed" |
| Invalid form data (submission) | 400 with a field-specific message, form re-shown with values preserved |
| Auth failure | 401, generic "Invalid email or password" (not "email not found" — avoid user enumeration) |
| DB unavailable | 500, generic "Something went wrong, please try again" — logged with full detail server-side |
| Network failure client-side (fetch fails) | JS shows an inline retry affordance, not a blank page |

## Logging
Every sync run, every 5xx from our own API, and every failed Brabble call gets a log line
with enough detail to debug (timestamp, endpoint, status, truncated error) — but request
bodies containing passwords are never logged.
