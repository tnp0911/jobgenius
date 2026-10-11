"use client";

import { useEffect } from "react";
import type {
  FreeAnalyzeResult,
  PremiumAnalyzeResult,
} from "@/services/resumeService";
import {
  extractJobsPayload,
  type JobCardData,
} from "@/app/jrecommender/jobNormalize";
import { renderAgentMarkdown } from "@/utils/agentMarkdown";

type AnalyzerResultsProps = {
  result: FreeAnalyzeResult | PremiumAnalyzeResult;
  onAnalyzeAgain: () => void;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function scorePercent(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

function isPremiumResult(
  result: FreeAnalyzeResult | PremiumAnalyzeResult,
): result is PremiumAnalyzeResult {
  return "optimizer" in result || "job_finder" in result;
}

function ScoreChip({ label, value }: { label: string; value: unknown }) {
  const pct = scorePercent(value);
  if (pct === null) return null;
  return (
    <div className="analyzer-score-chip">
      <span className="analyzer-score-chip-value">{pct}</span>
      <span className="analyzer-score-chip-label">{label}</span>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="analyzer-tag-list">
      {items.map((item) => (
        <li key={item} className="analyzer-tag">
          {item}
        </li>
      ))}
    </ul>
  );
}

function AnalyzerJobCard({ job }: { job: JobCardData }) {
  const scorePct =
    typeof job.matchScore === "number"
      ? Math.round(
          Math.min(
            100,
            Math.max(0, job.matchScore <= 1 ? job.matchScore * 100 : job.matchScore),
          ),
        )
      : null;

  return (
    <article className="jobs-card">
      <div className="jobs-card-top">
        {job.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="jobs-card-logo" src={job.logo} alt="" />
        ) : (
          <div className="jobs-card-logo jobs-card-logo-fallback" aria-hidden="true">
            {job.company.slice(0, 1).toUpperCase() || "J"}
          </div>
        )}
        <div className="jobs-card-heading">
          <h3 className="jobs-card-title">{job.title}</h3>
          <p className="jobs-card-company">{job.company}</p>
        </div>
        {scorePct !== null ? (
          <span className="jobs-card-score" title="Match score">
            {scorePct}%
          </span>
        ) : null}
      </div>

      <p className="jobs-card-meta">
        <span>{job.location}</span>
        {job.remote ? <span className="jobs-card-pill">Remote</span> : null}
        {job.employmentType ? (
          <span className="jobs-card-pill">{job.employmentType}</span>
        ) : null}
      </p>

      {job.salary ? <p className="jobs-card-salary">{job.salary}</p> : null}

      {job.description ? <p className="jobs-card-desc">{job.description}</p> : null}

      {job.skills.length > 0 ? (
        <ul className="jobs-card-skills">
          {job.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      ) : null}

      {job.applyLink ? (
        <a
          className="mkt-btn mkt-btn-primary jobs-card-apply"
          href={job.applyLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          View posting
        </a>
      ) : (
        <span className="jobs-card-apply-disabled">No apply link</span>
      )}
    </article>
  );
}

function JobFinderSection({ jobFinder }: { jobFinder: unknown }) {
  if (jobFinder == null) return null;

  const payload = extractJobsPayload(jobFinder);
  const finderRecord = asRecord(jobFinder);
  const error = asString(finderRecord.error);
  const message = payload.message || asString(finderRecord.message);

  return (
    <section className="analyzer-job-finder" aria-labelledby="analyzer-job-finder-title">
      <div className="analyzer-job-finder-head">
        <p className="analyzer-results-kicker">AI Job Finder</p>
        <h3 id="analyzer-job-finder-title" className="analyzer-results-block-title">
          Roles matched to your resume
        </h3>
        {message ? (
          <div className="analyzer-job-finder-message">
            {renderAgentMarkdown(message)}
          </div>
        ) : null}
        {error && payload.jobs.length === 0 ? (
          <p className="analyzer-job-finder-empty" role="status">
            {error}
          </p>
        ) : null}
      </div>

      {payload.jobs.length > 0 ? (
        <div className="jobs-grid analyzer-job-finder-grid" aria-label="Matched jobs">
          {payload.jobs.map((job) => (
            <AnalyzerJobCard key={job.id} job={job} />
          ))}
        </div>
      ) : !error ? (
        <p className="analyzer-job-finder-empty" role="status">
          No matching roles were returned for this run.
        </p>
      ) : null}
    </section>
  );
}

export function AnalyzerResults({ result, onAnalyzeAgain }: AnalyzerResultsProps) {
  const intent = asRecord(result.intent);
  const analyzer = asRecord(result.analyzer);
  const ats = asRecord(result.ats);
  const feedback =
    typeof result.feedback === "string"
      ? { summary: result.feedback }
      : asRecord(result.feedback);
  const jobFinder = isPremiumResult(result) ? result.job_finder : null;

  const targetRole = asString(intent.target_role);
  const seniority = asString(intent.seniority_level);
  const industry = asString(intent.industry);
  const keywords = asStringList(intent.top_keywords);
  const hardSkills = asStringList(analyzer.hard_skills);
  const softSkills = asStringList(analyzer.soft_skills);
  const missingHard = asStringList(analyzer.missing_hard_skills);
  const missingSoft = asStringList(analyzer.missing_soft_skills);
  const suggestions = asStringList(feedback.simple_suggestions);

  useEffect(() => {
    try {
      sessionStorage.setItem("targetRole", targetRole);
      sessionStorage.setItem("seniority", seniority);
    } catch {
      // ignore quota / private mode
    }
  }, [targetRole, seniority]);

  return (
    <div className="analyzer-results">
      <div className="analyzer-results-head">
        <div>
          <p className="analyzer-results-kicker">Your analysis</p>
          <h2 className="analyzer-results-title">
            {targetRole ? `Fit notes for ${targetRole}` : "Resume fit notes"}
          </h2>
          <p className="analyzer-results-meta">
            {[seniority, industry?.charAt(0).toUpperCase() + industry?.slice(1)].filter(Boolean).join(" · ") ||
              "General resume quality and structure feedback"}
          </p>
        </div>
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost analyzer-results-again"
          onClick={onAnalyzeAgain}
        >
          Analyze again
        </button>
      </div>

      <div className="analyzer-score-row" aria-label="Scores">
        <ScoreChip label="Resume quality" value={ats.resume_score} />
        <ScoreChip label="ATS fit" value={ats.ats_score} />
        <ScoreChip label="Sections" value={ats.section_score} />
        <ScoreChip label="Skills quality" value={ats.skills_quality_score} />
        <ScoreChip label="Hard skills match" value={analyzer.matching_hard_skills_score} />
        <ScoreChip label="Soft skills match" value={analyzer.matching_soft_skills_score} />
      </div>

      {asString(feedback.summary) ? (
        <section className="analyzer-results-block">
          <h3 className="analyzer-results-block-title">Summary</h3>
          <p className="analyzer-results-prose">{asString(feedback.summary)}</p>
        </section>
      ) : null}

      <div className="analyzer-results-grid">
        {asString(feedback.skills_feedback) ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Skills</h3>
            <p className="analyzer-results-prose">{asString(feedback.skills_feedback)}</p>
          </section>
        ) : null}
        {asString(feedback.experience_feedback) ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Experience</h3>
            <p className="analyzer-results-prose">{asString(feedback.experience_feedback)}</p>
          </section>
        ) : null}
        {asString(feedback.structure_feedback) ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Structure</h3>
            <p className="analyzer-results-prose">{asString(feedback.structure_feedback)}</p>
          </section>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <section className="analyzer-results-block">
          <h3 className="analyzer-results-block-title">Next steps</h3>
          <ol className="analyzer-suggestions">
            {suggestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="analyzer-results-grid">
        {hardSkills.length > 0 ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Detected hard skills</h3>
            <TagList items={hardSkills} />
          </section>
        ) : null}
        {softSkills.length > 0 ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Detected soft skills</h3>
            <TagList items={softSkills} />
          </section>
        ) : null}
        {missingHard.length > 0 ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Missing vs job (hard)</h3>
            <TagList items={missingHard} />
          </section>
        ) : null}
        {missingSoft.length > 0 ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Missing vs job (soft)</h3>
            <TagList items={missingSoft} />
          </section>
        ) : null}
        {keywords.length > 0 ? (
          <section className="analyzer-results-block">
            <h3 className="analyzer-results-block-title">Keywords to lean on</h3>
            <TagList items={keywords} />
          </section>
        ) : null}
      </div>

      <JobFinderSection jobFinder={jobFinder} />
    </div>
  );
}
