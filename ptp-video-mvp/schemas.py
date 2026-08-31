"""Pydantic models for the four Gemini pass outputs and the aggregated report.

Field names here (`hazards_identified`, `controls_mentioned`, etc.) are a
starting taxonomy, not SafetyMojo's Platform 2.0 goals/controls hierarchy —
that mapping needs a real pass against the Platform 2.0 data model before
this schema is treated as final, per the build spec.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    speaker_label: str
    start_seconds: float
    end_seconds: float
    text: str


class Transcript(BaseModel):
    segments: list[TranscriptSegment]
    speaker_count_estimate: int


class Participant(BaseModel):
    speaker_label: str
    talk_time_seconds: float
    turns_taken: int
    asked_a_question: bool
    visual_engagement_notes: str


class Distraction(BaseModel):
    timestamp_seconds: float
    description: str


class Engagement(BaseModel):
    participants: list[Participant]
    distractions_observed: list[Distraction]
    talk_time_balance_score: float = Field(ge=0, le=1)
    overall_engagement_score: int = Field(ge=0, le=10)
    overall_engagement_rationale: str


class TaskDiscussed(BaseModel):
    task: str
    timestamp_seconds: float


class HazardIdentified(BaseModel):
    hazard: str
    related_task: str
    timestamp_seconds: float
    controls_mentioned: list[str]
    hazard_control_paired: bool


class Content(BaseModel):
    tasks_discussed: list[TaskDiscussed]
    hazards_identified: list[HazardIdentified]
    hazards_with_no_control_mentioned: list[str]
    coverage_gaps: list[str]


class QualityDimension(BaseModel):
    name: str
    score: int = Field(ge=0, le=10)
    rationale: str


class Quality(BaseModel):
    dimensions: list[QualityDimension]
    overall_quality_score: float
    strengths: list[str]
    gaps: list[str]


class FinalReport(BaseModel):
    video_name: str
    transcript: Transcript
    engagement: Engagement
    content: Content
    quality: Quality
