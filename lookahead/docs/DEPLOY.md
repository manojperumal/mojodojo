# Deploying the Lookahead pilot

Three hosted pieces, about 1–2 hours end to end the first time.

```
 Browser / phone ──► Web app (Vercel, static)          https://<app>.vercel.app
        │
        └────────► API (Render, Node, always on)       https://<api>.onrender.com
                      │   runs migrations on start, hourly escalation scheduler
                      ▼
                   Supabase: Postgres + email sign-in   https://<ref>.supabase.co
                      ▲
 SMTP provider ◄──────┘ (sign-in links from Supabase, escalation + foreman emails from the API)
```

The browser never reads the database directly. The API is the only database client and enforces every role rule.

Files in the repo:

| File | Purpose |
|---|---|
| `render.yaml` (repo root) | Render Blueprint for the API |
| `lookahead/vercel.json` | Vercel build, SPA routing, security headers |
| `lookahead/db/migrations/` | Schema; `002_lock_public_api.sql` closes Supabase's public REST API to these tables |
| `.github/workflows/lookahead-ci.yml` | Typecheck, tests against Postgres, build on every push |
| `lookahead/scripts/smoke.mjs` | Post-deploy checks (`npm run smoke`) |

---

## 0. Decide and gather (before you start)

- [ ] **Pilot super's email.** They'll create the project. Goes in `PROJECT_CREATOR_EMAILS`.
- [ ] **Region** close to the pilot site, used for both Supabase and Render (e.g. US East → Supabase `us-east-1`, Render `virginia`).
- [ ] **Email sending:** an SMTP provider (Postmark, SendGrid, Amazon SES, Resend…) with a **verified sending domain**, and the From address, e.g. `Lookahead <lookahead@getmojo.ai>`.
- [ ] **Web address:** start on the free `*.vercel.app` URL, or have a subdomain ready (e.g. `lookahead.getmojo.ai`) with DNS access.
- [ ] **Plans.** Recommended for a real pilot:
  - Supabase **Pro**: daily backups, and the project never pauses. Free projects pause after about a week without activity and have no backups.
  - Render **Starter**: always on. Free instances sleep, which stops the escalation scheduler.
  - Vercel **Hobby** is fine for the web app.

## 1. Supabase — database and sign-in

1. [ ] Create a project in the chosen region. Save the database password in your password manager.
2. [ ] **Connection string.** Click **Connect** in the project and copy the **Session pooler** string (host `…pooler.supabase.com`, port **5432**). Replace `[YOUR-PASSWORD]`.
   - Use the session pooler, not the "direct connection". Render can't reach the direct host (IPv6 only).
   - Don't add `?sslmode=…`. The server turns on TLS with `DATABASE_SSL=true`.
3. [ ] **API settings**, under Project Settings → API / API Keys. Copy:
   - the **Project URL** → `SUPABASE_URL` (API) and `VITE_SUPABASE_URL` (web)
   - the **anon / publishable key** → `VITE_SUPABASE_ANON_KEY` (web only; it's designed to be public)
   - Optional: the **legacy JWT secret** (Project Settings → JWT Keys) → `SUPABASE_JWT_SECRET`. Leave it empty if the project uses the newer signing keys; the API then verifies tokens against the project's published keys automatically.
4. [ ] **Auth → URL Configuration**
   - Site URL: the web app URL, e.g. `https://lookahead-pilot.vercel.app`
   - Redirect URLs: the same URL plus `/**`. Add `http://localhost:5173/**` too if you want to test sign-in locally.
5. [ ] **Auth → Sign In / Providers:** Email enabled, magic link on. Leave "Allow new users to sign up" **on**: invited people are added in Lookahead first, then get their Supabase login on first sign-in. Uninvited sign-ins see no projects and can't create one (`PROJECT_CREATOR_EMAILS`).
6. [ ] **Auth → Emails → SMTP settings:** enter your SMTP provider. Supabase's built-in sender only allows a handful of emails per hour, which isn't enough for a pilot.
7. [ ] Optional: edit the **Magic Link** email template, e.g. subject "Your Lookahead sign-in link".

> No SQL to run by hand. The API creates and updates the schema on every start, including locking the tables away from Supabase's public REST API.

## 2. Render — the API

1. [ ] In Render, choose **New → Blueprint**, connect GitHub, and pick `manojperumal/mojodojo` on the branch you're deploying (merge to `main` first if you prefer).
2. [ ] Render reads `render.yaml` and creates **lookahead-api**. Check its region matches Supabase.
3. [ ] Fill in the values Render asks for:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Session pooler string from step 1.2 |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_JWT_SECRET` | Legacy secret, or leave empty |
   | `APP_URL` | Web app URL (fill in after step 3 if you don't know it yet) |
   | `PROJECT_CREATOR_EMAILS` | Pilot super's email (comma-separate if more than one) |
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | From your SMTP provider |
   | `EMAIL_FROM` | e.g. `Lookahead <lookahead@getmojo.ai>` |

   Already set by the blueprint: `NODE_ENV=production`, `AUTH_MODE=supabase`, `DATABASE_SSL=true`, the escalation settings, and a generated `CRON_SECRET`.
4. [ ] Deploy. The logs should end with `Lookahead API on …`, after migration lines on the first deploy.
   - If it stops with `[config] …` lines instead, a required variable is missing. The message names it.
5. [ ] Open `https://<api>.onrender.com/api/health` and expect `{"ok":true}`.

## 3. Vercel — the web app

1. [ ] **Add New → Project** → import `manojperumal/mojodojo`.
2. [ ] Set **Root Directory** to `lookahead`. Leave the framework preset as "Other"; `vercel.json` supplies the build and output settings.
3. [ ] Environment variables (Production):

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://<api>.onrender.com` (no trailing slash) |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key |

4. [ ] Deploy and note the URL.
5. [ ] Optional custom domain: add it in Vercel → Domains and create the DNS record it shows.

## 4. Wire it together

- [ ] Render → `APP_URL` = the final web URL (custom domain if you added one). Redeploy. This also locks the API's CORS to that origin.
- [ ] Supabase → Auth → URL Configuration: the Site URL and Redirect URLs match that same URL.

## 5. Smoke test

From a machine with Node and this repo:

```bash
cd lookahead
```
```bash
API_URL=https://<api>.onrender.com APP_URL=https://<app> SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> npm run smoke
```

All checks should pass: API and database up, real sign-in on, dev sign-in not exposed, CORS limited to the app, deep links working, tables not readable through Supabase's public API.

Then by hand:

- [ ] Open the web app, enter the pilot super's email, click the link in the email, and land on **Projects**.
- [ ] Create the pilot project and check you land on **Setup**.
- [ ] Add a second person (yourself, as PM), sign in as them in a private window, and confirm you see the project with PM permissions.
- [ ] Log a constraint owned by the PM. The PM gets the "You own constraint #1" email.
- [ ] Weekly Plan: create a foreman confirm link, open it on a phone, confirm crew, and flag a problem. It appears as **Raised** for the super.
- [ ] Print the board from Chrome on 11x17 / Tabloid landscape.
- [ ] Next morning after 6:00 site time: escalation emails arrive for anything due within 7 days.

## 6. Load the pilot project (with the super)

- [ ] **Setup:** site time zone, work week (5 or 6 days), team and roles, trades with foreman names and emails, areas (buildings, data halls, rooms), systems with their type.
- [ ] **Import → Pre-commissioning template** for each system (UPS, switchgear, generators, CRAH/CHW, fire alarm), anchored on its L2 start date.
- [ ] **Import → P6 file:** the latest XER, with the window set to the next 8–12 weeks. Preview first and check areas and trades map correctly.
- [ ] **Import → CSV:** the equipment list (required-on-site, promised, delivered) and any open RFIs and submittals.
- [ ] Walk the 3-week board with the super, give every constraint an owner and needed-by date, and do the first **Roll forward**.
- [ ] Agree the weekly rhythm (PRD §8): Monday roll forward, mid-week pull session, daily huddle on the This Week screen, Friday Done / Not Done.

## 7. Running the pilot

- **Deploying changes:** `autoDeploy` is off for the API. Push, then click **Manual Deploy** in Render. Vercel deploys on push; use its **Instant Rollback** if needed. Render keeps previous deploys for rollback too.
- **Migrations** run automatically on API start, each inside a transaction. They are additive; don't edit an applied migration file, add a new one.
- **Backups:** Supabase Pro takes daily backups. Before importing a large P6 file, you can also take a manual snapshot (`pg_dump "$DATABASE_URL"`).
- **Escalations** run hourly inside the API, once per project after 6:00 site time, and never send twice. An external cron (or Render Cron Job) can also trigger them:
  ```bash
  curl -X POST https://<api>.onrender.com/api/cron/escalations -H "x-cron-secret: $CRON_SECRET"
  ```
- **Health monitoring:** point an uptime monitor at `/api/health`. It returns 503 if the database is unreachable.
- **Never run `npm run db:seed` against production.** It wipes all data, and it refuses to run when `NODE_ENV=production` unless forced.
- **Offline:** V1 needs a connection (PRD NFR-04, OQ-4). Tell the pilot users, and check trailer Wi-Fi in week 1.

## Environment variables reference

**API (Render)**

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` turns on the startup checks and seed guard |
| `DATABASE_URL` | yes | Supabase session pooler string |
| `DATABASE_SSL` | yes on Supabase | `true` |
| `DATABASE_CA_CERT` | no | Supabase CA (PEM, `\n` escaped) to also verify the database certificate |
| `AUTH_MODE` | yes | `supabase` (startup refuses `dev` in production) |
| `SUPABASE_URL` | yes | Also used to check the token issuer |
| `SUPABASE_JWT_SECRET` | no | Legacy HS256 secret; otherwise the project's published signing keys are used |
| `APP_URL` | yes | Web app origin; used for links in emails and as the CORS origin |
| `CORS_ORIGIN` | no | Override, comma-separated |
| `PROJECT_CREATOR_EMAILS` | recommended | Who may create projects |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | recommended | Without them, emails are only logged |
| `ESCALATIONS_ENABLED`, `ESCALATION_HOUR` | no | Defaults `true`, `6` |
| `CRON_SECRET` | no | Enables `POST /api/cron/escalations` |
| `DATABASE_POOL_MAX` | no | Default 10 |

**Web (Vercel)**: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. They are baked in at build time, so redeploy after changing them.
