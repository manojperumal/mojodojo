"""Web UI: streamlit run streamlit_app.py

Thin presentation layer over pipeline.py — calls the exact same functions
main.py uses, so whatever's validated on the CLI is what this shows.
"""

from __future__ import annotations

from pathlib import Path

import plotly.graph_objects as go
import streamlit as st

from gemini_client import GeminiClient
from pipeline import DEFAULT_OUTPUT_ROOT, run_pipeline
from schemas import FinalReport

SAMPLE_VIDEOS_DIR = Path(__file__).parent / "sample_videos"
UPLOAD_STAGING_DIR = Path(__file__).parent / "outputs" / "_uploaded"

st.set_page_config(page_title="PTP Video Analysis", layout="wide")


def _sample_videos() -> list[Path]:
    if not SAMPLE_VIDEOS_DIR.exists():
        return []
    return sorted(
        p for p in SAMPLE_VIDEOS_DIR.iterdir() if p.suffix.lower() in (".mp4", ".mov")
    )


def _get_video_to_analyze() -> Path | None:
    """Renders the upload/sample-picker UI and returns the chosen video path, if any."""
    samples = _sample_videos()

    source = st.radio(
        "Video source",
        ["Upload a video", "Run on sample video"] if samples else ["Upload a video"],
        horizontal=True,
    )

    if source == "Run on sample video":
        chosen = st.selectbox("Sample video", samples, format_func=lambda p: p.name)
        return chosen

    uploaded = st.file_uploader("Upload a PTP/toolbox-talk recording", type=["mp4", "mov"])
    if uploaded is None:
        return None

    UPLOAD_STAGING_DIR.mkdir(parents=True, exist_ok=True)
    staged_path = UPLOAD_STAGING_DIR / uploaded.name
    if not staged_path.exists() or staged_path.stat().st_size != uploaded.size:
        staged_path.write_bytes(uploaded.getvalue())
    return staged_path


def _get_or_create_client(video_path: Path) -> GeminiClient:
    """Reuses the uploaded Gemini file across Streamlit reruns (e.g. tab
    switches) instead of re-uploading on every script rerun."""
    cache_key = f"gemini_client::{video_path.name}::{video_path.stat().st_mtime}"
    if st.session_state.get("gemini_client_key") != cache_key:
        client = GeminiClient()
        with st.spinner("Uploading video to Gemini..."):
            client.upload_video(str(video_path))
        st.session_state["gemini_client_key"] = cache_key
        st.session_state["gemini_client"] = client
    return st.session_state["gemini_client"]


def _run_analysis(video_path: Path) -> tuple[FinalReport, Path]:
    client = _get_or_create_client(video_path)

    with st.status("Running analysis...", expanded=True) as status:
        def on_progress(message: str) -> None:
            status.write(message)

        final_report, output_dir = run_pipeline(
            video_path,
            output_root=DEFAULT_OUTPUT_ROOT,
            client=client,
            on_progress=on_progress,
        )
        status.update(label="Analysis complete", state="complete")

    return final_report, output_dir


def _render_engagement_tab(report: FinalReport) -> None:
    eng = report.engagement
    col1, col2 = st.columns([2, 1])

    with col1:
        fig = go.Figure(
            go.Bar(
                x=[p.speaker_label for p in eng.participants],
                y=[p.talk_time_seconds for p in eng.participants],
            )
        )
        fig.update_layout(
            title="Talk time per speaker (seconds)",
            xaxis_title="Speaker",
            yaxis_title="Seconds",
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.metric("Overall engagement score", f"{eng.overall_engagement_score}/10")
        st.metric("Talk-time balance", f"{eng.talk_time_balance_score:.2f}")
        st.caption(eng.overall_engagement_rationale)

    st.subheader("Participants")
    st.dataframe(
        [
            {
                "Speaker": p.speaker_label,
                "Talk time (s)": round(p.talk_time_seconds, 1),
                "Turns": p.turns_taken,
                "Asked a question": p.asked_a_question,
                "Notes": p.visual_engagement_notes,
            }
            for p in eng.participants
        ],
        use_container_width=True,
    )

    if eng.distractions_observed:
        st.subheader("Distractions observed")
        for d in eng.distractions_observed:
            st.write(f"**[{d.timestamp_seconds:.1f}s]** {d.description}")


def _render_content_tab(report: FinalReport) -> None:
    content = report.content

    st.subheader("Tasks discussed")
    st.dataframe(
        [{"Timestamp (s)": t.timestamp_seconds, "Task": t.task} for t in content.tasks_discussed],
        use_container_width=True,
    )

    st.subheader("Hazards & controls")
    for h in content.hazards_identified:
        controls = ", ".join(h.controls_mentioned) if h.controls_mentioned else "none mentioned"
        if h.hazard_control_paired:
            st.success(f"**{h.hazard}** (task: {h.related_task}) — controls: {controls}")
        else:
            st.error(f"**{h.hazard}** (task: {h.related_task}) — NO CONTROL MENTIONED")

    if content.coverage_gaps:
        st.subheader("Coverage gaps")
        for gap in content.coverage_gaps:
            st.warning(gap)


def _render_quality_tab(report: FinalReport) -> None:
    quality = report.quality

    col1, col2 = st.columns([2, 1])
    with col1:
        fig = go.Figure(
            go.Scatterpolar(
                r=[d.score for d in quality.dimensions],
                theta=[d.name for d in quality.dimensions],
                fill="toself",
            )
        )
        fig.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 10])),
            title="Discussion quality dimensions",
        )
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        st.metric("Overall quality score", f"{quality.overall_quality_score:.2f}/10")

    for d in quality.dimensions:
        st.write(f"**{d.name}: {d.score}/10** — {d.rationale}")

    col_s, col_g = st.columns(2)
    with col_s:
        st.subheader("Strengths")
        for s in quality.strengths:
            st.write(f"- {s}")
    with col_g:
        st.subheader("Gaps")
        for g in quality.gaps:
            st.write(f"- {g}")


def _render_transcript_tab(report: FinalReport) -> None:
    st.caption(f"Estimated speaker count: {report.transcript.speaker_count_estimate}")
    for seg in report.transcript.segments:
        st.write(f"**[{seg.start_seconds:.1f}s] {seg.speaker_label}:** {seg.text}")


def main() -> None:
    st.title("PTP Video Analysis")
    st.caption(
        "Upload a pre-task plan / toolbox talk recording to analyze crew engagement, "
        "content coverage, and discussion quality."
    )

    video_path = _get_video_to_analyze()
    if video_path is None:
        return

    st.video(str(video_path))

    if st.button("Analyze", type="primary"):
        st.session_state["final_report"], st.session_state["output_dir"] = _run_analysis(
            video_path
        )

    if "final_report" not in st.session_state:
        return

    report: FinalReport = st.session_state["final_report"]
    output_dir: Path = st.session_state["output_dir"]

    tab_engagement, tab_content, tab_quality, tab_transcript = st.tabs(
        ["Engagement", "Content", "Quality", "Transcript"]
    )
    with tab_engagement:
        _render_engagement_tab(report)
    with tab_content:
        _render_content_tab(report)
    with tab_quality:
        _render_quality_tab(report)
    with tab_transcript:
        _render_transcript_tab(report)

    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        st.download_button(
            "Download final_report.json",
            data=(output_dir / "final_report.json").read_bytes(),
            file_name="final_report.json",
            mime="application/json",
        )
    with col2:
        st.download_button(
            "Download final_report.md",
            data=(output_dir / "final_report.md").read_bytes(),
            file_name="final_report.md",
            mime="text/markdown",
        )


if __name__ == "__main__":
    main()
