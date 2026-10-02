"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { handleForgotPassword } from "@/auth/api";
import { ForgotPasswordRequest } from "@/auth/types";

import "./forgot_password.css";

export function ForgotPasswordForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const forgotPasswordRequest: ForgotPasswordRequest = {
        email,
        newPassword,
      };

      await handleForgotPassword(forgotPasswordRequest);
      toast.success("Password updated successfully. Navigating to login page...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to reset password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="wrapper">
      <h2>Reset Password</h2>
      <p className="forgot-password-subtitle">
        Enter your email and choose a new password.
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
          />
          <label htmlFor="email">Email</label>
        </div>

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
