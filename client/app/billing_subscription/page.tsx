import type { Metadata } from "next";
import "../marketing.css";
import "./billing_subscription.css";
import { BillingSubscriptionWorkspace } from "./BillingSubscriptionWorkspace";

export const metadata: Metadata = {
  title: "Billing & Subscription",
  description:
    "See your JobGenius plan, resume analyzer allowance, and job finder usage in one place.",
};

export default function BillingSubscriptionPage() {
  return (
    <div className="mkt billing">
      <header className="billing-hero">
        <div className="billing-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell billing-hero-inner">
          <p className="billing-brand mkt-rise">JobGenius</p>
          <h1 className="billing-headline mkt-rise mkt-rise-delay">
            Your plan, your remaining runway.
          </h1>
          <p className="billing-support mkt-rise mkt-rise-delay-2">
            Check analyzer and job-finder usage, see when the window resets, and
            know exactly where you stand before the next run.
          </p>
        </div>
      </header>

      <section className="billing-stage" aria-label="Usage and subscription">
        <div className="mkt-shell billing-stage-inner">
          <BillingSubscriptionWorkspace />
        </div>
      </section>
    </div>
  );
}
