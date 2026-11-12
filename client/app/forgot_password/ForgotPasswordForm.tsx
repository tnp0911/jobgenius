"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { handleForgotPasswordSendLink } from "@/auth/api";
import { isAborted } from "@/utils/errorHelpers";

import "./forgot_password.css";

export function ForgotPasswordForm() {
  const controllerRef = useRef<AbortController | null>(null);

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsSubmitting(true);

    try {
      const response = await handleForgotPasswordSendLink(
        { email: email.trim() },
        { signal: controller.signal },
      );

      if (controllerRef.current !== controller) return;

      setEmailSent(true);
      toast.success(
        response.message ??
          "Please check your email to proceed with the password reset process.",
      );
    } catch (error: unknown) {
      if (isAborted(error) || controller.signal.aborted) return;

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wrapper">
      <h2>Forgot Password</h2>

      {emailSent ? (
        <>
          <p className="forgot-password-subtitle">
            Please check your email to proceed with the password reset process.
          </p>
          <p className="forgot-password-success-hint">
            If an account exists for <strong>{email.trim()}</strong>, a reset
            link has been sent. The link expires in 15 minutes.
          </p>
          <div className="forgot-password-form-bottom">
            <p className="login-link">
              Remember your password? <Link href="/login">Back to Login</Link>
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="forgot-password-subtitle">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>

          <form onSubmit={handleSubmit} className="forgot-password-form">
            <div className="input-field">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                required
                autoComplete="email"
              />
              <label htmlFor="email">Email</label>
            </div>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <div className="forgot-password-form-bottom">
            <p className="login-link">
              Remember your password? <Link href="/login">Back to Login</Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
