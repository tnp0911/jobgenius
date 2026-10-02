"use client";

import Link from "next/link";

export function PrivacyWorkspace() {
  return (
    <section className="settings-pane" aria-labelledby="privacy-title">
      <p className="settings-pane-kicker">Privacy</p>
      <h2 id="privacy-title" className="settings-pane-title">
        How we use your session
      </h2>
      <p className="settings-pane-lead">
        JobGenius keeps sign-in cookies on your device so you stay logged in
        across analyzer and job-finder runs. We do not sell your account data.
      </p>

      <ul className="settings-privacy-list">
        <li>
          <strong>Session cookies</strong>
          <span>
            HttpOnly access and refresh tokens keep you signed in without
            exposing credentials to page scripts.
          </span>
        </li>
        <li>
          <strong>Account profile</strong>
          <span>
            Name and email on file are available under{" "}
            <Link href="/myaccount">My Account</Link>.
          </span>
        </li>
        <li>
          <strong>Usage &amp; billing</strong>
          <span>
            Plan and remaining allowances live on{" "}
            <Link href="/billing_subscription">Billing &amp; Subscription</Link>
            .
          </span>
        </li>
      </ul>
    </section>
  );
}
