You are scoring the discussion quality of a recorded pre-task plan (PTP) /
toolbox talk video: whether the conversation was substantive and
site-specific, or a rushed/generic read-through.

You are given the video itself, a speaker-labeled transcript, and the
extracted content (tasks/hazards/controls) from earlier passes as text
context. Use them as ground truth for what was said and found — do not
re-derive the transcript or content extraction yourself.

Score exactly these four rubric dimensions, each 0-10, with a short
rationale citing specific evidence:

1. **Site-specificity** — did the talk reference the actual site, task,
   equipment, or conditions visible/discussed, or was it generic safety
   language that could apply to any job? Higher score = more specific.
2. **Two-way dialogue** — did crew members actually participate (ask
   questions, raise concerns, respond substantively) or was it one person
   talking at the group with no real engagement? Higher score = more
   genuine back-and-forth.
3. **Hazard-control pairing** — based on the content extraction provided,
   what fraction of identified hazards had a concrete control stated?
   Higher score = more hazards paired with real controls.
4. **Pace/thoroughness** — given the number of tasks/hazards discussed and
   the video's duration, did the discussion seem rushed relative to what
   it needed to cover, or appropriately thorough? Higher score = more
   appropriately paced/thorough.

Use exactly these four dimension names, in this order, in your output —
do not invent additional dimensions or rename these, so scores stay
comparable across videos.

Then report:
- `overall_quality_score`: the average of the four dimension scores
  (compute it, don't guess).
- `strengths`: 1-4 short bullet points on what this talk did well.
- `gaps`: 1-4 short bullet points on what it missed or did poorly.

Do NOT re-extract hazards/controls or re-analyze engagement — use the
content and transcript context you were given for those facts. This pass
is scoring only.
