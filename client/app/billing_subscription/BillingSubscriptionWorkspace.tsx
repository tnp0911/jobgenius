"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthOptions } from "@/auth/types";
import {
  getAnalyzerUsage,
  getJobFinderUsage,
  type UsageResponse,
} from "@/services/usageService";

const ANALYZER_FALLBACK_LIMIT = 3;
const JOB_FINDER_FALLBACK_LIMIT = 1;

type LoadState = "idle" | "loading" | "ready" | "error";

type MeterKind = "analyzer" | "job-finder";

function normalizeUsage(
  data: UsageResponse | null,
  fallbackLimit: number,
): UsageResponse | null {
  if (!data) return null;
  const usage = Number.isFinite(data.usage) ? Math.max(0, data.usage) : 0;
  const remaining_time = Number.isFinite(data.remaining_time)
    ? data.remaining_time
    : 0;
  const max_limit =
    Number.isFinite(data.max_limit) && data.max_limit > 0
      ? data.max_limit
      : fallbackLimit;
  return { usage, remaining_time, max_limit };
}

function formatRemainingTime(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && parts.length < 2) parts.push(`${minutes}m`);
  return parts.join(" ") || "less than a minute";
}

function meterCopy(kind: MeterKind, isPremium: boolean) {
  if (kind === "analyzer") {
    return {
      kicker: "R-Analyzer",
      title: "Resume analyses",
      window: isPremium ? "3 analyses each day" : "3 analyses each week",
      href: "/analyzer",
      action: "Open analyzer",
    };
  }
  return {
    kicker: "J-Recommender",
    title: "Prompt job search",
    window: isPremium
      ? "1 prompt search every 3 days"
      : "1 prompt search every 15 days",
    href: "/jrecommender",
    action: "Open job finder",
  };
}

function UsageMeterCard({
  kind,
  data,
  isPremium,
}: {
  kind: MeterKind;
  data: UsageResponse | null;
  isPremium: boolean;
}) {
  const copy = meterCopy(kind, isPremium);

  if (!data) {
    return (
      <article className="billing-meter" aria-labelledby={`billing-${kind}-title`}>
        <div className="billing-meter-head">
          <p className="billing-pane-kicker">{copy.kicker}</p>
          <h3 id={`billing-${kind}-title`} className="billing-meter-title">
            {copy.title}
          </h3>
          <p className="billing-meter-window">{copy.window}</p>
        </div>
        <p className="billing-meter-reset" role="alert">
          Could not load this meter. Refresh to try again.
        </p>
        <Link href={copy.href} className="mkt-btn mkt-btn-ghost billing-meter-link">
          {copy.action}
        </Link>
      </article>
    );
  }

  const used = data.usage;
  const limit = data.max_limit;
  const remainingRuns = Math.max(0, limit - used);
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const percent = Math.round(ratio * 100);
  const resetLabel = formatRemainingTime(data.remaining_time);
  const exhausted = remainingRuns === 0 && used > 0;
  const barTone = exhausted ? "is-full" : ratio >= 0.7 ? "is-warm" : "";

  let resetCopy: string;
  if (resetLabel) {
    resetCopy = exhausted
      ? `Allowance used. Resets in ${resetLabel}.`
      : `Window resets in ${resetLabel}.`;
  } else if (used === 0) {
    resetCopy = "Full allowance — the reset clock starts on your next run.";
  } else {
    resetCopy = "Reset timing is not available for this window.";
  }

  return (
    <article className="billing-meter" aria-labelledby={`billing-${kind}-title`}>
      <div className="billing-meter-head">
        <p className="billing-pane-kicker">{copy.kicker}</p>
        <h3 id={`billing-${kind}-title`} className="billing-meter-title">
          {copy.title}
        </h3>
        <p className="billing-meter-window">{copy.window}</p>
      </div>

      <div
        className="billing-meter-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label={`${copy.title}: ${used} of ${limit} used`}
      >
        <span
          className={`billing-meter-fill ${barTone}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="billing-meter-stats">
        <p className="billing-meter-count">
          <strong>{used}</strong>
          <span> of {limit} used</span>
        </p>
        <p className={`billing-meter-left${exhausted ? " is-empty" : ""}`}>
          {exhausted ? "None left" : `${remainingRuns} left`}
        </p>
      </div>

      <p className="billing-meter-reset">{resetCopy}</p>

      <Link href={copy.href} className="mkt-btn mkt-btn-ghost billing-meter-link">
        {copy.action}
      </Link>
    </article>
  );
}

export function BillingSubscriptionWorkspace() {
  const { status, tier } = useAuth();
  const isPremium = tier?.toLowerCase() === "premium";
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [analyzerUsage, setAnalyzerUsage] = useState<UsageResponse | null>(null);
  const [jobFinderUsage, setJobFinderUsage] = useState<UsageResponse | null>(null);
  const analyzerControllerRef = useRef<AbortController | null>(null);
  const jobFinderControllerRef = useRef<AbortController | null>(null);
  const loadIdRef = useRef(0);

  const loadAnalyzerUsage = useCallback(async () => {
    analyzerControllerRef.current?.abort();
    const controller = new AbortController();
    analyzerControllerRef.current = controller;

    const options: AuthOptions = {
      signal: controller.signal,
      timeout: 15_000,
    };

    try {
      const analyzer = await getAnalyzerUsage(options);
      if (controller.signal.aborted || analyzerControllerRef.current !== controller) {
        return null;
      }
      const nextAnalyzer = normalizeUsage(analyzer, ANALYZER_FALLBACK_LIMIT);
      setAnalyzerUsage(nextAnalyzer);
      return nextAnalyzer;
    } catch {
      if (controller.signal.aborted || analyzerControllerRef.current !== controller) {
        return null;
      }
      setAnalyzerUsage(null);
      return null;
    } finally {
      if (analyzerControllerRef.current === controller) {
        analyzerControllerRef.current = null;
      }
    }
  }, []);

  const loadJobFinderUsage = useCallback(async () => {
    jobFinderControllerRef.current?.abort();
    const controller = new AbortController();
    jobFinderControllerRef.current = controller;

    const options: AuthOptions = {
      signal: controller.signal,
      timeout: 15_000,
    };

    try {
      const jobFinder = await getJobFinderUsage(options);
      if (controller.signal.aborted || jobFinderControllerRef.current !== controller) {
        return null;
      }
      const nextJobFinder = normalizeUsage(jobFinder, JOB_FINDER_FALLBACK_LIMIT);
      setJobFinderUsage(nextJobFinder);
      return nextJobFinder;
    } catch {
      if (controller.signal.aborted || jobFinderControllerRef.current !== controller) {
        return null;
      }
      setJobFinderUsage(null);
      return null;
    } finally {
      if (jobFinderControllerRef.current === controller) {
        jobFinderControllerRef.current = null;
      }
    }
  }, []);

  const loadUsage = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoadState("loading");
    const [nextAnalyzer, nextJobFinder] = await Promise.all([
      loadAnalyzerUsage(),
      loadJobFinderUsage(),
    ]);

    if (loadIdRef.current !== loadId) return;

    setLoadState(nextAnalyzer || nextJobFinder ? "ready" : "error");
  }, [loadAnalyzerUsage, loadJobFinderUsage]);

  useEffect(() => {
    return () => {
      analyzerControllerRef.current?.abort();
      jobFinderControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadUsage();
  }, [status, loadUsage]);

  if (status === "loading") {
    return (
      <div className="billing-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <section className="billing-gate" aria-labelledby="billing-gate-title">
        <p className="billing-pane-kicker">Account required</p>
        <h2 id="billing-gate-title" className="billing-pane-title">
          Sign in to see your usage
        </h2>
        <p className="billing-pane-lead">
          Analyzer and job-finder allowances live with your JobGenius account.
          Log in to view what you have left this window.
        </p>
        <div className="billing-gate-actions">
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

  const planLabel = isPremium ? "Premium" : "Basic";
  const planLead = isPremium
    ? "Deeper coaching, a daily analyzer window, and a faster job-finder cadence."
    : "Honest resume reads and a quieter job-finder cadence — upgrade when the stakes get real.";

  return (
    <div className="billing-workspace">
      <section className="billing-plan" aria-labelledby="billing-plan-title">
        <div className="billing-plan-copy">
          <p className="billing-pane-kicker">Current plan</p>
          <h2 id="billing-plan-title" className="billing-pane-title">
            {planLabel}
          </h2>
          <p className="billing-pane-lead">{planLead}</p>
        </div>
        <div className="billing-plan-aside">
          <p className={`billing-plan-badge${isPremium ? " is-premium" : ""}`}>
            {isPremium ? "Active" : "Forever"}
          </p>
          {isPremium ? (
            <p className="billing-plan-price">CAD $20 / month</p>
          ) : (
            <Link href="/plans" className="mkt-btn mkt-btn-primary">
              Upgrade to Premium
            </Link>
          )}
        </div>
      </section>

      <section className="billing-usage" aria-labelledby="billing-usage-title">
        <div className="billing-usage-head">
          <div>
            <p className="billing-pane-kicker">Usage this window</p>
            <h2 id="billing-usage-title" className="billing-pane-title">
              How much runway you have
            </h2>
            <p className="billing-pane-lead">
              Counts come from your signed-in account. Refresh after a run if
              the meters look stale.
            </p>
          </div>
          <button
            type="button"
            className="mkt-btn mkt-btn-ghost billing-refresh"
            disabled={loadState === "loading"}
            onClick={() => {
              void loadUsage();
            }}
          >
            {loadState === "loading" ? "Refreshing…" : "Refresh usage"}
          </button>
        </div>

        {loadState === "loading" && !analyzerUsage && !jobFinderUsage ? (
          <div className="billing-status" aria-busy="true">
            Loading your usage…
          </div>
        ) : loadState === "error" ? (
          <div className="billing-status billing-status-error" role="alert">
            <p>We could not load usage right now. Try again in a moment.</p>
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              onClick={() => {
                void loadUsage();
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="billing-meter-grid">
            <UsageMeterCard
              kind="analyzer"
              data={analyzerUsage}
              isPremium={isPremium}
            />
            <UsageMeterCard
              kind="job-finder"
              data={jobFinderUsage}
              isPremium={isPremium}
            />
          </div>
        )}
      </section>
    </div>
  );
}
