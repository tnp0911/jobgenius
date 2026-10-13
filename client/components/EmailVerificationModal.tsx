"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import { resendEmailVerification } from "@/services/emailVerificationService";
import { getCurrentUser } from "@/services/userService";

import "./emailVerificationModal.css";

type EmailVerificationModalProps = {
  open: boolean;
  onClose: () => void;
  /** If omitted, the modal loads the signed-in user's email when opened. */
  email?: string | null;
};

export function EmailVerificationModal({
  open,
  onClose,
  email: emailProp,
}: EmailVerificationModalProps) {
  const titleId = useId();
  const descId = useId();
  const [email, setEmail] = useState(emailProp?.trim() ?? "");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (emailProp?.trim()) {
      setEmail(emailProp.trim());
    }
  }, [emailProp]);

  useEffect(() => {
    if (!open || emailProp?.trim()) return;

    let cancelled = false;
    void (async () => {
      const user = await getCurrentUser();
      if (!cancelled && user?.email) {
        setEmail(user.email);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, emailProp]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSending) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, isSending, onClose]);

  if (!open) return null;

  const handleSend = async () => {
    const target = email.trim();
    if (!target || isSending) return;

    setIsSending(true);
    try {
      const result = await resendEmailVerification(target);
      if (result) {
        toast.success("Verification email sent. Check your inbox.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="email-verify-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!isSending) onClose();
      }}
    >
      <div
        className="email-verify-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <p className="email-verify-modal-kicker">Email verification</p>
        <h2 id={titleId} className="email-verify-modal-title">
          Please verify your email
        </h2>
        <div id={descId} className="email-verify-modal-body">
          <p>
            Whether you just joined JobGenius or you already had an account, we
            now ask everyone to confirm their email so we can keep accounts
            secure.
          </p>
          <p>
            New signups: check your inbox for a verification link. Existing
            members: nothing is wrong with your account — this is a new
            requirement, and you can send a fresh link below.
          </p>
          {email ? (
            <p className="email-verify-modal-email">
              We&apos;ll send the link to <strong>{email}</strong>.
            </p>
          ) : null}
        </div>
        <div className="email-verify-modal-actions">
          <button
            type="button"
            className="email-verify-modal-btn email-verify-modal-btn-ghost"
            disabled={isSending}
            onClick={onClose}
          >
            Continue for now
          </button>
          <button
            type="button"
            className="email-verify-modal-btn email-verify-modal-btn-primary"
            disabled={isSending || !email.trim()}
            onClick={() => {
              void handleSend();
            }}
          >
            {isSending ? "Sending…" : "Send verification email"}
          </button>
        </div>
      </div>
    </div>
  );
}
