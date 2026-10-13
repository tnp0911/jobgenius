"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export function PaymentSuccessExperience() {
  const { status, refreshAuth, tier } = useAuth();

  useEffect(() => {
    void refreshAuth(); // this call is used to refresh the auth status and get the latest user plan
  }, [refreshAuth]);

  const isPremium = tier?.toLowerCase() === "premium";

  return (
    <div className="pay-success">
      <div className="pay-success-atmosphere" aria-hidden="true" />

      <div className="mkt-shell pay-success-shell">
        <p className="pay-success-brand mkt-rise">JobGenius</p>

        <div className="pay-success-mark mkt-rise mkt-rise-delay" aria-hidden="true">
          <svg viewBox="0 0 72 72" className="pay-success-check">
            <circle className="pay-success-check-ring" cx="36" cy="36" r="32" />
            <path
              className="pay-success-check-path"
              d="M22 37.5 31.5 47 50 26"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="pay-success-title mkt-rise mkt-rise-delay">
          You&apos;re on Premium
        </h1>
        <p className="pay-success-lead mkt-rise mkt-rise-delay-2">
          {isPremium
            ? "Your subscription is active. Deeper resume analysis, job finder, and higher limits are ready when you are."
            : "Payment received. Premium may take a few seconds to activate — refresh if your plan badge hasn’t updated yet."}
        </p>

        <div className="pay-success-cta mkt-rise mkt-rise-delay-2">
          <Link href="/analyzer" className="mkt-btn mkt-btn-primary">
            Open analyzer
          </Link>
          <Link href="/" className="mkt-btn mkt-btn-ghost">
            Back to home
          </Link>
        </div>

        <p className="pay-success-note mkt-rise mkt-rise-delay-2">
          A confirmation email from Stripe may arrive shortly. You can manage billing from your
          account anytime.
        </p>
      </div>
    </div>
  );
}
