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

function ScoreChip({ label, value }: { label: string; value: unknown }) {
  const pct = scorePercent(value);
  if (pct === null) return null;
  return (
    <div className="history-score-chip">
      <span className="history-score-chip-value">{pct}</span>
      <span className="history-score-chip-label">{label}</span>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="history-tag-list">
      {items.map((item) => (
        <li key={item} className="history-tag">
          {item}
        </li>
      ))}
    </ul>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <section className="history-analysis-block">
      <h4 className="history-analysis-block-title">{title}</h4>
      <p className="history-analysis-prose">{text}</p>
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="history-analysis-block">
      <h4 className="history-analysis-block-title">{title}</h4>
      <ol className="history-analysis-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function HistoryAnalysis({
  filename,
  version,
  analysis,
  onClose,
}: {
  filename: string;
  version: number;
  storage_path: string;
  analysis: Record<string, unknown>;
  onClose: () => void;
}) {
  const targetRole = asString(analysis.target_role);
  const seniority = asString(analysis.seniority_level);
  const industry = asString(analysis.industry);
  const meta = [seniority, industry].filter(Boolean).join(" · ");
  const hardSkills = asStringList(analysis.hard_skills);
  const softSkills = asStringList(analysis.soft_skills);
  const missingHard = asStringList(analysis.missing_hard_skills);
  const missingSoft = asStringList(analysis.missing_soft_skills);
  const keywords = asStringList(analysis.top_keywords);
  const hasSkillTags =
    hardSkills.length +
      softSkills.length +
      missingHard.length +
      missingSoft.length +
      keywords.length >
    0;

  return (
    <article className="history-analysis" aria-labelledby="history-analysis-title">
      <div className="history-analysis-head">
        <div>
          <p className="account-pane-kicker">Saved analysis</p>
          <h3 id="history-analysis-title" className="history-analysis-title">
            {targetRole || filename}
          </h3>
          <p className="history-analysis-meta">
            Version {version}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <button type="button" className="mkt-btn mkt-btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="history-score-row" aria-label="Scores">
        <ScoreChip label="Resume quality" value={analysis.resume_score} />
        <ScoreChip label="ATS fit" value={analysis.ats_score} />
        <ScoreChip label="Sections" value={analysis.section_score} />
        <ScoreChip label="Skills quality" value={analysis.skills_quality_score} />
        <ScoreChip
          label="Hard skills match"
          value={analysis.matching_hard_skills_score}
        />
        <ScoreChip
          label="Soft skills match"
          value={analysis.matching_soft_skills_score}
        />
      </div>

      <TextBlock title="Summary" text={asString(analysis.summary)} />

      <div className="history-analysis-grid">
        <TextBlock title="Skills" text={asString(analysis.skills_feedback)} />
        <TextBlock
          title="Experience"
          text={asString(analysis.experience_feedback)}
        />
        <TextBlock
          title="Structure"
          text={asString(analysis.structure_feedback)}
        />
      </div>

      <ListBlock
        title="Next steps"
        items={asStringList(analysis.simple_suggestions)}
      />
      <ListBlock
        title="Priority action plan"
        items={asStringList(analysis.priority_action_plan)}
      />
      <ListBlock
        title="Interview talking points"
        items={asStringList(analysis.interview_talking_points)}
      />

      {hasSkillTags ? (
        <div className="history-analysis-grid">
          {hardSkills.length > 0 ? (
            <section className="history-analysis-block">
              <h4 className="history-analysis-block-title">Hard skills</h4>
              <TagList items={hardSkills} />
            </section>
          ) : null}
          {softSkills.length > 0 ? (
            <section className="history-analysis-block">
              <h4 className="history-analysis-block-title">Soft skills</h4>
              <TagList items={softSkills} />
            </section>
          ) : null}
          {missingHard.length > 0 ? (
            <section className="history-analysis-block">
              <h4 className="history-analysis-block-title">Missing vs job (hard)</h4>
              <TagList items={missingHard} />
            </section>
          ) : null}
          {missingSoft.length > 0 ? (
            <section className="history-analysis-block">
              <h4 className="history-analysis-block-title">Missing vs job (soft)</h4>
              <TagList items={missingSoft} />
            </section>
          ) : null}
          {keywords.length > 0 ? (
            <section className="history-analysis-block">
              <h4 className="history-analysis-block-title">Keywords</h4>
              <TagList items={keywords} />
            </section>
          ) : null}
        </div>
      ) : null}

      <TextBlock
        title="Recruiter lens"
        text={asString(analysis.recruiter_lens)}
      />
      <TextBlock
        title="Optimized draft"
        text={asString(analysis.optimized_resume)}
      />
    </article>
  );
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
    async (resumeId: string, storage_path: string, version: number) => {
      analysisControllerRef.current?.abort();
      const controller = new AbortController();
      analysisControllerRef.current = controller;

      const options: AuthOptions = {
        signal: controller.signal,
        timeout: 10_000,
      };

      setSelected({ resumeId, storage_path, version });
      setAnalysis(null);
      setAnalysisState("loading");

      const detail = await getResume(resumeId, version, options);

      if (
        controller.signal.aborted ||
        analysisControllerRef.current !== controller
      ) {
        return;
      }

      const nextAnalysis = asRecord(detail?.analysis);
      const hasAnalysis = Object.keys(nextAnalysis).length > 0;
      setAnalysis(hasAnalysis ? nextAnalysis : null);
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
    if (status !== "authenticated") return;
    void loadResumes();
  }, [status, loadResumes]);

  if (status === "loading") {
    return (
      <div className="account-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  if (status === "unauthenticated") {
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
            Each file keeps its versions. You can reopen an analysis anytime,
            and delete older versions — the latest one stays.
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

                  return (
                    <li
                      key={key}
                      className={`history-version${isSelected ? " is-selected" : ""}`}
                    >
                      <div className="history-version-copy">
                        <p className="history-version-label">
                          <a href={resume.storage_path} target="_blank">Version {resume.version}</a>
                        </p>
                        {isLatest ? (
                          <span className="history-latest-badge">Latest</span>
                        ) : null}
                      </div>
                      <div className="history-version-actions">
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-ghost"
                          disabled={viewing}
                          onClick={() => {
                            void loadAnalysis(resume.resume_id, resume.storage_path, resume.version);
                          }}
                        >
                          {viewing ? "Opening…" : "View analysis"}
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
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}

      {selected && analysisState === "loading" ? (
        <div className="account-status" aria-busy="true">
          Opening this analysis…
        </div>
      ) : null}

      {selected && analysisState === "error" ? (
        <div className="account-status account-status-error" role="alert">
          <p>We could not open that analysis. Try again in a moment.</p>
          <button
            type="button"
            className="mkt-btn mkt-btn-primary"
            onClick={() => {
              void loadAnalysis(selected.resumeId, selected.storage_path, selected.version);
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {selected && analysis ? (
        <HistoryAnalysis
          storage_path={selected.storage_path}
          filename={
            groups.find((group) => group.resumeId === selected.resumeId)
              ?.filename ?? "Resume"
          }
          version={selected.version}
          analysis={analysis}
          onClose={closeAnalysis}
        />
      ) : null}
    </section>
  );
}
