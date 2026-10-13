"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  resendEmailVerification,
  verifyEmail,
} from "@/services/emailVerificationService";
import { useAuth } from "@/contexts/AuthContext";

import "./verify_email.css";

type VerifyStatus = "loading" | "success" | "error" | "missing";

export function VerifyEmailWorkspace() {
  const searchParams = useSearchParams();
  const { status: authStatus, refreshAuth } = useAuth();
  const token = searchParams.get("token");
  const verifyStarted = useRef(false);

  const [status, setStatus] = useState<VerifyStatus>(
    token ? "loading" : "missing",
  );
  const [email, setEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!token || verifyStarted.current) return;
    verifyStarted.current = true;

    const controller = new AbortController();

    (async () => {
      const result = await verifyEmail(token, { signal: controller.signal });
      if (controller.signal.aborted) return;

      if (result) {
        setStatus("success");
        toast.success("Email verified successfully.");
        await refreshAuth();
      } else {
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [token, refreshAuth]);

  const handleResend = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || isResending) return;

    setIsResending(true);
    try {
      const result = await resendEmailVerification(email.trim());
      if (result) {
        toast.success("Verification email resent. Check your inbox.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="wrapper">
      <h2>Verify your email</h2>

      {status === "loading" && (
        <p className="verify-email-subtitle">Confirming your verification link…</p>
      )}

      {status === "success" && (
        <>
          <p className="verify-email-subtitle">
            Your email has been verified. You can sign in to JobGenius.
          </p>
          {authStatus.status === "authenticated" ? (
            <Link href="/" className="verify-email-primary-link">
              Go to home
            </Link>
          ) : (
            <Link href="/login" className="verify-email-primary-link">
              Go to login
            </Link>
          )}
        </>
      )}

      {(status === "error" || status === "missing") && (
        <>
          <p className="verify-email-subtitle">
            {status === "missing"
              ? "This page needs a valid verification link from your email."
              : "We could not verify that link. It may be invalid or expired."}
          </p>

          <form onSubmit={handleResend} className="verify-email-form">
            <div className="input-field">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                required
              />
              <label htmlFor="email">Email</label>
            </div>
            <button type="submit" disabled={isResending}>
              {isResending ? "Sending…" : "Resend verification email"}
            </button>
          </form>

          <div className="verify-email-bottom">
            <p className="login-link">
              Already verified? <Link href="/login">Login</Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
