import { Suspense } from "react";
import { VerifyEmailWorkspace } from "./VerifyEmailWorkspace";
import "./verify_email.css";

export default function VerifyEmailPage() {
  return (
    <div className="verify-email-container">
      <Suspense
        fallback={
          <div className="wrapper">
            <h2>Verify your email</h2>
            <p className="verify-email-subtitle">Loading…</p>
          </div>
        }
      >
        <VerifyEmailWorkspace />
      </Suspense>
    </div>
  );
}
