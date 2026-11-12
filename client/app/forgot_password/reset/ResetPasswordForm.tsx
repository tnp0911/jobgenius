"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { handleForgotPasswordUpdate } from "@/auth/api";
import { isAborted } from "@/utils/errorHelpers";

import "../forgot_password.css";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const controllerRef = useRef<AbortController | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      toast.error("This page needs a valid reset link from your email.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsSubmitting(true);

    try {
      await handleForgotPasswordUpdate(
        { token, newPassword },
        { signal: controller.signal },
      );

      if (controllerRef.current !== controller) return;

      toast.success("Password updated successfully. Navigating to login…");
      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error: unknown) {
      if (isAborted(error) || controller.signal.aborted) return;

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to reset password. Please try again.");
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="wrapper">
        <h2>Reset Password</h2>
        <p className="forgot-password-subtitle">
          This page needs a valid reset link from your email.
        </p>
        <div className="forgot-password-form-bottom">
          <p className="login-link">
            Need a new link? <Link href="/forgot_password">Request reset</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrapper">
      <h2>Reset Password</h2>
      <p className="forgot-password-subtitle">
        Choose a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="forgot-password-form">
        <div className="input-field">
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="newPassword">New Password</label>
        </div>

        <div className="input-field">
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirmPassword">Confirm Password</label>
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="forgot-password-form-bottom">
        <p className="login-link">
          Remember your password? <Link href="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
