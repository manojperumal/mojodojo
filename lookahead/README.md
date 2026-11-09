# Lookahead

A short-interval lookahead for superintendents on data center pre-commissioning work.
It wins by **clearing constraints**: every constraint gets a named owner, a needed-by date and
escalating visibility until it is cleared. Standalone product (not part of Pre-qual).

Spec: [`docs/PRD-v0.1.pdf`](docs/PRD-v0.1.pdf) · decisions: [`docs/decisions.md`](docs/decisions.md)

## What's in V1

| Screen | PRD |
|---|---|
| **Board**: rolling 3 / 4 / 6-week window by area, system or trade; drag to reschedule; readiness, top constraint, owner, needed-by; stale rows highlighted | FR-01, FR-13 |
| **Activity detail**: dates, crew tasks, predecessors, equipment, constraints, *why this state*, logged super override, history | FR-02, §6, NFR-03 |
| **Constraints**: sortable log and per-person inbox; filters by owner, category, week, overdue; Raised → Open → Promised → Cleared / Missed | FR-03..FR-06 |
| **Weekly Plan**: pull READY tasks into the week, foreman confirm links (no account), Done / Not Done with a variance reason, PPC | FR-08, FR-09 |
| **Foreman link** (`/f/:token`): phone view to confirm crew and flag a problem in two taps | FR-08, FR-10 |
| **This Week**: morning huddle screen for the trailer display | FR-11 |
| **Print**: 11x17 board and constraint log, black-and-white safe | FR-12 |
| **Equipment**: required vs promised vs actual; a slip flags linked work AT RISK and notifies the super | FR-07 |
| **Commissioning**: systems × L1–L5 readiness, energization gates with named-authoriser sign-off | §9 |
| **Metrics**: PPC trend and variance, PPC by trade / area, clearance, RFI cycle time, on-time starts, milestones, plan health. Also the owner's-rep dashboard | §10 |
| **Import**: CSV (activities, equipment, constraints), **P6 XER / PMXML file** (D-1), pre-commissioning templates for UPS, switchgear, generators, CRAH / CHW, fire alarm | FR-15 |
| **Escalations**: owner at 7d and 2d before needed-by, super on the day, PMs at 2d overdue; auto-miss the day after; in-app + email | FR-05 |
| **Roles**: super / PM / field engineer / foreman / CxA / owner viewer, project-scoped | FR-14 |

Readiness (READY / CONSTRAINED / AT RISK) is computed by rules in `shared/src/readiness.ts` and always shows its reasons.
AT RISK means a linked constraint has no owner or date, is overdue or missed, is promised after its needed-by date, or is needed after the work starts; or linked equipment arrives late; or a predecessor finishes on or after this start. L3 work waits for its energization gate.

## Layout

```
shared/   rules engine, metrics, templates, types (used by server and client)
server/   Express API + Postgres (Supabase-compatible), importers, escalation job, seed, tests
client/   React + Vite + Tailwind web app
db/migrations/  SQL schema
```

## Run it locally

Needs Node 20+ and Postgres 14+.

```bash
cd lookahead
npm install
createdb lookahead
cp server/.env.example server/.env      # set DATABASE_URL if not the default
npm run db:seed                          # migrates, then loads the sample data center project (wipes data!)
npm run dev                              # API on :4000, web app on :5173
```

Open http://localhost:5173 and pick a person. Try **Sam Rivera** (super), **Priya Shah** (PM inbox),
**Alex Kim** (CxA gate sign-off) or **Taylor Brooks** (owner viewer). The sample data is dated relative to today.

Tests (they need a `lookahead_test` database):

```bash
createdb lookahead_test
npm test
```

## Deploying on Supabase

1. Create a Supabase project. Set `DATABASE_URL` on the server to its connection string; the server runs migrations on start.
2. Server env: `AUTH_MODE=supabase`, `SUPABASE_URL`, and optionally `SUPABASE_JWT_SECRET`. Set `APP_URL` and the SMTP settings for email.
3. Client env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL` if the API is on another origin.
4. People sign in with an email link. Their first sign-in links them by email to the membership the super created under Setup.

The API is the only thing that talks to the database and enforces the role rules (`server/src/access.ts`), so Supabase row-level security isn't needed for V1.

## Not in V1 (per PRD §11–12)

Procore / live P6 sync, Slack / Teams, offline mode (V1 assumes trailer connectivity), custom constraint categories, portfolio view, document attachments.
