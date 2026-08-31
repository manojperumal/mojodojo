# PTP Video Analysis (MVP)

Takes a recorded video of a crew doing a pre-task plan (PTP) / toolbox talk
and produces structured insights across three dimensions: crew engagement,
content coverage (tasks/hazards/controls), and discussion quality. Uses
Gemini's native video+audio understanding — no separate ASR/diarization
service.

## Setup

```bash
cd ptp-video-mvp
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in GEMINI_API_KEY
```

## Run (CLI)

```bash
python main.py path/to/video.mp4
```

Writes `outputs/<video_name>/{transcript,engagement,content,quality,final_report}.json`
and `final_report.md`.

## Run (web UI)

```bash
streamlit run streamlit_app.py
```

Upload a `.mp4`/`.mov`, or drop 1-2 short recordings into `sample_videos/`
and pick "Run on sample video" — useful for a live demo where you don't
want to depend on uploading a large file over conference wifi.

## Design notes

- Four separate Gemini calls per video (transcript → engagement / content →
  quality), not one mega-prompt — each pass has a narrowly-scoped rubric
  and can be iterated on independently. See `pipeline.py` and `prompts/*.md`.
- The video is uploaded once via the Files API and referenced across all
  four passes.
- `streamlit_app.py` calls the exact same `pipeline.py` functions as
  `main.py` — it's a presentation layer, not a second implementation.
- Schema field names in `schemas.py` (hazards/controls) are a starting
  taxonomy. Before this plugs into Platform 2.0, map them onto
  SafetyMojo's existing goals/controls hierarchy.
- Gemini model IDs move fast — `GEMINI_FLASH_MODEL` / `GEMINI_PRO_MODEL`
  in `.env` are overridable if the defaults get deprecated. Check
  https://ai.google.dev/gemini-api/docs/models before a demo.

## Deploy to Railway

This *borrows the hosting pattern* Pre-qual's own server uses (Railway,
subfolder-as-a-service, secrets only in the dashboard) — it does not share
any infrastructure with Pre-qual. This MVP already lives in a separate
GitHub repo (`mojodojo`, not `Pre-qual`) with its own dependencies and no
imports of Pre-qual code. Keep the deploy just as walled off:

1. In the Railway dashboard, create a **brand-new Railway project** for
   this — do not add it as a service inside Pre-qual's existing project.
   Separate project means separate billing, separate env vars, separate
   failure blast radius: a bad deploy or a leaked demo API key here can't
   touch Pre-qual's production service, and vice versa.
2. Point that project's service at this GitHub repo, with **Root
   Directory** set to `ptp-video-mvp`. Railway's Nixpacks builder then
   auto-detects Python from `requirements.txt` and `.python-version`, and
   uses this repo's `Procfile` as the start command — no Dockerfile or
   `railway.json` needed.
3. Add environment variables in that project's own dashboard (Settings →
   Variables) — do not commit a `.env` file, and do not reuse any
   Pre-qual credential (Supabase keys, SMTP, QuickBooks) here; this MVP
   doesn't need any of them:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_FLASH_MODEL` / `GEMINI_PRO_MODEL` (optional overrides)
4. Deploy. Railway assigns its own free `*.up.railway.app` domain,
   independent of Pre-qual's.

**Ephemeral storage is a non-issue in practice:** `outputs/` is local-disk
only (intentionally out of scope to change — see below), and Railway's
filesystem resets on redeploy/restart. But normal usage never depends on
that surviving a restart — a viewer analyzes a video and downloads the
report within one live Streamlit session. `sample_videos/` ships with the
deploy since it's committed to git, so "Run on sample video" is unaffected
either way.

## Known risk

Gemini's speaker diarization on multi-person outdoor construction audio
(wind noise, overlapping speech, PPE-muffled voices) may be noisier than on
clean meeting audio. If Pass A's speaker segmentation is unreliable on real
footage, the documented fallback is to run a dedicated diarization tool
(e.g. Whisper + pyannote) as Pass A instead and feed that transcript into
Gemini for Passes B–D. Not built by default — see the MVP build spec.

## Out of scope for this MVP

No auth, no persistence beyond local files, no batch processing, no
integration into Platform 2.0's live data model, no fine-tuning.
