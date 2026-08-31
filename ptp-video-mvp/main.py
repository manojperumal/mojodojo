"""CLI entrypoint: python main.py <video_path>

Runs the full 4-pass pipeline against a single video and writes
outputs/<video_name>/{transcript,engagement,content,quality,final_report}.json
and final_report.md.
"""

from __future__ import annotations

import argparse
import sys

from rich.console import Console

from pipeline import run_pipeline

console = Console()


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze a PTP/toolbox-talk video with Gemini.")
    parser.add_argument("video_path", help="Path to the .mp4/.mov recording to analyze")
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Root output directory (default: ./outputs)",
    )
    args = parser.parse_args()

    kwargs = {}
    if args.output_dir:
        kwargs["output_root"] = args.output_dir

    try:
        final_report, output_dir = run_pipeline(
            args.video_path,
            on_progress=lambda msg: console.print(f"[bold cyan]→[/] {msg}"),
            **kwargs,
        )
    except Exception as exc:  # noqa: BLE001 - top-level CLI error boundary
        console.print(f"[bold red]Pipeline failed:[/] {exc}")
        sys.exit(1)

    console.print(f"\n[bold green]Done.[/] Wrote outputs to {output_dir}/")
    console.print(f"  Overall engagement score: {final_report.engagement.overall_engagement_score}/10")
    console.print(f"  Overall quality score:    {final_report.quality.overall_quality_score:.2f}/10")
    console.print(
        f"  Hazards with no control:  {len(final_report.content.hazards_with_no_control_mentioned)}"
    )
    console.print(f"\nSee {output_dir}/final_report.md for the full summary.")


if __name__ == "__main__":
    main()
