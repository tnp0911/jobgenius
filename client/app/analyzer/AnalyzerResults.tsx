"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import type {
  FreeAnalyzeResult,
  PremiumAnalyzeResult,
} from "@/services/resumeService";
import {
  deleteResumeAnalysisResult,
  rerenderResume,
} from "@/services/resumeService";
import {
  extractJobsPayload,
  type JobCardData,
} from "@/app/jrecommender/jobNormalize";
import { renderAgentMarkdown } from "@/utils/agentMarkdown";
import { normalizeAnalyzeResult } from "@/utils/normalizeAnalyzeResult";
import { OptimizerSuggestions } from "@/components/optimizer/OptimizerSuggestions";
import { ConfirmModal } from "@/components/ConfirmModal";

type AnalyzerResultsProps = {
  result: FreeAnalyzeResult | PremiumAnalyzeResult | Record<string, unknown>;
  onAnalyzeAgain: () => void;
  jobId?: string;
  againLabel?: string;
  /** Show the 24h Redis TTL warning (default: when jobId is set). */
  showTtlWarning?: boolean;
};

type DecisionState = "pending" | "accepted" | "rejected" | "busy";

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
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function scorePercent(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const pct = n <= 1 ? n * 100 : n;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

function scoreTone(pct: number | null): "strong" | "ok" | "weak" | "empty" {
  if (pct === null) return "empty";
  if (pct >= 80) return "strong";
  if (pct >= 55) return "ok";
  return "weak";
}

function isPremiumResult(
  result: FreeAnalyzeResult | PremiumAnalyzeResult,
): result is PremiumAnalyzeResult {
  if ("rerender" in result && result.rerender != null) return true;
  if ("job_finder" in result && result.job_finder != null) return true;
  if (!("optimizer" in result) || result.optimizer == null) return false;
  const optimizer = asRecord(result.optimizer);
  return (
    asStringList(optimizer.changes_made).length > 0 ||
    asStringList(optimizer.section_order).length > 0 ||
    Object.keys(asRecord(optimizer.optimized_sections)).length > 0 ||
    asString(optimizer.optimization_notes).length > 0
  );
}

function TagList({
  items,
  tone = "default",
}: {
  items: string[];
  tone?: "default" | "missing" | "good";
}) {
  if (items.length === 0) return null;
  return (
    <ul className="analyzer-tag-list">
      {items.map((item) => (
        <li
          key={item}
          className={`analyzer-tag${tone !== "default" ? ` analyzer-tag-${tone}` : ""}`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function ScoreRing({ value, label }: { value: unknown; label: string }) {
  const pct = scorePercent(value) ?? 0;
  const tone = scoreTone(scorePercent(value));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className={`analyzer-score-ring analyzer-score-ring-${tone}`}>
      <svg viewBox="0 0 128 128" className="analyzer-score-ring-svg" aria-hidden="true">
        <circle className="analyzer-score-ring-track" cx="64" cy="64" r={radius} />
        <circle
          className="analyzer-score-ring-progress"
          cx="64"
          cy="64"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="analyzer-score-ring-center">
        <span className="analyzer-score-ring-value">{pct}</span>
        <span className="analyzer-score-ring-label">{label}</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: unknown }) {
  const pct = scorePercent(value);
  if (pct === null) return null;
  const tone = scoreTone(pct);
  return (
    <div className={`analyzer-score-bar analyzer-score-bar-${tone}`}>
      <div className="analyzer-score-bar-meta">
        <span>{label}</span>
        <strong>{pct}%</strong>
      </div>
      <div className="analyzer-score-bar-track" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Checklist({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "grow";
}) {
  if (items.length === 0) return null;
  return (
    <section className={`analyzer-checklist analyzer-checklist-${tone}`}>
      <h3 className="analyzer-results-block-title">{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
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

function buildPdfBlobUrl(pdfBase64: string): string | null {
  try {
    const cleaned = pdfBase64.replace(/\s+/g, "");
    const binary = atob(cleaned);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    if (
      bytes.length < 5 ||
      String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "%PDF"
    ) {
      return null;
    }
    return URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
  } catch {
    return null;
  }
}

function OptimizedPdfPanel({
  pdfBase64,
  decision,
  busy,
  onAccept,
  onReject,
}: {
  pdfBase64: string;
  decision: DecisionState;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = buildPdfBlobUrl(pdfBase64);
    setPdfUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdfBase64]);

  return (
    <aside className="analyzer-pdf-panel" aria-labelledby="analyzer-pdf-title">
      <div className="analyzer-pdf-panel-head">
        <div>
          <p className="analyzer-results-kicker">Optimized resume</p>
          <h3 id="analyzer-pdf-title" className="analyzer-results-block-title">
            Highlighted changes preview
          </h3>
          <strong style={{ color: "red" }}>Please refresh the page if the PDF preview is not showing.</strong>
          <p className="analyzer-pdf-panel-lead">
            Yellow highlights show optimizer edits. Accept to overwrite your
            original resume with the optimized version, or reject to discard
            this preview and analysis result.
          </p>
        </div>
        {pdfUrl ? (
          <a
            className="mkt-btn mkt-btn-ghost analyzer-pdf-open"
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download PDF
          </a>
        ) : null}
      </div>

      <div className="analyzer-pdf-frame-wrap">
        {pdfUrl ? (
          <embed
            key={pdfUrl}
            className="analyzer-pdf-frame"
            src={pdfUrl}
            type="application/pdf"
            title="Optimized resume PDF with highlighted changes"
          />
        ) : (
          <p className="analyzer-pdf-empty" role="status">
            Preparing PDF preview…
          </p>
        )}
      </div>

      <div className="analyzer-pdf-actions">
        {decision === "pending" || decision === "busy" ? (
          <>
            <button
              type="button"
              className="mkt-btn mkt-btn-ghost analyzer-pdf-reject"
              disabled={busy}
              onClick={onReject}
            >
              Reject changes
            </button>
            <button
              type="button"
              className="mkt-btn mkt-btn-primary analyzer-pdf-accept"
              disabled={busy}
              onClick={onAccept}
            >
              Accept optimization
            </button>
          </>
        ) : (
          <p
            className={`analyzer-pdf-decision analyzer-pdf-decision-${decision}`}
            role="status"
          >
            {decision === "accepted"
              ? "Optimization accepted. Your stored resume will be overwritten with the optimized version. You will be able to view the optimized resume in your history."
              : "Optimization rejected. Your original resume stays unchanged."}
          </p>
        )}
      </div>
    </aside>
  );
}

export function AnalyzerResults({
  result: rawResult,
  onAnalyzeAgain,
  jobId,
  againLabel = "Analyze again",
  showTtlWarning,
}: AnalyzerResultsProps) {
  const router = useRouter();
  const result = useMemo(
    () => normalizeAnalyzeResult(rawResult as Record<string, unknown>),
    [rawResult],
  );

  const resumeFilename = asString(result.resume_filename) || null;
  const resumeVersion =
    typeof result.resume_version === "number" ? result.resume_version : null;
  const intent = asRecord(result.intent);
  const analyzer = asRecord(result.analyzer);
  const ats = asRecord(result.ats);
  const feedback =
    typeof result.feedback === "string"
      ? { summary: result.feedback }
      : asRecord(result.feedback);
  const premium = isPremiumResult(result);
  const jobFinder = premium ? result.job_finder : null;
  const optimizer = premium ? result.optimizer : asRecord(
    (result as { optimizer?: unknown }).optimizer,
  );
  const rerender = premium ? asRecord(result.rerender) : {};
  const pdfBase64 = asString(rerender.pdf_base64);

  const targetRole = asString(intent.target_role);
  const seniority = asString(intent.seniority_level);
  const industry = asString(intent.industry);
  const keywords = asStringList(intent.top_keywords);
  const hardSkills = asStringList(analyzer.hard_skills);
  const softSkills = asStringList(analyzer.soft_skills);
  const missingHard = asStringList(analyzer.missing_hard_skills);
  const missingSoft = asStringList(analyzer.missing_soft_skills);
  const suggestions = asStringList(feedback.simple_suggestions);
  const strengths = asStringList(feedback.strength_highlights);
  const growth = asStringList(feedback.growth_opportunities);
  const actionPlan = asStringList(feedback.priority_action_plan);
  const talkingPoints = asStringList(feedback.interview_talking_points);
  const changesMade = asStringList(asRecord(optimizer).changes_made);

  const [decision, setDecision] = useState<DecisionState>("pending");
  const [ttlOpen, setTtlOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const shouldWarnTtl = showTtlWarning ?? Boolean(jobId);

  useEffect(() => {
    try {
      sessionStorage.setItem("targetRole", targetRole);
      sessionStorage.setItem("seniority", seniority);
    } catch {
      // ignore quota / private mode
    }
  }, [targetRole, seniority]);

  useEffect(() => {
    if (!shouldWarnTtl || !jobId) return;
    const key = `analyzer_ttl_warned_${jobId}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      // still show once in this mount if storage is unavailable
    }
    setTtlOpen(true);
  }, [shouldWarnTtl, jobId]);

  const metaLine =
    [seniority, industry ? industry.charAt(0).toUpperCase() + industry.slice(1) : ""]
      .filter(Boolean)
      .join(" · ") || "General resume quality and structure feedback";

  async function confirmAccept() {
    if (!jobId) {
      setDecision("accepted");
      setAcceptOpen(false);
      toast.success("Optimization accepted.");
      return;
    }
    if (!resumeFilename || resumeVersion == null) {
      toast.error(
        "Missing resume details for overwrite. Please re-run the analysis.",
      );
      return;
    }

    setActionBusy(true);
    setDecision("busy");
    const data = await rerenderResume(jobId, resumeFilename, resumeVersion);
    setActionBusy(false);
    setAcceptOpen(false);

    if (!data) {
      setDecision("pending");
      return;
    }

    setDecision("accepted");
  }

  async function handleReject() {
    if (!jobId) {
      setDecision("rejected");
      return;
    }

    setActionBusy(true);
    setDecision("busy");
    const ok = await deleteResumeAnalysisResult(jobId);
    setActionBusy(false);

    if (!ok) {
      setDecision("pending");
      return;
    }

    setDecision("rejected");
    router.replace("/analyzer?analysisDeleted=1");
  }

  const breakdown = [
    { label: "Sections", value: ats.section_score },
    { label: "Experience & projects", value: ats.experience_projects_score },
    { label: "Skills quality", value: ats.skills_quality_score },
    { label: "Summary", value: ats.summary_quality_score },
    { label: "Formatting", value: ats.formatting_score },
    { label: "ATS fit", value: ats.ats_score },
    { label: "Hard skills match", value: analyzer.matching_hard_skills_score },
    { label: "Soft skills match", value: analyzer.matching_soft_skills_score },
    { label: "Certifications", value: ats.certifications_score },
    { label: "Languages", value: ats.languages_score },
    { label: "Professional links", value: ats.professional_links_score },
    { label: "Volunteer", value: ats.volunteer_score },
  ];

  const hasPdf = Boolean(pdfBase64 && jobId);

  return (
    <div className={`analyzer-results${hasPdf ? " analyzer-results-with-pdf" : ""}`}>
      <ConfirmModal
        open={ttlOpen}
        kicker="Temporary result"
        title="This report expires in 24 hours"
        confirmLabel="Got it"
        showCancel={false}
        onConfirm={() => setTtlOpen(false)}
        onCancel={() => setTtlOpen(false)}
      >
        <p>
          Analysis results are stored temporarily and will be deleted after 24
          hours. The optimized resume preview will be removed at the same time.
        </p>
        <p>
          Accept the optimization before then if you want it saved over your
          current resume. A permanent analysis summary still stays in your
          history.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={acceptOpen}
        kicker="Overwrite resume"
        title="Replace your original resume?"
        confirmLabel="Overwrite resume"
        cancelLabel="Keep reviewing"
        confirmTone="danger"
        busy={actionBusy}
        onConfirm={() => {
          void confirmAccept();
        }}
        onCancel={() => {
          if (!actionBusy) setAcceptOpen(false);
        }}
      >
        <p>
          Accepting will overwrite the resume currently stored for this file.
          The original version cannot be recovered afterward.
        </p>
        <p>
          Yellow highlights are only for preview — the saved file will use the
          optimized content without highlight markup.
        </p>
      </ConfirmModal>

      <div className="analyzer-results-head">
        <div>
          <p className="analyzer-results-kicker">Resume check report</p>
          <h2 className="analyzer-results-title">
            {targetRole ? `Fit report for ${targetRole}` : "Resume fit report"}
          </h2>
          {resumeFilename ? (
            <p className="analyzer-results-meta">
              Resume filename: <strong>{resumeFilename}</strong>
            </p>
          ) : null}
          <p className="analyzer-results-meta">{metaLine}</p>
        </div>
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost analyzer-results-again"
          onClick={onAnalyzeAgain}
        >
          {againLabel}
        </button>
      </div>

      <div className="analyzer-results-layout">
        <div className="analyzer-results-report">
          <section className="analyzer-scoreboard" aria-label="Overall score">
            <ScoreRing value={ats.resume_score} label="Resume score" />
            <div className="analyzer-scoreboard-copy">
              <h3 className="analyzer-results-block-title">Overall quality</h3>
              {asString(feedback.summary) ? (
                <p className="analyzer-results-prose">{asString(feedback.summary)}</p>
              ) : (
                <p className="analyzer-results-prose">
                  Scores below break down how ATS-friendly and complete your resume looks.
                </p>
              )}
              {asString(feedback.recruiter_lens) ? (
                <p className="analyzer-results-callout">
                  {asString(feedback.recruiter_lens)}
                </p>
              ) : null}
            </div>
          </section>

          <section className="analyzer-results-block" aria-label="Score breakdown">
            <h3 className="analyzer-results-block-title">Score breakdown</h3>
            <div className="analyzer-score-bars">
              {breakdown.map((item) => (
                <ScoreBar key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>

          <div className="analyzer-checklist-row">
            <Checklist title="Strengths" items={strengths} tone="good" />
            <Checklist title="Growth opportunities" items={growth} tone="grow" />
          </div>

          {suggestions.length > 0 ? (
            <section className="analyzer-results-block">
              <h3 className="analyzer-results-block-title">Priority fixes</h3>
              <ol className="analyzer-suggestions">
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {actionPlan.length > 0 ? (
            <section className="analyzer-results-block">
              <h3 className="analyzer-results-block-title">Action plan</h3>
              <ol className="analyzer-suggestions">
                {actionPlan.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="analyzer-results-grid">
            {asString(feedback.skills_feedback) ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Skills</h3>
                <p className="analyzer-results-prose">
                  {asString(feedback.skills_feedback)}
                </p>
              </section>
            ) : null}
            {asString(feedback.experience_feedback) ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Experience</h3>
                <p className="analyzer-results-prose">
                  {asString(feedback.experience_feedback)}
                </p>
              </section>
            ) : null}
            {asString(feedback.structure_feedback) ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Structure</h3>
                <p className="analyzer-results-prose">
                  {asString(feedback.structure_feedback)}
                </p>
              </section>
            ) : null}
            {asString(feedback.competitive_positioning) ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Market positioning</h3>
                <p className="analyzer-results-prose">
                  {asString(feedback.competitive_positioning)}
                </p>
              </section>
            ) : null}
          </div>

          <div className="analyzer-results-grid">
            {hardSkills.length > 0 ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Detected hard skills</h3>
                <TagList items={hardSkills} tone="good" />
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
                <TagList items={missingHard} tone="missing" />
              </section>
            ) : null}
            {missingSoft.length > 0 ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Missing vs job (soft)</h3>
                <TagList items={missingSoft} tone="missing" />
              </section>
            ) : null}
            {keywords.length > 0 ? (
              <section className="analyzer-results-block">
                <h3 className="analyzer-results-block-title">Keywords to lean on</h3>
                <TagList items={keywords} />
              </section>
            ) : null}
          </div>

          {changesMade.length > 0 ? (
            <section className="analyzer-results-block">
              <h3 className="analyzer-results-block-title">Optimizer changes</h3>
              <ul className="analyzer-suggestions analyzer-suggestions-bullets">
                {changesMade.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {talkingPoints.length > 0 ? (
            <section className="analyzer-results-block">
              <h3 className="analyzer-results-block-title">Interview talking points</h3>
              <ul className="analyzer-suggestions analyzer-suggestions-bullets">
                {talkingPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <OptimizerSuggestions optimizer={optimizer} />
          <JobFinderSection jobFinder={jobFinder} />
        </div>

        {hasPdf ? (
          <OptimizedPdfPanel
            pdfBase64={pdfBase64}
            decision={decision}
            busy={actionBusy}
            onAccept={() => setAcceptOpen(true)}
            onReject={() => {
              void handleReject();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
