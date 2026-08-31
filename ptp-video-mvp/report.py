"""Renders a FinalReport into a human-readable Markdown summary."""

from __future__ import annotations

from schemas import FinalReport


def _fmt_seconds(seconds: float) -> str:
    minutes, secs = divmod(int(seconds), 60)
    return f"{minutes}m{secs:02d}s"


def render_markdown(report: FinalReport) -> str:
    lines: list[str] = []
    lines.append(f"# PTP Video Analysis — {report.video_name}")
    lines.append("")

    # Engagement
    lines.append("## Crew Engagement")
    lines.append(
        f"**Overall engagement score:** {report.engagement.overall_engagement_score}/10 "
        f"(talk-time balance: {report.engagement.talk_time_balance_score:.2f})"
    )
    lines.append("")
    lines.append(report.engagement.overall_engagement_rationale)
    lines.append("")
    lines.append("| Speaker | Talk time | Turns | Asked a question | Notes |")
    lines.append("|---|---|---|---|---|")
    for p in report.engagement.participants:
        lines.append(
            f"| {p.speaker_label} | {_fmt_seconds(p.talk_time_seconds)} | {p.turns_taken} | "
            f"{'Yes' if p.asked_a_question else 'No'} | {p.visual_engagement_notes} |"
        )
    if report.engagement.distractions_observed:
        lines.append("")
        lines.append("**Distractions observed:**")
        for d in report.engagement.distractions_observed:
            lines.append(f"- [{_fmt_seconds(d.timestamp_seconds)}] {d.description}")
    lines.append("")

    # Content
    lines.append("## Content Coverage")
    lines.append("### Tasks discussed")
    for t in report.content.tasks_discussed:
        lines.append(f"- [{_fmt_seconds(t.timestamp_seconds)}] {t.task}")
    lines.append("")
    lines.append("### Hazards & controls")
    lines.append("| Hazard | Related task | Controls | Paired? |")
    lines.append("|---|---|---|---|")
    for h in report.content.hazards_identified:
        controls = "; ".join(h.controls_mentioned) if h.controls_mentioned else "_none mentioned_"
        paired = "Yes" if h.hazard_control_paired else "**NO**"
        lines.append(f"| {h.hazard} | {h.related_task} | {controls} | {paired} |")
    if report.content.coverage_gaps:
        lines.append("")
        lines.append("**Coverage gaps:**")
        for gap in report.content.coverage_gaps:
            lines.append(f"- {gap}")
    lines.append("")

    # Quality
    lines.append("## Discussion Quality")
    lines.append(f"**Overall quality score:** {report.quality.overall_quality_score:.2f}/10")
    lines.append("")
    lines.append("| Dimension | Score | Rationale |")
    lines.append("|---|---|---|")
    for d in report.quality.dimensions:
        lines.append(f"| {d.name} | {d.score}/10 | {d.rationale} |")
    lines.append("")
    if report.quality.strengths:
        lines.append("**Strengths:**")
        for s in report.quality.strengths:
            lines.append(f"- {s}")
        lines.append("")
    if report.quality.gaps:
        lines.append("**Gaps:**")
        for g in report.quality.gaps:
            lines.append(f"- {g}")
        lines.append("")

    # Transcript
    lines.append("## Transcript")
    lines.append(f"_Estimated speaker count: {report.transcript.speaker_count_estimate}_")
    lines.append("")
    for seg in report.transcript.segments:
        lines.append(
            f"**[{_fmt_seconds(seg.start_seconds)}] {seg.speaker_label}:** {seg.text}"
        )
    lines.append("")

    return "\n".join(lines)
