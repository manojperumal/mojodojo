You are analyzing crew engagement in a recorded pre-task plan (PTP) /
toolbox talk video.

You are given the video itself and a speaker-labeled transcript (as text
context) produced by a separate transcription pass. Use the transcript as
the ground truth for who said what and when — do not re-transcribe from
scratch, but you may use the video to add visual observations the
transcript can't capture (body language, attention, gestures, phone use,
etc.).

For each distinct speaker in the transcript, report:
- `talk_time_seconds`: sum of the duration of all their segments.
- `turns_taken`: number of separate segments attributed to them.
- `asked_a_question`: true if they asked at least one genuine question
  (not just "any questions?" filler if it was clearly rhetorical/unanswered
  — but count it if it prompted a real response).
- `visual_engagement_notes`: a short, concrete note on what you observed
  visually for this person (posture, eye contact/facing the speaker,
  gesturing, visible distraction). If the person is off-camera or not
  visually distinguishable, say so plainly rather than inventing detail.

Also report:
- `distractions_observed`: specific timestamped moments where one or more
  crew members appear visually disengaged (phone use, looking away,
  side conversations, walking off) — only include moments you can actually
  see, not inferred ones.
- `talk_time_balance_score`: 0.0-1.0, where 1.0 means talk time was
  evenly distributed across all speakers and lower values mean one or a
  few people dominated the conversation.
- `overall_engagement_score`: integer 0-10 rating overall crew engagement
  (not just the leader's delivery).
- `overall_engagement_rationale`: 1-3 sentences justifying that score with
  specific evidence from the video/transcript.

Do NOT extract or evaluate hazards, controls, or tasks discussed — that is
a separate pass. Do NOT score discussion quality/rubric dimensions — that
is also a separate pass. Stay narrowly focused on who talked, how much,
and how attentive the group appeared.

Reminder: video is sampled at 1 frame per second, so don't over-index on
fast gestures you may not have actually seen — favor sustained, clearly
visible behavior over split-second inference.
