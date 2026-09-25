# 09 — UI/UX Design System

## Character
Editorial, information-dense, trustworthy, "well-designed university product" — not an
AI-SaaS landing page. No gradients, anywhere.

## Palette (starting point — flat colors only)
| token | hex | use |
|---|---|---|
| background | #F7F5EF | page background, warm off-white |
| surface | #FFFFFF | cards |
| primary text | #171717 | headings, titles |
| secondary text | #66635D | metadata (organiser, platform) |
| border | #DDD9D0 | card/section dividers |
| accent | #C85A2E | CTAs, active filters, links — used sparingly |
| success | #287A52 | "Selected", "Approved" |
| warning | #B7791F | "Deadline today" |
| danger | #B33A3A | "Expired", "Rejected" |

## Typography
One primary sans-serif family for everything. Hierarchy built from size/weight/spacing, not
decoration. Optional distinctive serif or display face for the homepage headline only, if
it clearly improves the editorial feel — not mandatory.

## Layout
- Centered content container, generous whitespace, strong grid.
- Desktop: opportunity grid (2–3 columns), persistent filter sidebar.
- Mobile: stacked filters (collapsible), single-column cards, sticky "View Official
  Opportunity" CTA on the detail page.

## Opportunity card (information-first, per spec §27)
```
CATEGORY               (small, uppercase, secondary text)
Title                  (bold, primary text)
Organiser              (secondary text)
Deadline · Mode        (accent-colored if <48h, warning if today, danger if past)
[View Opportunity]  [Save]
```
No decorative imagery. No oversized shadows. One subtle border per card.

## States
- **Loading:** skeleton cards (flat gray blocks matching card shape), not a spinner.
- **Empty:** specific guidance, e.g. "No opportunities match these filters. Try removing
  the deadline filter or searching a broader term." — never a generic "nothing here."
- **Error:** plain-language message + a retry action; no technical detail exposed.

## Deadline display rule
Always resolve `kind` first (see `08-EXTERNAL-API-INTEGRATION.md`), convert stored UTC to
IST, and show something like "20 Sep · 4:00 PM IST" or a relative label ("2 days left",
"Due today", "Expired") — never a raw ISO string, and never a countdown implying more
precision than the data actually has.

## Accessibility
Semantic HTML (`<nav>`, `<main>`, `<button>` not `<div onclick>`), visible focus outlines,
AA contrast minimum against the palette above, labeled form inputs, alt text on any
meaningful image, responsive text sizing (rem-based).

## Anti-patterns explicitly banned (per spec §22/§51)
Purple/blue gradients, glassmorphism, floating blobs, oversized rounded buttons, decorative
hero illustrations, meaningless animation, fake stats/testimonials/logos.
