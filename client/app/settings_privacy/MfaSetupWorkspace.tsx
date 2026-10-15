"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  handleDisableGauth,
  handleRegisterGauth,
  handleVerifyGauthRegistration,
} from "@/auth/api";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUser } from "@/services/userService";

type SetupPhase = "idle" | "qr_ready" | "enabled";
type PhoneOs = "" | "ios" | "android";

const STORE_QR = {
  ios: {
    href: "https://apps.apple.com/app/google-authenticator/id388497605",
    src: "/assets/images/qrcode_appstore.png",
    label: "App Store",
    alt: "QR code to download Google Authenticator on the App Store",
  },
  android: {
    href: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
    src: "/assets/images/qrcode_googleplay.png",
    label: "Google Play",
    alt: "QR code to download Google Authenticator on Google Play",
  },
} as const;

function parseTotpCode(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const code = Number(digits);
  return Number.isInteger(code) ? code : null;
}

export function MfaSetupWorkspace() {
  const { status } = useAuth();
  const [phase, setPhase] = useState<SetupPhase>("idle");
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [phoneOs, setPhoneOs] = useState<PhoneOs>("");

  const refreshMfaStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const user = await getCurrentUser();
      const enabled = Boolean(user?.mfaEnabled);
      setMfaEnabled(enabled);
      setPhase(enabled ? "enabled" : "idle");
      if (enabled) {
        setQrBase64(null);
        setVerifyCode("");
      }
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (status.status !== "authenticated") {
      setLoadingStatus(false);
      return;
    }
    void refreshMfaStatus();
  }, [status.status, refreshMfaStatus]);

  const startSetup = async () => {
    setIsStarting(true);
    try {
      const { qrCodeUrl } = await handleRegisterGauth();
      if (!qrCodeUrl) {
        throw new Error("Server did not return a QR code. Please try again.");
      }
      setQrBase64(qrCodeUrl);
      setPhase("qr_ready");
      setVerifyCode("");
      toast.info("Scroll down to step 2 and scan the QR code. Then enter the 6-digit code.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start MFA setup. Please try again.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const verifySetup = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = parseTotpCode(verifyCode);
    if (code === null) {
      toast.error("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setIsVerifying(true);
    try {
      await handleVerifyGauthRegistration({ code });
      toast.success("Two-factor authentication is now enabled.");
      setVerifyCode("");
      setQrBase64(null);
      await refreshMfaStatus();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Invalid authenticator code. Please try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const disableMfa = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = parseTotpCode(disableCode);
    if (code === null) {
      toast.error("Enter the 6-digit code from Google Authenticator.");
      return;
    }

    setIsDisabling(true);
    try {
      await handleDisableGauth({ code });
      toast.success("Two-factor authentication has been disabled.");
      setDisableCode("");
      await refreshMfaStatus();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disable MFA. Check your code and try again.",
      );
    } finally {
      setIsDisabling(false);
    }
  };

  if (status.status === "loading" || loadingStatus) {
    return (
      <div className="settings-status" aria-busy="true">
        Loading MFA settings…
      </div>
    );
  }

  if (status.status === "unauthenticated") {
    return (
      <section className="settings-pane settings-gate" aria-labelledby="mfa-gate-title">
        <p className="settings-pane-kicker">Two-factor authentication</p>
        <h2 id="mfa-gate-title" className="settings-pane-title">
          Sign in to set up MFA
        </h2>
        <p className="settings-pane-lead">
          Google Authenticator protects your account with a time-based code at
          login. Log in to enable or manage it.
        </p>
        <div className="settings-gate-actions">
          <Link href="/login" className="mkt-btn mkt-btn-primary">
            Log in
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-pane mfa-pane" aria-labelledby="mfa-setup-title">
      <p className="settings-pane-kicker">Two-factor authentication</p>
      <h2 id="mfa-setup-title" className="settings-pane-title">
        MFA with Google Authenticator
      </h2>
      <p className="settings-pane-lead">
        Add a second step at login using a 6-digit code from the Google
        Authenticator app. Your account will be more secure.
      </p>

      <div
        className={`mfa-status-badge ${mfaEnabled ? "mfa-status-on" : "mfa-status-off"}`}
        role="status"
      >
        {mfaEnabled ? "MFA is enabled" : "MFA is not enabled"}
      </div>

      {!mfaEnabled && (
        <>
          {phase !== "qr_ready" && (
            <div className="settings-form-actions mfa-start-actions">
              <button
                type="button"
                className="mkt-btn mkt-btn-primary"
                onClick={() => void startSetup()}
                disabled={isStarting}
              >
                {isStarting ? "Generating QR…" : "Start MFA setup"}
              </button>
            </div>
          )}

          {phase === "qr_ready" && (
            <form onSubmit={verifySetup} className="settings-password-form mfa-verify-form">
              <div className="settings-field">
                <input
                  id="mfaVerifyCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder=" "
                  required
                />
                <label htmlFor="mfaVerifyCode">6-digit authenticator code</label>
              </div>
              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="mkt-btn mkt-btn-primary"
                  disabled={isVerifying || verifyCode.length !== 6}
                >
                  {isVerifying ? "Verifying…" : "Verify and enable MFA"}
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-ghost"
                  onClick={() => void startSetup()}
                  disabled={isStarting}
                >
                  {isStarting ? "Refreshing…" : "Regenerate QR"}
                </button>
              </div>
            </form>
          )}

          <ol className="mfa-steps">
            <li className="mfa-step">
              <div className="mfa-step-header">
                <span className="mfa-step-num" aria-hidden="true">
                  1
                </span>
                <div>
                  <strong>Install Google Authenticator</strong>
                  <p>
                    Download the official Google Authenticator app on your phone
                    from the App Store or Google Play.
                  </p>
                </div>
              </div>
              <div className="mfa-os-picker">
                <label htmlFor="mfaPhoneOs" className="mfa-os-label">
                  Choose your phone OS
                </label>
                <select
                  id="mfaPhoneOs"
                  className="mfa-os-select"
                  value={phoneOs}
                  onChange={(e) => setPhoneOs(e.target.value as PhoneOs)}
                >
                  <option value="" disabled>Select one...</option>
                  <option value="ios">iOS (App Store)</option>
                  <option value="android">Android (Google Play)</option>
                </select>
              </div>

              {phoneOs ? (
                <div className="mfa-store-qrs" aria-label="Google Authenticator download QR code">
                  <a
                    className="mfa-store-qr"
                    href={STORE_QR[phoneOs].href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={STORE_QR[phoneOs].src}
                      alt={STORE_QR[phoneOs].alt}
                      width={160}
                      height={160}
                    />
                    <span>{STORE_QR[phoneOs].label}</span>
                  </a>
                </div>
              ) : (
                <p className="mfa-os-hint">
                  Select your OS above to show the matching download QR code.
                </p>
              )}
            </li>

            <li className="mfa-step">
              <div className="mfa-step-header">
                <span className="mfa-step-num" aria-hidden="true">
                  2
                </span>
                <div>
                  <strong>Scan the QR code from JobGenius</strong>
                  <p>
                    Tap &ldquo;Start MFA setup&rdquo; above. Open Google Authenticator,
                    choose add account, then scan the QR code we generate for your
                    JobGenius account.
                  </p>
                </div>
              </div>

              {phase === "qr_ready" && qrBase64 ? (
                <div className="mfa-qr-slot mfa-qr-live">
                  <img
                    src={`data:image/png;base64,${qrBase64}`}
                    alt="Google Authenticator QR code for JobGenius"
                    width={220}
                    height={220}
                  />
                </div>
              ) : (
                <div className="mfa-qr-slot mfa-qr-placeholder">
                  <span>Your account QR will appear here</span>
                  <span className="mfa-qr-note">Generated securely by the server when you start setup</span>
                </div>
              )}
            </li>

            <li className="mfa-step">
              <div className="mfa-step-header">
                <span className="mfa-step-num" aria-hidden="true">
                  3
                </span>
                <div>
                  <strong>Enter the 6-digit verification code</strong>
                  <p>
                    Authenticator shows a rotating code for JobGenius. Enter it
                    above to confirm the link and turn MFA on.
                  </p>
                </div>
              </div>
            </li>

            <li className="mfa-step">
              <div className="mfa-step-header">
                <span className="mfa-step-num" aria-hidden="true">
                  4
                </span>
                <div>
                  <strong>Use the code at every login</strong>
                  <p>
                    After setup, password and Google sign-in will ask for a fresh
                    authenticator code before you reach your account.
                  </p>
                </div>
              </div>
            </li>
          </ol>
        </>
      )}

      {mfaEnabled && (
        <div className="mfa-disable-block">
          <p className="mfa-disable-lead">
            To turn MFA off, open Google Authenticator and enter the current
            6-digit JobGenius code. This removes the authenticator from your
            account. However, we recommend you keep it enabled for added security.
          </p>
          <form onSubmit={disableMfa} className="settings-password-form">
            <div className="settings-field">
              <input
                id="mfaDisableCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder=" "
                required
              />
              <label htmlFor="mfaDisableCode">6-digit authenticator code</label>
            </div>
            <div className="settings-form-actions">
              <button
                type="submit"
                className="mkt-btn mkt-btn-ghost mfa-disable-btn"
                disabled={isDisabling || disableCode.length !== 6}
              >
                {isDisabling ? "Disabling…" : "Disable MFA"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
