# Decision log

Decisions are referenced against PRD v0.1 IDs (FR-, NFR-, OQ-).

## Decided (2026-11-09)

| # | Decision | PRD ref | Notes |
|---|---|---|---|
| D-1 | **V1 data in: CSV + manual entry + P6 file import** (XER/XML upload, one-way, no live sync) | FR-15, §11, §12, OQ-3 | Changes the PRD: P6 file import moves from Phase 2 to V1. Procore stays Phase 2. |
| D-2 | **Stack matches Pre-qual:** React + Vite + Tailwind, Express/Node API, Supabase (Postgres, auth, RLS) | — | Separate Supabase project and separate brand (§11, Q8). |
| D-3 | **Tasks are children of Activities.** Commitments and PPC are per task; readiness rolls up to the activity. | §5, FR-08, FR-09 | |
| D-4 | **No pilot yet.** Build with a sample data center project based on Appendix A, plus L2–L3 templates for UPS, switchgear, generators, CRAH/CHW and fire alarm. | OQ-2, FR-15, §9 | |

## Working assumptions (change any of these)

| # | Assumption | PRD ref |
|---|---|---|
| A-1 | The work week is Monday to Friday by default. Each project can set a 6- or 7-day week. The plan rolls forward on Monday in the project's time zone. | §8 |
| A-2 | **AT RISK rules:** the activity has a linked constraint that (a) has no owner or no needed-by date, (b) has a promised date later than its needed-by date, (c) is still open after its needed-by date, or (d) is linked to equipment whose promised delivery is later than its required-on-site date. | §6, FR-07 |
| A-3 | An open constraint becomes **Missed** automatically the day after its needed-by date and asks for a variance reason. | §8 |
| A-4 | Only the super can override readiness. Every override needs a note and is written to the audit log. | §6, FR-14, NFR-03 |
| A-5 | Each foreman gets a signed confirm link (no account), scoped to their trade's tasks for that week. It expires after 14 days and can be revoked. | FR-08 |
| A-6 | Email goes out over SMTP through nodemailer, as in Pre-qual. | FR-05 |
| A-7 | Escalations run once a day at 6:00 project-local time. | FR-05 |
| A-8 | The app uses the working name "Lookahead" until OQ-5 (name and brand) is decided. | OQ-5 |
| A-9 | V1 assumes connectivity; the app shows an "online required" notice. | NFR-04, OQ-4 |

## Still open (from PRD)

OQ-1 buyer/pricing · OQ-2 pilot · OQ-4 offline · OQ-5 name/brand · OQ-6 success targets. None of these block the V1 build.
