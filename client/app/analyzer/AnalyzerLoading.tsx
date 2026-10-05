"use client";

import { useEffect, useRef, useState } from "react";

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
  /**
   * Server/SSE progress (0–100). Used as a floor; the ring still eases upward
   * with a fake timer so mid-analysis doesn't look frozen between events.
   */
  progress?: number;
  statusText?: string;
};

export function AnalyzerLoading({
  fileName,
  progress: progressProp,
  statusText,
}: AnalyzerLoadingProps) {
  const controlled = typeof progressProp === "number";
  const serverFloor = controlled
    ? Math.min(100, Math.max(0, progressProp))
    : 0;
  const serverFloorRef = useRef(serverFloor);
  serverFloorRef.current = serverFloor;

  const [disclaimerIndex, setDisclaimerIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(controlled ? serverFloor : 8);

  // Snap up when SSE reports a higher value; never drop below the server floor.
  useEffect(() => {
    if (!controlled) return;
    setProgress((p) => Math.max(p, serverFloor));
  }, [controlled, serverFloor]);

  useEffect(() => {
    const disclaimerTimer = window.setInterval(() => {
      setDisclaimerIndex((i) => (i + 1) % DISCLAIMERS.length);
    }, 5000);

    const statusTimer = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_LINES.length);
    }, 3000);

    const progressTimer = window.setInterval(() => {
      const floor = serverFloorRef.current;
      setProgress((p) => {
        // Done — lock to 100 once the server says so.
        if (controlled && floor >= 100) return 100;

        // Mid-analysis: ease slowly so the ring keeps moving.
        if (p >= 30 && p <= 89) {
          const next = p + 1.2 + Math.random() * 2.5;
          // Controlled: don't race ahead of reality past ~94 until SSE catches up.
          if (controlled) return Math.min(94, Math.max(next, floor));
          return next;
        }

        if (p >= 92) {
          if (controlled) return Math.max(floor, Math.min(96, p));
          return 88 + Math.random() * 4;
        }

        const next = Math.min(92, p + 2 + Math.random() * 5);
        return controlled ? Math.max(next, floor) : next;
      });
    }, 3000);

    return () => {
      window.clearInterval(disclaimerTimer);
      window.clearInterval(statusTimer);
      window.clearInterval(progressTimer);
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
