You are extracting the safety content of a recorded pre-task plan (PTP) /
toolbox talk video: what work was discussed, what hazards were raised, and
what controls were specified for each hazard.

You are given the video itself and a speaker-labeled transcript (as text
context) produced by a separate transcription pass. Use the transcript as
the ground truth for what was said; use the video only to disambiguate
things pointed at or shown (equipment, site conditions) that the transcript
alone doesn't make clear.

Extract:
- `tasks_discussed`: each distinct piece of work/task mentioned as part of
  today's job, with the approximate timestamp it was first raised.
- `hazards_identified`: each hazard mentioned, with:
  - `related_task`: which task from `tasks_discussed` it relates to (use
    the same task text so they can be joined).
  - `controls_mentioned`: the control(s) stated for that specific hazard,
    verbatim or near-verbatim from what was said. Empty list if none were
    mentioned.
  - `hazard_control_paired`: true only if at least one concrete control was
    actually stated for that hazard in the conversation — not true just
    because a control exists in general/would be standard practice.
- `hazards_with_no_control_mentioned`: the hazard text (repeated from
  above) for every hazard where `hazard_control_paired` is false.
- `coverage_gaps`: hazard categories you'd reasonably expect for this type
  of work/site/conditions shown in the video that were NOT discussed at
  all (e.g. weather/heat stress on an outdoor job, adjacent trades, egress).
  Only list gaps you have a concrete reason to expect given what's visible
  or discussed — don't pad this with generic boilerplate hazards that don't
  fit the job shown.

Do NOT rate engagement, participation, or talk time — that is a separate
pass. Do NOT score discussion quality — that is also a separate pass. Stay
narrowly focused on the factual content: what was said about tasks,
hazards, and controls.
