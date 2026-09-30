"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";
import { handleUpdatePassword } from "@/auth/api";
import { UpdatePasswordRequest } from "@/auth/types";
import { useAuth } from "@/contexts/AuthContext";

export function SettingsWorkspace() {
  const { status } = useAuth();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (oldPassword === newPassword) {
      toast.error("New password must be different from your current password");
      return;
    }

    setIsSubmitting(true);

    try {
      const updatePasswordRequest: UpdatePasswordRequest = {
        oldPassword,
        newPassword,
      };

      await handleUpdatePassword(updatePasswordRequest);
      toast.success("Password updated successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update password. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="settings-status" aria-busy="true">
        Checking your session…
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <section className="settings-pane settings-gate" aria-labelledby="settings-gate-title">
        <p className="settings-pane-kicker">Account required</p>
        <h2 id="settings-gate-title" className="settings-pane-title">
          Sign in to manage preferences
        </h2>
        <p className="settings-pane-lead">
          Password changes and account preferences stay with your JobGenius
          account. Log in to continue.
        </p>
        <div className="settings-gate-actions">
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

  return (
    <section className="settings-pane" aria-labelledby="settings-prefs-title">
      <p className="settings-pane-kicker">Account preferences</p>
      <h2 id="settings-prefs-title" className="settings-pane-title">
        Change password
      </h2>
      <p className="settings-pane-lead">
        Confirm your current password, then choose a new one. You stay signed
        in after the update.
      </p>

      <form onSubmit={handleSubmit} className="settings-password-form">
        <div className="settings-field">
          <input
            id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder=" "
            autoComplete="current-password"
            required
          />
          <label htmlFor="oldPassword">Current password</label>
        </div>

        <div className="settings-field">
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="newPassword">New password</label>
        </div>

        <div className="settings-field">
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder=" "
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirmPassword">Confirm new password</label>
        </div>

        <div className="settings-form-actions">
          <button
            type="submit"
            className="mkt-btn mkt-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
          <Link href="/forgot_password" className="settings-forgot-link">
            Forgot your password?
          </Link>
        </div>
      </form>
    </section>
  );
}
