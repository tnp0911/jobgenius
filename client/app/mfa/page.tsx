"use client";

import { MfaChallengeForm } from "./MfaChallengeForm";
import "../login/login.css";

export default function MfaPage() {
  return (
    <div className="login-container">
      <MfaChallengeForm />
    </div>
  );
}
