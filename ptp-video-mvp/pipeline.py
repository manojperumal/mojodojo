"""Orchestrates the four Gemini passes (transcript, engagement, content,
discussion quality) against one uploaded video and aggregates the results.

Both main.py (CLI) and streamlit_app.py (UI) call the functions in this
module — neither reimplements the pipeline itself.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from gemini_client import FLASH_MODEL, PRO_MODEL, GeminiClient
from schemas import Content, Engagement, FinalReport, Quality, Transcript

PROMPTS_DIR = Path(__file__).parent / "prompts"
DEFAULT_OUTPUT_ROOT = Path(__file__).parent / "outputs"

ProgressFn = Callable[[str], None]


def _noop(_: str) -> None:
    pass


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text()


def make_client() -> GeminiClient:
    return GeminiClient()


def run_pass_a(client: GeminiClient) -> Transcript:
    return client.generate_structured(
        model=FLASH_MODEL,
        system_instruction=load_prompt("transcript"),
        response_schema=Transcript,
    )


def _transcript_as_context(transcript: Transcript) -> str:
    lines = [
        f"[{seg.start_seconds:.1f}-{seg.end_seconds:.1f}] {seg.speaker_label}: {seg.text}"
        for seg in transcript.segments
    ]
    return "Speaker-labeled transcript from Pass A:\n" + "\n".join(lines)


def _content_as_context(content: Content) -> str:
    return "Extracted content (tasks/hazards/controls) from Pass C:\n" + content.model_dump_json(
        indent=2
    )


def run_pass_b(client: GeminiClient, transcript: Transcript) -> Engagement:
    return client.generate_structured(
        model=PRO_MODEL,
        system_instruction=load_prompt("engagement"),
        response_schema=Engagement,
        extra_text_context=_transcript_as_context(transcript),
    )


def run_pass_c(client: GeminiClient, transcript: Transcript) -> Content:
    return client.generate_structured(
        model=PRO_MODEL,
        system_instruction=load_prompt("content_extraction"),
        response_schema=Content,
        extra_text_context=_transcript_as_context(transcript),
    )


def run_pass_d(client: GeminiClient, transcript: Transcript, content: Content) -> Quality:
    context = _transcript_as_context(transcript) + "\n\n" + _content_as_context(content)
    return client.generate_structured(
        model=PRO_MODEL,
        system_instruction=load_prompt("quality_score"),
        response_schema=Quality,
        extra_text_context=context,
    )


def aggregate(
    video_name: str,
    transcript: Transcript,
    engagement: Engagement,
    content: Content,
    quality: Quality,
) -> FinalReport:
    return FinalReport(
        video_name=video_name,
        transcript=transcript,
        engagement=engagement,
        content=content,
        quality=quality,
    )


def _write_json(path: Path, model) -> None:
    path.write_text(model.model_dump_json(indent=2))


def run_pipeline(
    video_path: str | Path,
    output_root: str | Path = DEFAULT_OUTPUT_ROOT,
    client: GeminiClient | None = None,
    on_progress: ProgressFn = _noop,
) -> tuple[FinalReport, Path]:
    """Run all four passes against `video_path` and write outputs under
    `output_root/<video_name>/`. Returns (final_report, output_dir).

    Pass an already-constructed `client` (with the video already uploaded)
    to avoid re-uploading — the Streamlit UI does this to cache the upload
    across reruns.
    """
    video_path = Path(video_path)
    video_name = video_path.stem
    output_dir = Path(output_root) / video_name
    output_dir.mkdir(parents=True, exist_ok=True)

    if client is None:
        client = make_client()
    if client.uploaded_file is None:
        on_progress("Uploading video...")
        client.upload_video(str(video_path))

    on_progress("Transcribing...")
    transcript = run_pass_a(client)
    _write_json(output_dir / "transcript.json", transcript)

    on_progress("Analyzing engagement...")
    engagement = run_pass_b(client, transcript)
    _write_json(output_dir / "engagement.json", engagement)

    on_progress("Extracting hazards & controls...")
    content = run_pass_c(client, transcript)
    _write_json(output_dir / "content.json", content)

    on_progress("Scoring discussion quality...")
    quality = run_pass_d(client, transcript, content)
    _write_json(output_dir / "quality.json", quality)

    on_progress("Aggregating report...")
    final_report = aggregate(video_name, transcript, engagement, content, quality)
    _write_json(output_dir / "final_report.json", final_report)

    from report import render_markdown  # local import: keeps report.py decoupled from pipeline

    markdown = render_markdown(final_report)
    (output_dir / "final_report.md").write_text(markdown)

    return final_report, output_dir


def load_final_report(output_dir: str | Path) -> FinalReport:
    data = json.loads((Path(output_dir) / "final_report.json").read_text())
    return FinalReport.model_validate(data)
