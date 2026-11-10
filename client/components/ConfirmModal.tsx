"use client";

import { useEffect, useId, type ReactNode } from "react";
import "./confirmModal.css";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  kicker?: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** When false, hide cancel and only allow dismiss via confirm (e.g. info warnings). */
  showCancel?: boolean;
};

export function ConfirmModal({
  open,
  title,
  kicker,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "primary",
  busy = false,
  onConfirm,
  onCancel,
  showCancel = true,
}: ConfirmModalProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirm-modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        {kicker ? <p className="confirm-modal-kicker">{kicker}</p> : null}
        <h2 id={titleId} className="confirm-modal-title">
          {title}
        </h2>
        <div id={descId} className="confirm-modal-body">
          {children}
        </div>
        <div className="confirm-modal-actions">
          {showCancel ? (
            <button
              type="button"
              className="confirm-modal-btn confirm-modal-btn-ghost"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`confirm-modal-btn confirm-modal-btn-${confirmTone}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
