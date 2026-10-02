"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthOptions } from "@/auth/types";
import { getCurrentUser, type CurrentUser } from "@/services/userService";

type LoadState = "idle" | "loading" | "ready" | "error";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="account-detail">
      <dt className="account-detail-label">{label}</dt>
      <dd className="account-detail-value">{value}</dd>
    </div>
  );
}

export function MyAccountWorkspace() {
  const { status, tier } = useAuth();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const loadIdRef = useRef(0);

  const loadUser = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const options: AuthOptions = {
      signal: controller.signal,
      timeout: 15_000,
    };

    setLoadState("loading");
    const nextUser = await getCurrentUser(options);

    if (controller.signal.aborted || controllerRef.current !== controller) {
      return;
    }
    if (loadIdRef.current !== loadId) return;

    setUser(nextUser);
    setLoadState(nextUser ? "ready" : "error");
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void loadUser();
  }, [status, loadUser]);

  if (status === "loading") {
    return (
      <div className="account-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <section className="account-pane account-gate" aria-labelledby="account-gate-title">
        <p className="account-pane-kicker">Account required</p>
        <h2 id="account-gate-title" className="account-pane-title">
          Sign in to see your details
        </h2>
        <p className="account-pane-lead">
          Name, email, and plan live with your JobGenius account. Log in to
          view what we have on file.
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

  if (loadState === "loading" && !user) {
    return (
      <div className="account-status" aria-busy="true">
        Loading your details…
      </div>
    );
  }

  if (loadState === "error" || !user) {
    return (
      <div className="account-status account-status-error" role="alert">
        <p>We could not load your account right now. Try again in a moment.</p>
        <button
          type="button"
          className="mkt-btn mkt-btn-primary"
          onClick={() => {
            void loadUser();
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  const isPremium = tier?.toLowerCase() === "premium";
  const planLabel = isPremium ? "Premium" : "Basic";

  return (
    <section className="account-pane" aria-labelledby="account-profile-title">
      <div className="account-profile-head">
        <div className="account-avatar" aria-hidden="true">
          {initialsFromName(user.name)}
        </div>
        <div>
          <p className="account-pane-kicker">Profile</p>
          <div className="account-name-row">
            <h2 id="account-profile-title" className="account-pane-title">
              {user.name}
            </h2>
            <p className={`account-plan-badge${isPremium ? " is-premium" : ""}`}>
              {planLabel}
            </p>
          </div>
        </div>
      </div>

      <dl className="account-details">
        <DetailRow label="Full name" value={user.name} />
        <DetailRow label="Email" value={user.email} />
      </dl>

      <div className="account-profile-actions">
        <button
          type="button"
          className="mkt-btn mkt-btn-ghost"
          disabled
          title="Editing is not available yet"
        >
          Edit details
        </button>
        {!isPremium ? (
          <Link href="/plans" className="mkt-btn mkt-btn-primary">
            Upgrade to Premium
          </Link>
        ) : (
          <Link href="/billing_subscription" className="mkt-btn mkt-btn-ghost">
            View billing
          </Link>
        )}
      </div>
    </section>
  );
}
