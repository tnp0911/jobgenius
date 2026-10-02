import type { Metadata } from "next";
import "../marketing.css";
import "./settings_privacy.css";
import { PrivacyWorkspace } from "./PrivacyWorkspace";
import { SettingsWorkspace } from "./SettingsWorkspace";

export const metadata: Metadata = {
  title: "Settings & Privacy",
  description:
    "Manage JobGenius account preferences, change your password, and review how we handle your data.",
};

export default function SettingsPrivacyPage() {
  return (
    <div className="mkt settings">
      <header className="settings-hero">
        <div className="settings-hero-atmosphere" aria-hidden="true" />
        <div className="mkt-shell settings-hero-inner">
          <p className="settings-brand mkt-rise">JobGenius</p>
          <h1 className="settings-headline mkt-rise mkt-rise-delay">
            Settings &amp; privacy.
          </h1>
          <p className="settings-support mkt-rise mkt-rise-delay-2">
            Update account preferences, change your password, and see how your
            session data is handled.
          </p>
        </div>
      </header>

      <section className="settings-stage" aria-label="Settings and privacy">
        <div className="mkt-shell settings-stage-inner">
          <div className="settings-workspace">
            <SettingsWorkspace />
            <PrivacyWorkspace />
          </div>
        </div>
      </section>
    </div>
  );
}
