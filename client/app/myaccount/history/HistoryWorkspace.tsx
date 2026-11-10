"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { AuthOptions } from "@/auth/types";
import {
  deleteResume,
  getResume,
  getResumes,
  type Resume,
} from "@/services/resumeService";
import { AnalyzerResults } from "@/app/analyzer/AnalyzerResults";

type LoadState = "idle" | "loading" | "ready" | "error";

type ResumeGroup = {
  resumeId: string;
  filename: string;
  storage_path: string;
  versions: Resume[];
  latestVersion: number;
};

type SelectedVersion = {
  resumeId: string;
  storage_path: string;
  version: number;
  filename: string;
  updatedWithOptimizer: boolean;
};

function versionKey(resumeId: string, version: number) {
  return `${resumeId}:${version}`;
}

function groupResumes(resumes: Resume[]): ResumeGroup[] {
  const byId = new Map<string, Resume[]>();
  for (const resume of resumes) {
    const list = byId.get(resume.resume_id) ?? [];
    list.push(resume);
    byId.set(resume.resume_id, list);
  }

  return Array.from(byId.values())
    .map((versions) => {
      const sorted = [...versions].sort((a, b) => b.version - a.version);
      return {
        resumeId: sorted[0].resume_id,
        filename: sorted[0].filename,
        storage_path: sorted[0].storage_path,
        versions: sorted,
        latestVersion: sorted[0].version,
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function HistoryWorkspace() {
  const { status, tier } = useAuth();
  const isPremium = tier?.toLowerCase() === "premium";
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selected, setSelected] = useState<SelectedVersion | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [analysisState, setAnalysisState] = useState<LoadState>("idle");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const listControllerRef = useRef<AbortController | null>(null);
  const analysisControllerRef = useRef<AbortController | null>(null);
  const loadIdRef = useRef(0);

  const groups = useMemo(() => groupResumes(resumes), [resumes]);

  const loadResumes = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    listControllerRef.current?.abort();
    const controller = new AbortController();
    listControllerRef.current = controller;

    const options: AuthOptions = {
      signal: controller.signal,
      timeout: 10_000,
    };

    setLoadState("loading");
    const nextResumes = await getResumes(options);

    if (controller.signal.aborted || listControllerRef.current !== controller) {
      return;
    }
    if (loadIdRef.current !== loadId) return;

    setResumes(nextResumes ?? []);
    setLoadState(nextResumes ? "ready" : "error");
    listControllerRef.current = null;
  }, []);

  const loadAnalysis = useCallback(
    async (resume: Resume) => {
      analysisControllerRef.current?.abort();
      const controller = new AbortController();
      analysisControllerRef.current = controller;

      const options: AuthOptions = {
        signal: controller.signal,
        timeout: 10_000,
      };

      setSelected({
        resumeId: resume.resume_id,
        storage_path: resume.storage_path,
        version: resume.version,
        filename: resume.filename,
        updatedWithOptimizer: Boolean(resume.updated_with_optimizer),
      });
      setAnalysis(null);
      setAnalysisState("loading");

      const detail = await getResume(resume.resume_id, resume.version, options);

      if (
        controller.signal.aborted ||
        analysisControllerRef.current !== controller
      ) {
        return;
      }

      const nextAnalysis = asRecord(detail?.analysis);
      const hasAnalysis = Object.keys(nextAnalysis).length > 0;
      setAnalysis(
        hasAnalysis
          ? {
              ...nextAnalysis,
              resume_filename: resume.filename,
            }
          : null,
      );
      setAnalysisState(hasAnalysis ? "ready" : "error");
      analysisControllerRef.current = null;
    },
    [],
  );

  const closeAnalysis = useCallback(() => {
    analysisControllerRef.current?.abort();
    analysisControllerRef.current = null;
    setSelected(null);
    setAnalysis(null);
    setAnalysisState("idle");
  }, []);

  const onDelete = useCallback(
    async (resume: Resume, isLatest: boolean) => {
      if (isLatest) return;
      const confirmed = window.confirm(
        `Delete version ${resume.version} of ${resume.filename}? The latest version has to stay.`,
      );
      if (!confirmed) return;

      const key = versionKey(resume.resume_id, resume.version);
      setDeletingKey(key);
      const ok = await deleteResume(resume.resume_id, resume.version);
      setDeletingKey(null);
      if (!ok) return;

      toast.success(`Deleted version ${resume.version} of ${resume.filename}.`);
      setResumes((current) =>
        current.filter(
          (item) =>
            !(
              item.resume_id === resume.resume_id &&
              item.version === resume.version
            ),
        ),
      );
      if (
        selected?.resumeId === resume.resume_id &&
        selected.version === resume.version
      ) {
        closeAnalysis();
      }
    },
    [closeAnalysis, selected],
  );

  useEffect(() => {
    return () => {
      listControllerRef.current?.abort();
      analysisControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status.status !== "authenticated") return;
    void loadResumes();
  }, [status, loadResumes]);

  if (status.status === "loading") {
    return (
      <div className="account-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  if (status.status === "unauthenticated") {
    return (
      <section className="account-pane account-gate" aria-labelledby="history-gate-title">
        <p className="account-pane-kicker">Account required</p>
        <h2 id="history-gate-title" className="account-pane-title">
          Sign in to see resume history
        </h2>
        <p className="account-pane-lead">
          Premium analyses are saved to your account. Log in to review past
          runs and older versions.
        </p>
        <div className="account-gate-actions">
          <Link href="/login" className="mkt-btn mkt-btn-primary">
            Log in
          </Link>
          <Link href="/register" className="mkt-btn mkt-btn-ghost">
            Create account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="account-pane history-pane" aria-labelledby="history-title">
      <div className="history-head">
        <div>
          <p className="account-pane-kicker">Resume history</p>
          <h2 id="history-title" className="account-pane-title">
            Saved premium analyses
          </h2>
          <p className="account-pane-lead">
            Each file keeps its versions. Reopen a full fit report anytime, and
            delete older versions — the latest one stays. Optimized means that
            version was overwritten with the accepted rewrite.
          </p>
        </div>
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost history-refresh"
          disabled={loadState === "loading"}
          onClick={() => {
            void loadResumes();
          }}
        >
          {loadState === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loadState === "loading" && resumes.length === 0 ? (
        <div className="account-status" aria-busy="true">
          Loading your history…
        </div>
      ) : loadState === "error" && resumes.length === 0 ? (
        <div className="account-status account-status-error" role="alert">
          <p>We could not load your history right now. Try again in a moment.</p>
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            onClick={() => {
              void loadResumes();
            }}
          >
            Try again
          </button>
        </div>
      ) : groups.length === 0 ? (
        <div className="history-empty">
          <p className="history-empty-title">No saved resumes yet</p>
          <p className="account-pane-lead">
            {isPremium
              ? "Run a premium analysis and it will show up here."
              : "History is saved on Premium analyses. Upgrade, then run the analyzer to start a trail."}
          </p>
          <div className="account-gate-actions">
            <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
              Open analyzer
            </Link>
            {!isPremium ? (
              <Link href="/plans" className="mkt-btn mkt-btn-ghost">
                Upgrade to Premium
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="history-groups">
          {groups.map((group) => (
            <article key={group.resumeId} className="history-group">
              <div className="history-group-head">
                <h3 className="history-filename">{group.filename}</h3>
                <p className="history-group-meta">
                  {group.versions.length}{" "}
                  {group.versions.length === 1 ? "version" : "versions"}
                </p>
              </div>
              <ul className="history-version-list">
                {group.versions.map((resume) => {
                  const isLatest = resume.version === group.latestVersion;
                  const isSelected =
                    selected?.resumeId === resume.resume_id &&
                    selected.version === resume.version;
                  const key = versionKey(resume.resume_id, resume.version);
                  const deleting = deletingKey === key;
                  const viewing =
                    isSelected && analysisState === "loading";
                  const optimized = Boolean(resume.updated_with_optimizer);
                  const showPanel = isSelected && analysisState !== "idle";

                  return (
                    <li
                      key={key}
                      className={`history-version${isSelected ? " is-selected" : ""}${showPanel ? " is-expanded" : ""}`}
                    >
                      <div className="history-version-row">
                        <div className="history-version-copy">
                          <p className="history-version-label">
                            <a
                              href={resume.storage_path}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Version {resume.version}
                            </a>
                          </p>
                          {isLatest ? (
                            <span className="history-latest-badge">Latest</span>
                          ) : null}
                          {optimized ? (
                            <span className="history-optimized-badge">Optimized</span>
                          ) : null}
                        </div>
                        <div className="history-version-actions">
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-ghost"
                            disabled={viewing}
                            aria-expanded={showPanel}
                            onClick={() => {
                              if (isSelected) {
                                closeAnalysis();
                                return;
                              }
                              void loadAnalysis(resume);
                            }}
                          >
                            {viewing
                              ? "Opening…"
                              : isSelected
                                ? "Hide analysis"
                                : "View analysis"}
                          </button>
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-ghost history-delete"
                            disabled={isLatest || deleting}
                            title={
                              isLatest
                                ? "The latest version has to stay"
                                : `Delete version ${resume.version}`
                            }
                            onClick={() => {
                              void onDelete(resume, isLatest);
                            }}
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>

                      {showPanel ? (
                        <div className="history-version-panel">
                          {analysisState === "loading" ? (
                            <div className="account-status" aria-busy="true">
                              Opening this analysis…
                            </div>
                          ) : null}

                          {analysisState === "error" ? (
                            <div
                              className="account-status account-status-error"
                              role="alert"
                            >
                              <p>
                                We could not open that analysis. Try again in a
                                moment.
                              </p>
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-primary"
                                onClick={() => {
                                  void loadAnalysis(resume);
                                }}
                              >
                                Try again
                              </button>
                            </div>
                          ) : null}

                          {analysisState === "ready" && analysis ? (
                            <div className="history-analysis-shell">
                              {selected?.updatedWithOptimizer ? (
                                <div className="history-analysis-banner">
                                  <p className="history-analysis-banner-meta">
                                    Optimized overwrite applied to this version
                                  </p>
                                  <span className="history-optimized-badge">
                                    Optimized
                                  </span>
                                </div>
                              ) : null}
                              <AnalyzerResults
                                result={analysis}
                                againLabel="Hide analysis"
                                showTtlWarning={false}
                                onAnalyzeAgain={closeAnalysis}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
