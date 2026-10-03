"use client";

import { useEffect, useState } from "react";

const DISCLAIMERS = [
  "This resume analyzer is for general guidance — not a guarantee of interviews or offers.",
  "ATS systems vary widely. Each company configures parsing, keywords, and knockouts differently.",
  "A strong human read still matters. Recruiters and hiring managers apply their own judgment.",
  "JobGenius highlights signals and gaps. It does not replace your voice, story, or decisions.",
  "Formats, scanners, and portals differ. What parses cleanly in one system may struggle in another.",
  "Use the feedback as a compass: clearer structure, sharper evidence, better role fit.",
] as const;

const STATUS_LINES = [
  "Reading resume structure…",
  "Mapping skills to the brief…",
  "Checking clarity and gaps…",
  "Preparing your notes…",
] as const;

type AnalyzerLoadingProps = {
  fileName?: string;
  /** When set (0–100), drives the ring instead of the fake timer. */
  progress?: number;
  statusText?: string;
};

export function AnalyzerLoading({
  fileName,
  progress: progressProp,
  statusText,
}: AnalyzerLoadingProps) {
  const controlled = typeof progressProp === "number";
  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(controlled ? progressProp : 8);

  useEffect(() => {
    if (controlled) {
      setProgress(Math.min(100, Math.max(0, progressProp)));
    }
  }, [controlled, progressProp]);

  useEffect(() => {
    const disclaimerTimer = window.setInterval(() => {
      setDisclaimerIndex((i) => (i + 1) % DISCLAIMERS.length);
    }, 5000);

    const statusTimer = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 3000);

    let progressTimer: number | undefined;
    if (!controlled) {
      progressTimer = window.setInterval(() => {
        setProgress((p) => {
          if (p >= 92) return 88 + Math.random() * 4;
          return Math.min(92, p + 2 + Math.random() * 5);
        });
      }, 1500);
    }

    return () => {
      window.clearInterval(disclaimerTimer);
      window.clearInterval(statusTimer);
      if (progressTimer !== undefined) {
        window.clearInterval(progressTimer);
      }
    };
  }, [controlled]);

  const shownProgress = Math.round(progress);

  return (
    <div className="analyzer-loading" aria-busy="true" aria-live="polite">
      <p className="analyzer-loading-kicker">JobGenius · Analyzer</p>
      <h2 className="analyzer-loading-title">Working on your fit</h2>
      {fileName ? (
        <p className="analyzer-loading-file">
          Analyzing <span>{fileName}</span>
        </p>
      ) : null}
      <p className="analyzer-loading-status">
        {statusText ?? STATUS_LINES[statusIndex]}
      </p>

      <div
        className="analyzer-loading-ring"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shownProgress}
        aria-label="Analysis progress"
      >
        <svg viewBox="0 0 120 120" className="analyzer-loading-ring-svg" aria-hidden="true">
          <circle className="analyzer-loading-ring-track" cx="60" cy="60" r="52" />
          <circle
            className="analyzer-loading-ring-value"
            cx="60"
            cy="60"
            r="52"
            style={{
              strokeDasharray: `${2 * Math.PI * 52}`,
              strokeDashoffset: `${2 * Math.PI * 52 * (1 - shownProgress / 100)}`,
            }}
          />
        </svg>
        <span className="analyzer-loading-ring-label">{shownProgress}%</span>
      </div>

      <div className="analyzer-loading-disclaimer">
        <p key={disclaimerIndex} className="analyzer-loading-disclaimer-text">
          {DISCLAIMERS[disclaimerIndex]}
        </p>
        <div className="analyzer-loading-disclaimer-dots" aria-hidden="true">
          {DISCLAIMERS.map((line, i) => (
            <span
              key={line}
              className={`analyzer-loading-dot${i === disclaimerIndex ? " is-active" : ""}`}
            />
          ))}
        </div>
      </div>

      <p className="analyzer-loading-footnote">
        {controlled
          ? "Premium analysis can take a bit longer. Keep this tab open while we stream progress."
          : "Hang tight — this usually takes under a minute. Keep this tab open."}
      </p>
    </div>
  );
}
