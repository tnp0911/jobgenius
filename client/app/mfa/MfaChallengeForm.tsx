"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { handleLoginGauth } from "@/auth/api";
import { useAuth } from "@/contexts/AuthContext";
import { isAborted } from "@/utils/errorHelpers";

function parseTotpCode(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const code = Number(digits);
  return Number.isInteger(code) ? code : null;
}

export function MfaChallengeForm() {
  const router = useRouter();
  const { status, refreshAuth } = useAuth();
  const controllerRef = useRef<AbortController | null>(null);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status.status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const totp = parseTotpCode(code);
    if (totp === null) {
      toast.error("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setIsSubmitting(true);

    try {
      await handleLoginGauth({ code: totp }, { signal: controller.signal });
      if (controllerRef.current !== controller) return;

      await refreshAuth();
      toast.success("Login successful");
      router.push("/");
    } catch (error: unknown) {
      if (isAborted(error) || controller.signal.aborted) return;
      toast.error(
        error instanceof Error
          ? error.message
          : "Invalid authenticator code. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  };

  return (
    <div className="wrapper">
      <h2>Verify with Authenticator</h2>
      <p className="forgot-password-text" style={{ marginBottom: "1rem", textAlign: "center" }}>
        Open Google Authenticator and enter the 6-digit code for JobGenius.
      </p>

      <form onSubmit={handleSubmit} className="login-form">
        <div className="input-field">
          <input
            id="mfaLoginCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder=" "
            required
            autoFocus
          />
          <label htmlFor="mfaLoginCode">Authenticator code</label>
        </div>

        <button type="submit" disabled={isSubmitting || code.length !== 6}>
          {isSubmitting ? "Verifying…" : "Continue"}
        </button>
      </form>

      <div className="login-form-bottom">
        <p className="register-link">
          <Link href="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
