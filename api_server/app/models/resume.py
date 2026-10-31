from datetime import datetime, timezone

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field


class ResumeAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Analysis of the resume
    # Intent agent
    target_role: str
    seniority_level: str
    industry: str
    top_keywords: list[str]
    # Analyzer agent
    hard_skills: list[str]
    soft_skills: list[str]
    # ATS agent
    resume_score: float
    section_score: float
    experience_projects_score: float
    skills_quality_score: float
    summary_quality_score: float
    formatting_score: float
    ats_score: float | None
    hard_skills_score: float | None
    soft_skills_score: float | None
    # Optimizer agent
    section_order: list[str] = Field(default_factory=list)
    optimized_sections: dict | None = None
    keywords_integrated: list[str] = Field(default_factory=list)
    changes_made: list[str] = Field(default_factory=list)
    suggested_additions_if_true: list[str] = Field(default_factory=list)
    optimization_notes: str = ""
    # Finalizer agent
    summary: str
    skills_feedback: str
    experience_feedback: str
    structure_feedback: str
    simple_suggestions: list[str]
    # Premium finalizer extras (empty/default for free tier)
    strength_highlights: list[str] = Field(default_factory=list)
    growth_opportunities: list[str] = Field(default_factory=list)
    jd_fit_analysis: str = ""
    certifications_feedback: str = ""
    languages_feedback: str = ""
    professional_links_feedback: str = ""
    optimizer_review: str = ""
    interview_talking_points: list[str] = Field(default_factory=list)
    priority_action_plan: list[str] = Field(default_factory=list)
    recruiter_lens: str = ""
    competitive_positioning: str = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Resume(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    id: ObjectId
    user_id: int
    resume_id: str
    version: int = 1
    filename: str
    storage_path: str | None = None
    content_sha256: str | None = None
    updated_with_optimizer: bool = Field(default=False)
    analysis: ResumeAnalysis
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResumeForJobRecommendation(BaseModel):
    user_id: int
    # Latest analysis of the resume
    resume_id: str
    version: int = 1
    full_combined_text: str
