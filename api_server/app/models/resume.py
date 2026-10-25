from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from pydantic import BaseModel, Field, ConfigDict

class ResumeAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Analysis of the resume
    # Intent agent
    target_role: str
    seniority_level: str
    industry: str
    priority_goals: List[str]
    focus_areas: List[str]
    top_keywords: List[str]
    optimization_strategy: dict
    # Analyzer agent
    sections: List[str]
    years_exp: int
    emails: List[str]
    phone_numbers: List[str]
    hard_skills: List[str]
    soft_skills: List[str]
    missing_hard_skills: Optional[List[str]]
    matching_hard_skills_score: Optional[float]
    missing_soft_skills: Optional[List[str]]
    matching_soft_skills_score: Optional[float]
    # ATS agent
    resume_score: float
    section_score: float
    experience_projects_score: float
    skills_quality_score: float
    summary_quality_score: float
    formatting_score: float
    ats_score: Optional[float]
    hard_skills_score: Optional[float]
    soft_skills_score: Optional[float]
    # Optimizer agent
    section_order: List[str] = Field(default_factory=list)
    optimized_sections: Optional[dict] = None
    keywords_integrated: List[str] = Field(default_factory=list)
    changes_made: List[str] = Field(default_factory=list)
    suggested_additions_if_true: List[str] = Field(default_factory=list)
    optimization_notes: str = ""
    # Finalizer agent
    summary: str
    skills_feedback: str
    experience_feedback: str
    structure_feedback: str
    simple_suggestions: List[str]
    # Premium finalizer extras (empty/default for free tier)
    strength_highlights: List[str] = Field(default_factory=list)
    growth_opportunities: List[str] = Field(default_factory=list)
    jd_fit_analysis: str = ""
    certifications_feedback: str = ""
    languages_feedback: str = ""
    professional_links_feedback: str = ""
    optimizer_review: str = ""
    interview_talking_points: List[str] = Field(default_factory=list)
    priority_action_plan: List[str] = Field(default_factory=list)
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
    storage_path: Optional[str] = None
    content_sha256: Optional[str] = None
    analysis: ResumeAnalysis
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResumeForJobRecommendation(BaseModel):
    user_id: int
    # Latest analysis of the resume
    resume_id: str
    version: int = 1
    full_combined_text: str