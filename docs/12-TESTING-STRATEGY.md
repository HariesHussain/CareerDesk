# 12 — Testing Strategy

## Backend (pytest)
- **Brabble client**: mock HTTP responses (success, 401, 429, 5xx, malformed JSON) and
  assert correct handling — never hit the real Brabble API in automated tests.
- **Normalizer**: given a fixture based on the verified real response in
  `08-EXTERNAL-API-INTEGRATION.md`, assert correct field mapping, especially the
  `kind`-dependent deadline meaning and UTC storage.
- **Database operations**: upsert-by-external_id, dedup, application-history retained
  after an opportunity is marked expired.
- **Opportunity filtering/sorting/search**: unit tests per filter combination against a
  seeded test DB.
- **Authentication**: register/login/logout, password hashing round-trip, wrong-password
  rejection, duplicate-email rejection.
- **Submission workflow**: submit → pending → approve creates public opportunity → reject
  keeps it hidden.
- **Authorization**: non-admin hitting `/api/admin/*` gets 403; unauthenticated hitting
  bookmarks gets 401.

## Frontend (manual + lightweight JS tests where practical)
- Search debouncing actually delays requests.
- Filter combinations update the URL/query and results correctly.
- Bookmark toggle updates UI optimistically and reflects real state on reload.
- Status dropdown updates persist after refresh.
- Form validation blocks submission with missing required fields, shows inline errors.

## Manual QA checklist (per release)
- Full flow: register → browse → save → change status → view dashboard → submit → (as
  admin) approve → confirm it's now public.
- Responsive check at common breakpoints (mobile, tablet, desktop).
- Empty/loading/error states triggered deliberately (e.g. temporarily wrong DB path).

## What we do NOT test
End-to-end tests against the live Brabble API in CI — that would burn real quota and be
flaky; live verification is a manual, occasional step (see `19-TROUBLESHOOTING.md`).
