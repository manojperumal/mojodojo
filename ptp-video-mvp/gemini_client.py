"""Thin wrapper around the google-genai SDK: upload a video once via the
Files API, then run structured-output generation calls against it, with
retry on transient API errors and on responses that don't validate against
the expected pydantic schema.
"""

from __future__ import annotations

import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError
from rich.console import Console

load_dotenv()

console = Console()

FLASH_MODEL = os.environ.get("GEMINI_FLASH_MODEL", "gemini-3.7-flash")
PRO_MODEL = os.environ.get("GEMINI_PRO_MODEL", "gemini-3.1-pro-preview")

_FILE_ACTIVE_POLL_SECONDS = 2
_FILE_ACTIVE_TIMEOUT_SECONDS = 300
_MAX_CALL_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 5


class GeminiClient:
    """One instance per video: holds the uploaded file reference so all
    four passes can reference it without re-uploading."""

    def __init__(self, api_key: str | None = None) -> None:
        api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in."
            )
        self.client = genai.Client(api_key=api_key)
        self.uploaded_file: types.File | None = None

    def upload_video(self, video_path: str) -> types.File:
        """Upload a video via the Files API and block until it's ACTIVE.

        Gemini processes uploaded video asynchronously; calling generate_content
        against a file still in PROCESSING state fails, so we poll.
        """
        console.print(f"[bold cyan]Uploading[/] {video_path} to Gemini Files API...")
        uploaded = self.client.files.upload(file=video_path)

        elapsed = 0
        while uploaded.state and uploaded.state.name == "PROCESSING":
            if elapsed >= _FILE_ACTIVE_TIMEOUT_SECONDS:
                raise TimeoutError(
                    f"Gemini file {uploaded.name} did not become ACTIVE within "
                    f"{_FILE_ACTIVE_TIMEOUT_SECONDS}s"
                )
            time.sleep(_FILE_ACTIVE_POLL_SECONDS)
            elapsed += _FILE_ACTIVE_POLL_SECONDS
            uploaded = self.client.files.get(name=uploaded.name)

        if uploaded.state and uploaded.state.name != "ACTIVE":
            raise RuntimeError(
                f"Gemini file {uploaded.name} ended in state {uploaded.state.name}, "
                "expected ACTIVE"
            )

        console.print(f"[bold green]Upload ready[/] ({uploaded.name})")
        self.uploaded_file = uploaded
        return uploaded

    def generate_structured(
        self,
        *,
        model: str,
        system_instruction: str,
        response_schema: type[BaseModel],
        extra_text_context: str | None = None,
    ) -> BaseModel:
        """Run one generation call against the uploaded video, constrained to
        `response_schema`, and return a validated instance of it.

        Fails loud (raises) after retries are exhausted rather than returning
        a best-effort / partially-parsed result — a silently wrong analysis
        is worse than a crashed pipeline run.
        """
        if self.uploaded_file is None:
            raise RuntimeError("upload_video() must be called before generate_structured()")

        contents: list = [self.uploaded_file]
        if extra_text_context:
            contents.append(extra_text_context)

        last_error: Exception | None = None
        for attempt in range(1, _MAX_CALL_RETRIES + 1):
            try:
                response = self.client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        response_mime_type="application/json",
                        response_schema=response_schema,
                    ),
                )
                if response.parsed is not None:
                    return response.parsed
                return response_schema.model_validate_json(response.text)
            except ValidationError as exc:
                last_error = exc
                console.print(
                    f"[yellow]Attempt {attempt}/{_MAX_CALL_RETRIES}: model output failed "
                    f"schema validation[/]: {exc}"
                )
            except Exception as exc:  # noqa: BLE001 - transient API errors, retry generically
                last_error = exc
                console.print(
                    f"[yellow]Attempt {attempt}/{_MAX_CALL_RETRIES}: Gemini call failed[/]: {exc}"
                )

            if attempt < _MAX_CALL_RETRIES:
                time.sleep(_RETRY_BACKOFF_SECONDS * attempt)

        raise RuntimeError(
            f"Gemini call for {response_schema.__name__} failed after "
            f"{_MAX_CALL_RETRIES} attempts"
        ) from last_error
