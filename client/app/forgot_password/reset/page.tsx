import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";
import "../forgot_password.css";

export default function ResetPasswordPage() {
  return (
    <div className="forgot-password-container">
      <Suspense
        fallback={
          <div className="wrapper">
            <h2>Reset Password</h2>
            <p className="forgot-password-subtitle">Loading…</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
