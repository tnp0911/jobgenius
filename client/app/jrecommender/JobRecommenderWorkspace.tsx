"use client";

import axios from "axios";
import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import {
  getJobRecommendationsFreeUser,
  getJobRecommendationsPremiumUser,
  getJobRecommendationsUnloggedInUser,
  jobSearchWithPrompt,
} from "@/services/jobService";
import { extractJobsPayload, type JobCardData } from "./jobNormalize";
import { AuthOptions } from "@/auth/types";
import { isAborted } from "@/utils/errorHelpers";

const MAX_BYTES = 8 * 1024 * 1024;

type Phase = "idle" | "loading" | "searching";
type ResultsMode = "recommendations" | "prompt";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function JobCard({ job }: { job: JobCardData }) {
  const scorePct =
    typeof job.matchScore === "number"
      ? Math.round(Math.min(100, Math.max(0, job.matchScore <= 1 ? job.matchScore * 100 : job.matchScore)))
      : null;

  return (
    <article className="jobs-card">
      <div className="jobs-card-top">
        {job.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="jobs-card-logo" src={job.logo} alt="" />
        ) : (
          <div className="jobs-card-logo jobs-card-logo-fallback" aria-hidden="true">
            {job.company.slice(0, 1).toUpperCase()}
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

      {job.description ? (
        <p className="jobs-card-desc">{job.description}</p>
      ) : null}

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

function JobsGrid({ jobs }: { jobs: JobCardData[] }) {
  if (jobs.length === 0) {
    return (
      <p className="jobs-empty" role="status">
        No roles to show yet. Try refining your search.
      </p>
    );
  }

  return (
    <div className="jobs-grid" aria-label="Recommended jobs">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

function ResumePromptDropzone({
  file,
  onFileChange,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function acceptFile(next: File | null) {
    if (!next) {
      setError(null);
      onFileChange(null);
      return;
    }
    if (!isPdf(next)) {
      setError("Please upload a PDF resume.");
      onFileChange(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("That file is larger than 8 MB.");
      onFileChange(null);
      return;
    }
    setError(null);
    onFileChange(next);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragging) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  const zoneClass = [
    "jobs-dropzone",
    dragging ? "is-dragging" : "",
    file ? "has-file" : "",
    error ? "has-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="jobs-upload">
      <div
        className={zoneClass}
        role="button"
        tabIndex={0}
        aria-controls={inputId}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <p className="jobs-dropzone-title">
          {file ? "Resume ready" : dragging ? "Drop it here" : "Drop your resume PDF"}
        </p>
        <p className="jobs-dropzone-sub">
          {file ? (
            <>
              <span className="jobs-dropzone-filename">{file.name}</span>
              <span className="jobs-dropzone-size">{formatBytes(file.size)}</span>
            </>
          ) : (
            <>or click to browse · PDF only, up to 8 MB</>
          )}
        </p>
        <input
          ref={inputRef}
          id={inputId}
          className="jobs-dropzone-input"
          type="file"
          accept="application/pdf,.pdf"
          onChange={onChange}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
      {file ? (
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost jobs-clear"
          onClick={() => acceptFile(null)}
        >
          Choose another
        </button>
      ) : null}
      {error ? (
        <p className="jobs-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function JobRecommenderWorkspace() {
  const { status, tier } = useAuth();
  const isPremium = tier?.toLowerCase() === "premium";

  const [phase, setPhase] = useState<Phase>("loading"); // idle, loading, searching
  const [mode, setMode] = useState<ResultsMode>("recommendations");
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [promptJobs, setPromptJobs] = useState<JobCardData[]>([]);
  const [promptMessage, setPromptMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;

    async function loadRecommendations() {
      setPhase("loading");
      setError(null);
      setMode("recommendations");

      let role = targetRole;
      let seniority = seniorityLevel;
      if (typeof window !== "undefined") {
        const savedRole = sessionStorage.getItem("targetRole")?.trim();
        const savedSeniority = sessionStorage.getItem("seniority")?.trim();
        if (savedRole) {
          role = savedRole;
          setTargetRole(savedRole);
        }
        if (savedSeniority) {
          seniority = savedSeniority;
          setSeniorityLevel(savedSeniority);
        }
      }

      try {
        let data: unknown;
        if (status === "unauthenticated") {
          data = await getJobRecommendationsUnloggedInUser();
        } else if (isPremium) {
          data = await getJobRecommendationsPremiumUser("", role, seniority, setFallbackUsed);
        } else {
          data = await getJobRecommendationsFreeUser(role, seniority);
        }

        if (cancelled) return;
        const payload = extractJobsPayload(data);
        setJobs(payload.jobs);
        if (payload.jobs.length === 0) {
          setError("No jobs found nearby right now.");
        }
      } catch (err) {
        if (cancelled) return;
        if (isAborted(err)) return;
        const message = getErrorMessage(err, "Could not load recommendations.");
        setError(message);
        setJobs([]);
        toast.error(message);
      } finally {
        if (!cancelled) setPhase("idle");
      }
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [status, isPremium]);

  async function refreshFreeRecommendations() {
    setPhase("loading");
    setError(null);
    setMode("recommendations");
    try {
      const data = await getJobRecommendationsFreeUser(targetRole, seniorityLevel);
      const payload = extractJobsPayload(data);
      setJobs(payload.jobs);
      if (payload.jobs.length === 0) {
        setError("No jobs found for that role and level.");
      }
    } catch (err) {
      if (isAborted(err)) return;
      const message = getErrorMessage(err, "Could not refresh recommendations.");
      setError(message);
      toast.error(message);
    } finally {
      setPhase("idle");
    }
  }

  async function refreshPremiumRecommendations() {
    setPhase("loading");
    setError(null);
    setMode("recommendations");
    try {
      const data = await getJobRecommendationsPremiumUser("", targetRole, seniorityLevel, setFallbackUsed);
      const payload = extractJobsPayload(data);
      setJobs(payload.jobs);
      if (payload.jobs.length === 0) {
        setError("No premium matches yet. Upload a resume via prompt search or run the analyzer first.");
      }
    } catch (err) {
      if (isAborted(err)) return;
      const message = getErrorMessage(err, "Could not refresh recommendations.");
      setError(message);
      toast.error(message);
    } finally {
      setPhase("idle");
    }
  }

  async function onPromptSearch() {

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (!file) {
      toast.error("Upload a PDF resume first.");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Add a short prompt describing the roles you want.");
      return;
    }

    setPhase("searching");
    setError(null);
    try {
      const options: AuthOptions = {
        signal: controller.signal,
        timeout: 180_000,
      };
      const data = await jobSearchWithPrompt(file, prompt.trim(), options);
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const payload = extractJobsPayload(data);
      setPromptJobs(payload.jobs);
      setPromptMessage(payload.message ?? null);
      setMode("prompt");
      if (payload.jobs.length === 0) {
        toast.info(payload.message || "Search finished with no listings.");
      }
    } catch (err) {
      if (isAborted(err)) return;
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const message = getErrorMessage(err, "Job search failed. Please try again.");
      toast.error(message);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPhase("idle");
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="jobs-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  const showingJobs = mode === "prompt" ? promptJobs : jobs;
  const isBusy = phase === "loading" || phase === "searching";

  return (
    <div className="jobs-workspace">
      {status === "authenticated" ? (
        <section className="jobs-prompt-panel" aria-labelledby="jobs-prompt-title">
          <div className="jobs-pane-head">
            <p className="jobs-pane-kicker">
              {isPremium ? "Premium" : "Free"} · Prompt search
            </p>
            <h2 id="jobs-prompt-title" className="jobs-pane-title">
              Resume + what you want
            </h2>
            <p className="jobs-pane-lead">
              Upload a PDF and describe the roles, cities, or constraints that matter —
              we match from your story, not just a keyword list.
            </p>
          </div>

          <div className="jobs-prompt-grid">
            <ResumePromptDropzone file={file} onFileChange={setFile} />
            <label className="jobs-prompt-field">
              <span className="jobs-prompt-label">Your prompt</span>
              <textarea
                className="jobs-prompt-textarea"
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="e.g. Mid-level backend roles in Toronto or remote Canada, strong TypeScript and cloud experience, avoid pure frontend."
                disabled={phase === "searching"}
              />
            </label>
          </div>

          <div className="jobs-prompt-footer">
            <p className="jobs-prompt-note">
              {isPremium
                ? "Premium: prompt search is limited every few days."
                : "Free: prompt search is limited — use recommendations below anytime."}
            </p>
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              disabled={!file || !prompt.trim() || phase === "searching"}
              onClick={() => {
                void onPromptSearch();
              }}
            >
              {phase === "searching" ? "Searching…" : "Find jobs from my resume"}
            </button>
          </div>
        </section>
      ) : (
        <aside className="jobs-guest-banner" aria-label="Sign in for personalized search">
          <div>
            <p className="jobs-pane-kicker">Guest view</p>
            <h2 className="jobs-pane-title">Roles near you</h2>
            <p className="jobs-pane-lead">
              Sign in to upload a resume, add a prompt, and get matches tailored to your
              background.
            </p>
          </div>
          <div className="jobs-guest-actions">
            <Link href="/login" className="mkt-btn mkt-btn-primary">
              Log in
            </Link>
          </div>
        </aside>
      )}

      <section className="jobs-results" aria-labelledby="jobs-results-title">
        <div className="jobs-results-head">
          <div>
            <p className="jobs-pane-kicker">
              {mode === "prompt" ? "Prompt results" : "Recommendations"}
            </p>
            <h2 id="jobs-results-title" className="jobs-pane-title">
              {mode === "prompt"
                ? "Jobs from your prompt"
                : status === "authenticated"
                  ? (isPremium && !fallbackUsed)
                    ? "Matched to your latest resume"
                    : "Suggested for you"
                  : "Openings nearby"}
            </h2>
          </div>

          <div className="jobs-results-actions">
            {mode === "prompt" ? (
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost"
                onClick={() => setMode("recommendations")}
              >
                Back to recommendations
              </button>
            ) : null}

            {status === "authenticated" && !isPremium && mode === "recommendations" ? (
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost"
                disabled={isBusy}
                onClick={() => {
                  void refreshFreeRecommendations();
                }}
              >
                Refresh
              </button>
            ) : null}

            {status === "authenticated" && isPremium && mode === "recommendations" ? (
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost"
                disabled={isBusy}
                onClick={() => {
                  void refreshPremiumRecommendations();
                }}
              >
                Refresh
              </button>
            ) : null}
          </div>
        </div>

        {promptMessage && mode === "prompt" && phase === "idle" ? (
            <p className="jobs-ai-message">{promptMessage}</p>
          ) : null}

        {phase === "loading" || phase === "searching" ? (
          isPremium && phase === "loading" && mode === "recommendations" ? (
            <div
              className="jobs-status jobs-status-premium"
              aria-busy="true"
              role="status"
            >
              <p className="jobs-status-kicker">Premium matching</p>
              <p className="jobs-status-title">
                Running semantic vector matching…
              </p>
              <p className="jobs-status-lead">
                We&apos;re comparing your full resume embedding against the job
                index. This can take a few seconds to a few minutes — hang tight
                while we find the strongest matches.
              </p>
            </div>
          ) : (
            <div className="jobs-status" aria-busy="true">
              {phase === "searching"
                ? "Reading your resume and hunting roles…"
                : "Loading…"}
            </div>
          )
        ) : error && showingJobs.length === 0 ? (
          <p className="jobs-empty" role="alert">
            {error}
          </p>
        ) : (
          <JobsGrid jobs={showingJobs} />
        )}
      </section>
    </div>
  );
}
