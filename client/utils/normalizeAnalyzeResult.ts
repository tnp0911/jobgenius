import type {
  FreeAnalyzeResult,
  PremiumAnalyzeResult,
} from "@/services/resumeService";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function pick(raw: Record<string, unknown>, key: string): unknown {
  return raw[key];
}

/**
 * API / Redis / Mongo analysis payloads are often flat ResumeAnalysis dumps.
 * AnalyzerResults expects nested intent / analyzer / ats / feedback / optimizer.
 */
export function normalizeAnalyzeResult(
  raw: Record<string, unknown> | FreeAnalyzeResult | PremiumAnalyzeResult,
): FreeAnalyzeResult | PremiumAnalyzeResult {
  const source = asRecord(raw);
  const nestedIntent = asRecord(source.intent);
  const looksNested =
    Object.keys(nestedIntent).length > 0 ||
    Object.keys(asRecord(source.analyzer)).length > 0 ||
    Object.keys(asRecord(source.ats)).length > 0;

  const resumeFilename =
    asString(source.resume_filename) || null;
  const resumeId = asString(source.resume_id) || undefined;
  const resumeVersionRaw = source.resume_version;
  const resumeVersion =
    typeof resumeVersionRaw === "number"
      ? resumeVersionRaw
      : Number.isFinite(Number(resumeVersionRaw))
        ? Number(resumeVersionRaw)
        : undefined;

  if (looksNested) {
    const nested: FreeAnalyzeResult | PremiumAnalyzeResult = {
      resume_filename: resumeFilename,
      intent: nestedIntent,
      analyzer: asRecord(source.analyzer),
      ats: asRecord(source.ats),
      feedback:
        typeof source.feedback === "string"
          ? source.feedback
          : asRecord(source.feedback),
      ...(resumeId ? { resume_id: resumeId } : {}),
      ...(resumeVersion !== undefined ? { resume_version: resumeVersion } : {}),
    };

    if (
      "optimizer" in source ||
      "job_finder" in source ||
      "rerender" in source
    ) {
      return {
        ...nested,
        optimizer: asRecord(source.optimizer),
        job_finder: source.job_finder ?? null,
        rerender: source.rerender ?? null,
      } as PremiumAnalyzeResult;
    }

    return nested;
  }

  const intent = {
    target_role: asString(pick(source, "target_role")),
    seniority_level: asString(pick(source, "seniority_level")),
    industry: asString(pick(source, "industry")),
    top_keywords: asStringList(pick(source, "top_keywords")),
  };

  const analyzer = {
    hard_skills: asStringList(pick(source, "hard_skills")),
    soft_skills: asStringList(pick(source, "soft_skills")),
    missing_hard_skills: asStringList(pick(source, "missing_hard_skills")),
    missing_soft_skills: asStringList(pick(source, "missing_soft_skills")),
    matching_hard_skills_score: pick(source, "matching_hard_skills_score"),
    matching_soft_skills_score: pick(source, "matching_soft_skills_score"),
    years_exp: pick(source, "years_exp"),
  };

  const ats = {
    resume_score: pick(source, "resume_score"),
    section_score: pick(source, "section_score"),
    experience_projects_score: pick(source, "experience_projects_score"),
    skills_quality_score: pick(source, "skills_quality_score"),
    summary_quality_score: pick(source, "summary_quality_score"),
    formatting_score: pick(source, "formatting_score"),
    ats_score: pick(source, "ats_score"),
    hard_skills_score: pick(source, "hard_skills_score"),
    soft_skills_score: pick(source, "soft_skills_score"),
    certifications_score: pick(source, "certifications_score"),
    languages_score: pick(source, "languages_score"),
    professional_links_score: pick(source, "professional_links_score"),
    volunteer_score: pick(source, "volunteer_score"),
  };

  const feedback = {
    summary: asString(pick(source, "summary")),
    skills_feedback: asString(pick(source, "skills_feedback")),
    experience_feedback: asString(pick(source, "experience_feedback")),
    structure_feedback: asString(pick(source, "structure_feedback")),
    simple_suggestions: asStringList(pick(source, "simple_suggestions")),
    strength_highlights: asStringList(pick(source, "strength_highlights")),
    growth_opportunities: asStringList(pick(source, "growth_opportunities")),
    jd_fit_analysis: asString(pick(source, "jd_fit_analysis")),
    certifications_feedback: asString(pick(source, "certifications_feedback")),
    languages_feedback: asString(pick(source, "languages_feedback")),
    professional_links_feedback: asString(
      pick(source, "professional_links_feedback"),
    ),
    optimizer_review: asString(pick(source, "optimizer_review")),
    interview_talking_points: asStringList(
      pick(source, "interview_talking_points"),
    ),
    priority_action_plan: asStringList(pick(source, "priority_action_plan")),
    recruiter_lens: asString(pick(source, "recruiter_lens")),
    competitive_positioning: asString(pick(source, "competitive_positioning")),
  };

  const optimizer = {
    section_order: asStringList(pick(source, "section_order")),
    optimized_sections: asRecord(pick(source, "optimized_sections")),
    keywords_integrated: asStringList(pick(source, "keywords_integrated")),
    changes_made: asStringList(pick(source, "changes_made")),
    suggested_additions_if_true: asStringList(
      pick(source, "suggested_additions_if_true"),
    ),
    optimization_notes: asString(pick(source, "optimization_notes")),
  };

  const hasPremiumExtras =
    "rerender" in source ||
    "job_finder" in source ||
    asStringList(pick(source, "changes_made")).length > 0 ||
    Object.keys(asRecord(pick(source, "optimized_sections"))).length > 0;

  const base: FreeAnalyzeResult = {
    resume_filename: resumeFilename,
    intent,
    analyzer,
    ats,
    feedback,
    ...(resumeId ? { resume_id: resumeId } : {}),
    ...(resumeVersion !== undefined ? { resume_version: resumeVersion } : {}),
  };

  if (hasPremiumExtras) {
    return {
      ...base,
      optimizer,
      job_finder: source.job_finder ?? null,
      rerender: source.rerender ?? null,
    } as PremiumAnalyzeResult;
  }

  return base;
}
