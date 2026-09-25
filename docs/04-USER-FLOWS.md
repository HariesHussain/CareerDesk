# 04 — User Flows

## Flow 1: Discover opportunities (anonymous)
Visit homepage → land on Discover → see search bar, filters, sorted opportunity cards
(deadline soonest by default) → apply a filter (e.g. type=HACKATHON, free=true) → results
update → click a card → Opportunity Detail page → click "View Official Opportunity" →
redirected to the organiser's own URL (Unstop/Devpost/etc.) to actually register.

## Flow 2: Register + bookmark
Anonymous student clicks "Save" on a card → redirected to Register/Login if not
authenticated → completes signup (email + password) → redirected back to the opportunity →
clicks Save again → opportunity appears under "My Opportunities" with status "Saved".

## Flow 3: Track an application
Student opens "My Opportunities" → selects an opportunity → changes status from "Saved" to
"Applied" → later updates to "Interview" → later to "Selected" or "Rejected" → status history
reflected on the Dashboard counts.

## Flow 4: Dashboard check-in
Student logs in → Dashboard shows: total saved, total applied, upcoming deadlines (from
bookmarked/applied opportunities only, sorted soonest), and a status breakdown.

## Flow 5: Submit an opportunity Brabble doesn't have
Student clicks "Submit" → fills form (title, organiser, category, description, deadline,
eligibility, mode, location, fee, prize, official URL) → submits → sees "Pending review"
confirmation → submission is NOT publicly visible yet.

## Flow 6: Admin review
Admin logs in → sees pending submissions queue → opens one → approves (becomes a public
opportunity, flagged as user-submitted/source="user") or rejects (with optional reason) →
queue updates.

## Flow 7: Scheduled sync (system flow, no user involved)
Scheduler fires → Brabble fetched → normalized → upserted into SQLite → sync_logs row
written → next Discover page load reflects fresh data (server-side only, no client wait).

## Flow 8: Brabble temporarily unavailable
Scheduled sync fails (5xx/timeout) → sync.py logs the failure to sync_logs, keeps the
previous successful snapshot in the DB untouched → Discover page keeps serving last-known
data with no user-facing error → (optional) admin dashboard surfaces the failed sync.
