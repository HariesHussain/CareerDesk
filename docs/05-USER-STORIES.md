# 05 — User Stories

## Student (primary)
- As a student, I want to browse currently-open hackathons so I don't waste time on
  expired listings.
- As a student, I want to search by keyword (e.g. "AI", "web dev") so I can find relevant
  opportunities fast.
- As a student, I want to filter by mode (online/offline), city, fee, and type so results
  match what I can actually attend.
- As a student, I want to sort by deadline so the most urgent ones are up top.
- As a student, I want to see eligibility and team size before clicking through, so I don't
  waste a click on something I can't join.
- As a student, I want a single "View Official Opportunity" button that takes me straight
  to the real registration page.
- As a student, I want to save opportunities I'm interested in so I can find them again.
- As a student, I want to track my application status (Applied, Interview, etc.) so I
  remember where I stand across many opportunities.
- As a student, I want a dashboard that tells me what's due soon across everything I've
  saved, so I don't miss a deadline.
- As a student, I want to submit an opportunity I found elsewhere that isn't listed yet.

## Admin
- As an admin, I want a queue of pending submissions so I can review them one at a time.
- As an admin, I want to approve, reject, or edit a submission before it goes public.
- As an admin, I want to delete an opportunity that's stale, wrong, or spam.
- As an admin, I want a basic view of sync health (last sync time, success/failure, counts)
  so I know if Brabble data is fresh.

## System (non-human "stories" framed as requirements)
- As the sync job, I must never exceed Brabble's daily rate limit.
- As the normalization layer, I must never silently invent a value Brabble didn't provide.
- As the backend, I must never expose the Brabble API key to any client response.
