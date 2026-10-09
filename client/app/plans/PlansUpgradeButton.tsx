"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/services/paymentService";
import { AuthOptions } from "@/auth/types";
import { isAborted } from "@/utils/errorHelpers";

type PlansUpgradeButtonProps = {
  className?: string;
  label?: string;
};

export function PlansUpgradeButton({
  className = "mkt-btn mkt-btn-primary plans-cta",
  label = "Go Premium",
}: PlansUpgradeButtonProps) {
  const { status, tier } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const isPremium = tier?.toLowerCase() === "premium";

  async function onUpgrade() {
    if (status !== "authenticated") {
      toast.info("Sign in to upgrade to Premium.");
      router.push("/login");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (isPremium) {
      toast.info("You're already on Premium.");
      return;
    }

    setBusy(true);
    try {
      const origin = window.location.origin;
      const options: AuthOptions = {
        signal: controller.signal,
        timeout: 15_000,
      };
      const url = await createCheckoutSession(
        `${origin}/payment/success`,
        `${origin}/plans`,
        options,
      );
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      if (!url) {
        setBusy(false);
        return;
      }
      window.location.href = url;
    } catch (error) {
      if (isAborted(error)) return;
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      const message =
        error instanceof Error ? error.message : "Could not start checkout.";
      toast.error(message);
      setBusy(false);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }

  if (isPremium) {
    return (
      <span className="plans-cta-current" aria-live="polite">
        Your current plan
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => {
        void onUpgrade();
      }}
    >
      {busy ? "Opening Stripe…" : label}
    </button>
  );
}
