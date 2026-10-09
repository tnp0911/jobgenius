"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { AuthOptions } from "@/auth/types";
import {
  cancelSubscription,
  changePaymentMethod,
  getInvoiceHostedUrl,
  getInvoices,
  getNextBillingDate,
} from "@/services/paymentService";
import {
  getAnalyzerUsage,
  getJobFinderUsage,
  type UsageResponse,
} from "@/services/usageService";

const ANALYZER_FALLBACK_LIMIT = 3;
const JOB_FINDER_FALLBACK_LIMIT = 1;

type LoadState = "idle" | "loading" | "ready" | "error";

type MeterKind = "analyzer" | "job-finder";

function formatBillingDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

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
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [billingLoadState, setBillingLoadState] = useState<LoadState>("idle");
  const [invoices, setInvoices] = useState<string[]>([]);
  const [invoicesLoadState, setInvoicesLoadState] = useState<LoadState>("idle");
  const [paymentMethodBusy, setPaymentMethodBusy] = useState(false);
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const analyzerControllerRef = useRef<AbortController | null>(null);
  const jobFinderControllerRef = useRef<AbortController | null>(null);
  const billingControllerRef = useRef<AbortController | null>(null);
  const invoicesControllerRef = useRef<AbortController | null>(null);
  const paymentMethodControllerRef = useRef<AbortController | null>(null);
  const invoiceOpenControllerRef = useRef<AbortController | null>(null);
  const cancelControllerRef = useRef<AbortController | null>(null);
  const loadIdRef = useRef(0);
  const billingLoadIdRef = useRef(0);

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

  const loadPremiumBilling = useCallback(async () => {
    const loadId = ++billingLoadIdRef.current;
    billingControllerRef.current?.abort();
    invoicesControllerRef.current?.abort();

    const billingController = new AbortController();
    const invoicesController = new AbortController();
    billingControllerRef.current = billingController;
    invoicesControllerRef.current = invoicesController;

    setBillingLoadState("loading");
    setInvoicesLoadState("loading");

    const options: AuthOptions = {
      signal: billingController.signal,
      timeout: 15_000,
    };
    const invoiceOptions: AuthOptions = {
      signal: invoicesController.signal,
      timeout: 15_000,
    };

    const [billingInfo, invoiceIds] = await Promise.all([
      getNextBillingDate(options),
      getInvoices(invoiceOptions),
    ]);

    if (billingLoadIdRef.current !== loadId) return;

    if (!billingController.signal.aborted) {
      setNextBillingDate(billingInfo?.nextBillingDate ?? null);
      setCancelAtPeriodEnd(billingInfo?.cancelAtPeriodEnd ?? false);
      setBillingLoadState(billingInfo?.nextBillingDate ? "ready" : "error");
    }

    if (!invoicesController.signal.aborted) {
      if (invoiceIds) {
        setInvoices(invoiceIds);
        setInvoicesLoadState("ready");
      } else {
        setInvoices([]);
        setInvoicesLoadState("error");
      }
    }

    if (billingControllerRef.current === billingController) {
      billingControllerRef.current = null;
    }
    if (invoicesControllerRef.current === invoicesController) {
      invoicesControllerRef.current = null;
    }
  }, []);

  const onChangePaymentMethod = useCallback(async () => {
    paymentMethodControllerRef.current?.abort();
    const controller = new AbortController();
    paymentMethodControllerRef.current = controller;
    setPaymentMethodBusy(true);

    try {
      const url = await changePaymentMethod({
        signal: controller.signal,
        timeout: 15_000,
      });
      if (controller.signal.aborted || paymentMethodControllerRef.current !== controller) {
        return;
      }
      if (!url) {
        setPaymentMethodBusy(false);
        return;
      }
      window.location.href = url;
    } catch (error) {
      if (controller.signal.aborted || paymentMethodControllerRef.current !== controller) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Could not start payment method update.";
      toast.error(message);
      setPaymentMethodBusy(false);
    } finally {
      if (paymentMethodControllerRef.current === controller) {
        paymentMethodControllerRef.current = null;
      }
    }
  }, []);

  const onConfirmCancelSubscription = useCallback(async () => {
    cancelControllerRef.current?.abort();
    const controller = new AbortController();
    cancelControllerRef.current = controller;
    setCancelBusy(true);

    try {
      const message = await cancelSubscription({
        signal: controller.signal,
        timeout: 15_000,
      });
      if (controller.signal.aborted || cancelControllerRef.current !== controller) {
        return;
      }
      if (!message) {
        setCancelBusy(false);
        return;
      }
      toast.success(message);
      setCancelAtPeriodEnd(true);
      setCancelModalOpen(false);
      setCancelBusy(false);
      void loadPremiumBilling();
    } catch (error) {
      if (controller.signal.aborted || cancelControllerRef.current !== controller) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Could not cancel subscription.";
      toast.error(message);
      setCancelBusy(false);
    } finally {
      if (cancelControllerRef.current === controller) {
        cancelControllerRef.current = null;
      }
    }
  }, [loadPremiumBilling]);

  const onOpenInvoice = useCallback(async (invoiceId: string) => {
    invoiceOpenControllerRef.current?.abort();
    const controller = new AbortController();
    invoiceOpenControllerRef.current = controller;
    setOpeningInvoiceId(invoiceId);

    try {
      const url = await getInvoiceHostedUrl(invoiceId, {
        signal: controller.signal,
        timeout: 15_000,
      });
      if (controller.signal.aborted || invoiceOpenControllerRef.current !== controller) {
        return;
      }
      if (!url) {
        toast.error("This invoice does not have a hosted page yet.");
        setOpeningInvoiceId(null);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      setOpeningInvoiceId(null);
    } catch (error) {
      if (controller.signal.aborted || invoiceOpenControllerRef.current !== controller) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Could not open invoice.";
      toast.error(message);
      setOpeningInvoiceId(null);
    } finally {
      if (invoiceOpenControllerRef.current === controller) {
        invoiceOpenControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      analyzerControllerRef.current?.abort();
      jobFinderControllerRef.current?.abort();
      billingControllerRef.current?.abort();
      invoicesControllerRef.current?.abort();
      paymentMethodControllerRef.current?.abort();
      invoiceOpenControllerRef.current?.abort();
      cancelControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!cancelModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !cancelBusy) {
        setCancelModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [cancelModalOpen, cancelBusy]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadUsage();
  }, [status, loadUsage]);

  useEffect(() => {
    if (status !== "authenticated" || !isPremium) {
      setNextBillingDate(null);
      setCancelAtPeriodEnd(false);
      setInvoices([]);
      setBillingLoadState("idle");
      setInvoicesLoadState("idle");
      return;
    }
    void loadPremiumBilling();
  }, [status, isPremium, loadPremiumBilling]);

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
  const nextBillingLabel = formatBillingDate(nextBillingDate);

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
            <>
              <p className="billing-plan-price">
                {billingLoadState === "loading"
                  ? "Loading billing details…"
                  : nextBillingLabel
                    ? cancelAtPeriodEnd
                      ? `Access until: ${nextBillingLabel}`
                      : `Next billing date: ${nextBillingLabel}`
                    : cancelAtPeriodEnd
                      ? "Subscription canceled"
                      : "Next billing date unavailable"}
              </p>
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost billing-cancel-btn"
                disabled={cancelAtPeriodEnd}
                onClick={() => {
                  setCancelModalOpen(true);
                }}
              >
                {cancelAtPeriodEnd ? "Cancellation scheduled" : "Cancel subscription"}
              </button>
            </>
          ) : (
            <Link href="/plans" className="mkt-btn mkt-btn-primary">
              Upgrade to Premium
            </Link>
          )}
        </div>
      </section>

      {cancelModalOpen ? (
        <div
          className="billing-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!cancelBusy) setCancelModalOpen(false);
          }}
        >
          <div
            className="billing-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="billing-cancel-title"
            aria-describedby="billing-cancel-desc"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <p className="billing-pane-kicker">Confirm cancellation</p>
            <h2 id="billing-cancel-title" className="billing-pane-title">
              Cancel Premium?
            </h2>
            <p id="billing-cancel-desc" className="billing-pane-lead">
              Your plan will stay active until the end of the current billing
              period. After that, your account returns to Basic.
            </p>
            <div className="billing-modal-actions">
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost"
                disabled={cancelBusy}
                onClick={() => {
                  setCancelModalOpen(false);
                }}
              >
                Keep Premium
              </button>
              <button
                type="button"
                className="mkt-btn billing-cancel-confirm"
                disabled={cancelBusy}
                onClick={() => {
                  void onConfirmCancelSubscription();
                }}
              >
                {cancelBusy ? "Canceling…" : "Yes, cancel subscription"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPremium ? (
        <>
          <section
            className="billing-payment"
            aria-labelledby="billing-payment-title"
          >
            <div className="billing-payment-copy">
              <p className="billing-pane-kicker">Payment method</p>
              <h2 id="billing-payment-title" className="billing-pane-title">
                Change payment method
              </h2>
              <p className="billing-pane-lead">
                Update the card on file for your Premium subscription through
                Stripe.
              </p>
            </div>
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              disabled={paymentMethodBusy}
              onClick={() => {
                void onChangePaymentMethod();
              }}
            >
              {paymentMethodBusy ? "Opening Stripe…" : "Change payment method"}
            </button>
          </section>

          <section
            className="billing-invoices"
            aria-labelledby="billing-invoices-title"
          >
            <div className="billing-invoices-head">
              <div>
                <p className="billing-pane-kicker">Invoices</p>
                <h2 id="billing-invoices-title" className="billing-pane-title">
                  Billing history
                </h2>
                <p className="billing-pane-lead">
                  Select an invoice ID to open the hosted Stripe invoice.
                </p>
              </div>
              <button
                type="button"
                className="mkt-btn mkt-btn-ghost billing-refresh"
                disabled={invoicesLoadState === "loading"}
                onClick={() => {
                  void loadPremiumBilling();
                }}
              >
                {invoicesLoadState === "loading"
                  ? "Refreshing…"
                  : "Refresh invoices"}
              </button>
            </div>

            {invoicesLoadState === "loading" && invoices.length === 0 ? (
              <div className="billing-status" aria-busy="true">
                Loading invoices…
              </div>
            ) : invoicesLoadState === "error" ? (
              <div className="billing-status billing-status-error" role="alert">
                <p>We could not load invoices right now. Try again in a moment.</p>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={() => {
                    void loadPremiumBilling();
                  }}
                >
                  Try again
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="billing-status">No invoices yet.</div>
            ) : (
              <ul className="billing-invoice-list">
                {invoices.map((invoiceId) => {
                  const isOpening = openingInvoiceId === invoiceId;
                  return (
                    <li key={invoiceId}>
                      <button
                        type="button"
                        className="billing-invoice-item"
                        disabled={openingInvoiceId !== null}
                        onClick={() => {
                          void onOpenInvoice(invoiceId);
                        }}
                      >
                        <span className="billing-invoice-id">{invoiceId}</span>
                        <span className="billing-invoice-action">
                          {isOpening ? "Opening…" : "View invoice"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

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
